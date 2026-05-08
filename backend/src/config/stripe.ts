import Stripe from "stripe";
import { env } from "./env";

const hasPlaceholderKey = env.stripeSecretKey.includes("usa_esta_clave");
const isMockStripe = env.nodeEnv !== "production" && hasPlaceholderKey;

const stripeClient = isMockStripe ? null : new Stripe(env.stripeSecretKey);

type CreatedIntent = {
  id: string;
  clientSecret: string;
};

export function stripeIsMockMode() {
  return isMockStripe;
}

function ensureStripeConfigured() {
  if (env.nodeEnv === "production" && hasPlaceholderKey) {
    throw new Error("Stripe no esta configurado en produccion.");
  }
}

export async function createPaymentIntent(jobId: string, amountCop: number): Promise<CreatedIntent> {
  ensureStripeConfigured();

  if (isMockStripe) {
    const id = `pi_mock_${jobId}_${Date.now()}`;
    return {
      id,
      clientSecret: `${id}_secret_mock`,
    };
  }

  const paymentIntent = await stripeClient!.paymentIntents.create({
    amount: Math.round(amountCop),
    currency: "cop",
    capture_method: "manual",
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      jobId,
    },
  });

  return {
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret || "",
  };
}

export async function getPaymentIntentClientSecret(paymentIntentId: string): Promise<string> {
  ensureStripeConfigured();

  if (isMockStripe) {
    return `${paymentIntentId}_secret_mock`;
  }

  const paymentIntent = await stripeClient!.paymentIntents.retrieve(paymentIntentId);
  return paymentIntent.client_secret || "";
}

export async function validatePaymentIntentForEscrow(paymentIntentId: string): Promise<boolean> {
  ensureStripeConfigured();

  if (isMockStripe) {
    return true;
  }

  const paymentIntent = await stripeClient!.paymentIntents.retrieve(paymentIntentId);
  return (
    paymentIntent.status === "requires_capture" ||
    paymentIntent.status === "succeeded" ||
    paymentIntent.status === "processing"
  );
}

export async function capturePaymentIntent(paymentIntentId: string): Promise<void> {
  ensureStripeConfigured();

  if (isMockStripe) {
    return;
  }

  const paymentIntent = await stripeClient!.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status === "requires_capture") {
    await stripeClient!.paymentIntents.capture(paymentIntentId);
  }
}
