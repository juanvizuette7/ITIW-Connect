import { NextFunction, Request, Response } from "express";
type UserRole = "CLIENTE" | "PROFESIONAL";

export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "No tienes sesion activa." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "No tienes permisos para acceder a este recurso con tu tipo de cuenta.",
      });
    }

    return next();
  };
}
