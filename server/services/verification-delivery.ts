import { Buffer } from "node:buffer";

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.startsWith("234")) return `+${digits}`;
  throw new Error("Enter a phone number with a country code or Nigerian leading zero.");
}

export async function deliverVerificationCode(
  channel: "email" | "sms",
  target: string,
  code: string,
  purpose: "registration" | "password_reset" | "contact_change",
) {
  const message = purpose === "password_reset"
    ? `Your FuelIQ password reset code is ${code}. It expires in 10 minutes.`
    : `Your FuelIQ verification code is ${code}. It expires in 10 minutes.`;

  if (channel === "email") {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.VERIFICATION_EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error("Email verification is not configured. Set RESEND_API_KEY and VERIFICATION_EMAIL_FROM.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [target],
        subject: purpose === "password_reset" ? "FuelIQ password reset code" : "Verify your FuelIQ account",
        text: message,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Email delivery failed with HTTP ${response.status}.`);
    }
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    throw new Error("SMS verification is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.");
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: normalizePhone(target), From: from, Body: message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`SMS delivery failed with HTTP ${response.status}.`);
  }
}
