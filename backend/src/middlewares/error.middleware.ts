import { NextFunction, Request, Response } from "express";

export function errorHandler(err: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction) {
  if (err.code === "P1001" || err.code === "P1002") {
    console.error(`[DB] ${err.code}: ${err.message}`);
    return res.status(503).json({
      error: "No fue posible conectar con la base de datos en este momento. Intenta nuevamente en unos segundos.",
      code: "DATABASE_UNAVAILABLE",
    });
  }

  if (err.code === "P2002") {
    return res.status(409).json({
      error: "Ya existe un registro con esos datos.",
      code: "DUPLICATE_RESOURCE",
    });
  }

  console.error(err);
  return res.status(500).json({
    error: "Ocurrio un error interno. Intenta nuevamente.",
    code: "INTERNAL_ERROR",
  });
}
