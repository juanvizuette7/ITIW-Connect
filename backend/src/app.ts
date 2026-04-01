import express from "express";
import cors from "cors";
import routes from "./routes";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error.middleware";
import { generalRateLimiter } from "./middlewares/rate-limit.middleware";

export const app = express();

const allowedOrigins = new Set<string>([
  env.frontendUrl,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3002",
]);

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

      if (env.nodeEnv !== "production" && /^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS."));
    },
    credentials: true,
  }),
);
app.use(generalRateLimiter);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "API de ITIW Connect activa." });
});

app.use("/api", routes);
app.use(errorHandler);
