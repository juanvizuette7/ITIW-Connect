import dns from "node:dns";

import { app } from "./app";
import { env } from "./config/env";
import { configurePassport } from "./config/passport";
import { prisma } from "./config/prisma";
import { startEscrowReleaseScheduler } from "./services/escrowRelease.scheduler";

const STARTUP_DB_ATTEMPTS = 8;
const STARTUP_DELAY_MS = 1000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectDatabaseWithRetry() {
  for (let attempt = 1; attempt <= STARTUP_DB_ATTEMPTS; attempt += 1) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      const err = error as { code?: string; message?: string };
      const isLastAttempt = attempt === STARTUP_DB_ATTEMPTS;

      console.error(
        `[DB] Intento ${attempt}/${STARTUP_DB_ATTEMPTS} fallido${err.code ? ` (${err.code})` : ""}: ${err.message ?? "Sin detalle."}`,
      );

      if (isLastAttempt) {
        throw error;
      }

      await wait(STARTUP_DELAY_MS * attempt);
    }
  }
}

async function startServer() {
  dns.setDefaultResultOrder("ipv4first");

  await connectDatabaseWithRetry();
  configurePassport();
  startEscrowReleaseScheduler();

  app.listen(env.port, () => {
    console.log(`Servidor backend corriendo en http://localhost:${env.port}`);
  });
}

startServer().catch((error) => {
  console.error("[DB] No fue posible conectar con la base de datos al iniciar.", error);
  process.exit(1);
});
