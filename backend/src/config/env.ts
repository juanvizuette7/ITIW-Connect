import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta variable de entorno requerida: ${name}`);
  }
  return value;
}

function withNeonConnectTimeout(databaseUrl: string): string {
  if (!databaseUrl.includes("-pooler")) {
    return databaseUrl;
  }

  try {
    const parsedUrl = new URL(databaseUrl);
    if (!parsedUrl.searchParams.has("connect_timeout")) {
      parsedUrl.searchParams.set("connect_timeout", "15");
    }
    return parsedUrl.toString();
  } catch {
    return databaseUrl;
  }
}

const databaseUrl = withNeonConnectTimeout(required("DATABASE_URL"));
process.env.DATABASE_URL = databaseUrl;

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl,
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  bcryptRounds: 12,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  emailHost: required("EMAIL_HOST"),
  emailPort: Number(process.env.EMAIL_PORT || 587),
  emailUser: required("EMAIL_USER"),
  emailPass: required("EMAIL_PASS"),
  emailFrom: required("EMAIL_FROM"),
  emailName: process.env.EMAIL_NAME || "ITIW Connect",
  stripeSecretKey: required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: required("STRIPE_WEBHOOK_SECRET"),
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || "",
};
