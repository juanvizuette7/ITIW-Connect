import { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { verifyToken } from "../utils/jwt";

export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Debes iniciar sesion para continuar." });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Tu sesion ya no es valida." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Tu cuenta fue desactivada temporalmente por administracion." });
    }

    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Tu sesion no es valida o ya expiro." });
  }
}
