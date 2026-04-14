import { Request, Response } from "express";
import { retrainProfessionalAiScores } from "../services/aiTraining.service";

export async function retrainAi(req: Request, res: Response) {
  const userRole = req.user?.role;

  if (userRole !== "ADMIN") {
    return res.status(403).json({ message: "Solo administradores pueden ejecutar el reentrenamiento de IA." });
  }

  const results = await retrainProfessionalAiScores(72);

  return res.status(200).json({
    message: "Motor IA reentrenado correctamente con datos de las ultimas 72 horas.",
    updatedProfessionals: results.length,
    professionals: results,
  });
}
