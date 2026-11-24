import type { Request, Response } from "express";
import Stripe from "stripe";
import fs from "fs";
import path from "path";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString } from "../utils/params.js";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL || "http://localhost:3000";

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: "2022-11-15" })
  : null;

const TIER_PRICE_MAP: Record<string, { label: string; amountNaira: number; interval: "month" }> = {
  basic: { label: "Basic", amountNaira: 5000, interval: "month" },
  pro: { label: "Pro", amountNaira: 15000, interval: "month" },
  elite: { label: "Elite", amountNaira: 50000, interval: "month" },
};

function hasVerifiedStripeCheckout() {
  return Boolean(stripe && webhookSecret);
}

function getBankTransferDetails() {
  const file = path.resolve(
    process.env.FUELIQ_DATA_DIR || path.join(process.cwd(), "data"),
    "subscription-bank.json",
  );
  const localDetails = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : {};
  const details = {
    bankName: process.env.SUBSCRIPTION_BANK_NAME || localDetails.bankName || "",
    accountNumber: process.env.SUBSCRIPTION_ACCOUNT_NUMBER || localDetails.accountNumber || "",
    accountName: process.env.SUBSCRIPTION_ACCOUNT_NAME || localDetails.accountName || "",
  };
  if (
    !details.bankName ||
    !/^\d{10}$/.test(String(details.accountNumber)) ||
    !details.accountName
  ) return null;
  return details;
}

export async function getSubscriptionPaymentOptions(_req: Request, res: Response) {
  const stripeAvailable = hasVerifiedStripeCheckout();
  const bankTransfer = stripeAvailable ? null : getBankTransferDetails();
  return res.json({
    success: true,
    data: {
      stripeAvailable,
      bankTransferAvailable: Boolean(bankTransfer),
      bankTransfer,
    },
  });
}

export async function createSubscriptionCheckout(req: AuthRequest, res: Response) {
  if (!hasVerifiedStripeCheckout() || !stripe) {
    return res.status(503).json({ success: false, message: "Verified Stripe checkout is not configured" });
  }

  const userId = ensureString(req.userId);
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const tier = ensureString(req.body.subscriptionTier);
  if (!tier || !TIER_PRICE_MAP[tier]) {
    return res.status(400).json({ success: false, message: "Invalid subscription tier" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const tierInfo = TIER_PRICE_MAP[tier];

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "ngn",
          product_data: {
            name: `FuelIQ NG ${tierInfo.label} Plan`,
            description: `Monthly ${tierInfo.label} subscription for fuel market intelligence`,
          },
          unit_amount: tierInfo.amountNaira * 100,
          recurring: { interval: tierInfo.interval },
        },
        quantity: 1,
      },
    ],
    client_reference_id: userId,
    metadata: {
      userId,
      subscriptionTier: tier,
    },
    success_url: `${appUrl}/subscription?checkout_success=1&tier=${tier}`,
    cancel_url: `${appUrl}/subscription?checkout_cancel=1`,
  });

  return res.json({ success: true, url: session.url });
}

export async function createBankTransferPaymentRequest(req: AuthRequest, res: Response) {
  if (hasVerifiedStripeCheckout()) {
    return res.status(409).json({
      success: false,
      message: "Bank transfer is unavailable while verified online checkout is active",
    });
  }
  if (!getBankTransferDetails()) {
    return res.status(503).json({ success: false, message: "Bank transfer details are not configured" });
  }

  const userId = ensureString(req.userId);
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
  const tier = ensureString(req.body?.subscriptionTier);
  const tierInfo = TIER_PRICE_MAP[tier];
  if (!tierInfo) {
    return res.status(400).json({ success: false, message: "Choose a Basic, Pro, or Elite plan" });
  }
  const transactionReference = ensureString(req.body?.transactionReference).trim();
  if (transactionReference.length < 4 || transactionReference.length > 100) {
    return res.status(400).json({ success: false, message: "Enter the bank transfer reference (4–100 characters)" });
  }

  const request = await storage.createSubscriptionPaymentRequest({
    userId,
    subscriptionTier: tier as "basic" | "pro" | "elite",
    amount: tierInfo.amountNaira,
    transactionReference,
  });
  if (!request) {
    return res.status(409).json({ success: false, message: "That transaction reference has already been submitted" });
  }
  return res.status(201).json({
    success: true,
    message: "Payment submitted for verification",
    data: request,
  });
}

export async function getUserBankTransferRequests(req: AuthRequest, res: Response) {
  const userId = ensureString(req.userId);
  if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
  const requests = await storage.getSubscriptionPaymentRequests(userId);
  return res.json({ success: true, data: requests });
}

export async function adminGetBankTransferRequests(_req: AuthRequest, res: Response) {
  const requests = await storage.getSubscriptionPaymentRequests();
  return res.json({ success: true, data: requests });
}

export async function adminReviewBankTransferRequest(req: AuthRequest, res: Response) {
  if (hasVerifiedStripeCheckout()) {
    return res.status(409).json({
      success: false,
      message: "Bank-transfer approvals are disabled while verified online checkout is active",
    });
  }
  const decision = req.body?.status;
  if (decision !== "approved" && decision !== "rejected") {
    return res.status(400).json({ success: false, message: "Status must be approved or rejected" });
  }
  const requestId = ensureString(req.params.id);
  const reviewedBy = ensureString(req.userId);
  const updated = await storage.reviewSubscriptionPaymentRequest(requestId, decision, reviewedBy);
  if (!updated) {
    return res.status(404).json({ success: false, message: "Pending payment request not found" });
  }
  return res.json({
    success: true,
    message: decision === "approved" ? "Payment verified and subscription activated" : "Payment request rejected",
    data: updated,
  });
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  if (!stripe || !webhookSecret) {
    return res.status(500).send("Stripe webhook secret is not configured");
  }

  const signature = req.headers["stripe-signature"] as string | undefined;
  if (!signature) {
    return res.status(400).send("Missing Stripe signature header");
  }

  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody) {
    return res.status(400).send("Missing raw request body for Stripe webhook");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const tier = session.metadata?.subscriptionTier as string | undefined;

    if (
      userId &&
      tier &&
      TIER_PRICE_MAP[tier] &&
      session.mode === "subscription" &&
      (session.payment_status === "paid" || session.payment_status === "no_payment_required")
    ) {
      const subscription = typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;
      const startDate = subscription
        ? new Date(subscription.current_period_start * 1000)
        : new Date();
      const endDate = subscription
        ? new Date(subscription.current_period_end * 1000)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      await storage.updateUser(userId, {
        subscriptionTier: tier,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
      });
    }
  }

  return res.sendStatus(200);
}

 