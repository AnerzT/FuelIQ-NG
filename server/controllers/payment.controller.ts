import type { Request, Response } from "express";
import Stripe from "stripe";
import { storage } from "../storage.js";
import type { AuthRequest } from "../middleware/auth.js";
import { ensureString } from "../utils/params.js";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL || "http://localhost:3000";

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: "2022-11-15" })
  : null;

const TIER_PRICE_MAP: Record<string, { label: string; amount: number; interval: "month" | "year" }> = {
  pro: { label: "Pro", amount: 15000, interval: "month" },
  elite: { label: "Elite", amount: 50000, interval: "month" },
};

export async function createSubscriptionCheckout(req: AuthRequest, res: Response) {
  if (!stripe) {
    return res.status(503).json({ success: false, message: "Stripe checkout is not configured" });
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
          unit_amount: tierInfo.amount,
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

    if (userId && tier && TIER_PRICE_MAP[tier]) {
      await storage.updateUser(userId, {
        subscriptionTier: tier,
        subscriptionStartDate: new Date(),
      });
    }
  }

  return res.sendStatus(200);
}

 