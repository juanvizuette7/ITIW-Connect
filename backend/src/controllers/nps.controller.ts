import { JobPaymentStatus, JobStatus } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/prisma";

type NpsBody = {
  score?: number;
  comment?: string;
};

const NPS_DELAY_MS = 24 * 60 * 60 * 1000;

export async function submitNps(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { jobId } = req.params;
  const { score, comment } = req.body as NpsBody;

  const parsedScore = Number(score);
  const normalizedComment = (comment || "").trim();

  if (!Number.isInteger(parsedScore) || parsedScore < 1 || parsedScore > 10) {
    return res.status(400).json({ message: "El puntaje NPS debe estar entre 1 y 10." });
  }

  if (normalizedComment.length > 300) {
    return res.status(400).json({ message: "El comentario no puede superar 300 caracteres." });
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      quote: {
        include: {
          request: {
            select: {
              description: true,
            },
          },
        },
      },
    },
  });

  if (!job) {
    return res.status(404).json({ message: "No encontramos el trabajo indicado." });
  }

  if (job.clientId !== userId && job.professionalId !== userId) {
    return res.status(403).json({ message: "Solo participantes del job pueden responder esta encuesta." });
  }

  if (job.status !== JobStatus.COMPLETADO || job.paymentStatus !== JobPaymentStatus.LIBERADO) {
    return res.status(400).json({ message: "La encuesta NPS se habilita cuando el trabajo este completado y liberado." });
  }

  const completedAtMs = new Date(job.updatedAt).getTime();
  if (Date.now() - completedAtMs < NPS_DELAY_MS) {
    return res.status(400).json({ message: "La encuesta NPS estara disponible 24 horas despues de completar el trabajo." });
  }

  const exists = await prisma.npsResponse.findUnique({
    where: {
      jobId_userId: {
        jobId,
        userId,
      },
    },
  });

  if (exists) {
    return res.status(400).json({ message: "Ya registraste una respuesta NPS para este trabajo." });
  }

  const responseNps = await prisma.npsResponse.create({
    data: {
      jobId,
      userId,
      score: parsedScore,
      comment: normalizedComment || null,
    },
  });

  return res.status(201).json({
    message: "Gracias por tu feedback.",
    response: responseNps,
    jobDescription: job.quote.request.description,
  });
}
