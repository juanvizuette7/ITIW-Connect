import { NextFunction, Request, Response } from "express";

export function errorHandler(err: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction) {
  if (err.code === "P1001" || err.code === "P1002") {
    console.error(`[DB] ${err.code}: ${err.message}`);
    return res.status(503).json({
      message: "No fue posible conectar con la base de datos en este momento. Intenta nuevamente en unos segundos.",
    });
  }

  console.error(err);
  return res.status(500).json({ message: "Ocurrio un error interno. Intenta nuevamente." });
}
