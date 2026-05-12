import { PrismaClient } from "@prisma/client";

const prismaClient = new PrismaClient();

const RETRYABLE_CODES = new Set(["P1001", "P1002", "P1017", "P2024"]);
const MAX_QUERY_ATTEMPTS = 6;
const BASE_DELAY_MS = 500;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const prisma = prismaClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        for (let attempt = 0; attempt < MAX_QUERY_ATTEMPTS; attempt += 1) {
          try {
            return await query(args);
          } catch (error) {
            const code = (error as { code?: string }).code;
            const isRetryable = Boolean(code && RETRYABLE_CODES.has(code));

            if (!isRetryable || attempt === MAX_QUERY_ATTEMPTS - 1) {
              throw error;
            }

            try {
              await prismaClient.$disconnect();
            } catch {
              // Ignora errores de cierre al reintentar.
            }

            await wait(BASE_DELAY_MS * (attempt + 1));

            try {
              await prismaClient.$connect();
            } catch {
              // Ignora errores de conexion intermedios.
            }
          }
        }

        throw new Error("No fue posible ejecutar la consulta en base de datos.");
      },
    },
  },
});
