import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import routes from "./routes";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error.middleware";
import { normalizeErrorResponse } from "./middlewares/error-format.middleware";
import { validateRequestInput } from "./middlewares/input-validation.middleware";
import { generalRateLimiter } from "./middlewares/rate-limit.middleware";
import { sanitizeInputs } from "./middlewares/sanitize.middleware";
import passport from "passport";

export const app = express();

const allowedOrigins = new Set<string>([
  env.frontendUrl,
  "http://localhost:3000",
  "https://itiw-connect.vercel.app",
]);

function isAllowedVercelOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && /^itiw-connect(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(url.hostname);
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (isAllowedVercelOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS."));
    },
    credentials: true,
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(generalRateLimiter);
app.use(compression());
app.use(express.json());
app.use(normalizeErrorResponse);
app.use(sanitizeInputs);
app.use(validateRequestInput);
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "API de ITIW Connect activa." });
});

app.use("/api", routes);
app.use(errorHandler);
