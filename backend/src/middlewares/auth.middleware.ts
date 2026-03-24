import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Debes iniciar sesion para continuar." });
  }

  const token = authHeader.substring(7);

  try {
    req.user = verifyToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Tu sesion no es valida o ya expiro." });
  }
}