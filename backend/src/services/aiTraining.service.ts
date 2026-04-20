import { JobStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { setCachedProfessionalAiScore } from "./cache.service";

type LogAiTrainingEventInput = {
  professionalId: string;
  requestId: string;
  action: string;
  outcome: string;
};

type RetrainResultItem = {
  professionalId: string;
  aiScore: number;
  avgRating: number;
  acceptanceRate: number;
  averageResponseHours: number;
  similarJobsScore: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function logAiTrainingEvent(input: LogAiTrainingEventInput) {
  const { professionalId, requestId, action, outcome } = input;

  if (!professionalId || !requestId || !action.trim() || !outcome.trim()) {
    return;
  }

  try {
    await prisma.aiTrainingEvent.create({
      data: {
        professionalId,
        requestId,
        action: action.trim(),
        outcome: outcome.trim(),
      },
    });
  } catch (error) {
    console.error("[AI] No fue posible registrar evento de entrenamiento:", error);
  }
}

export async function retrainProfessionalAiScores(hoursWindow = 72): Promise<RetrainResultItem[]> {
  const since = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);

  const professionals = await prisma.user.findMany({
    where: {
      role: "PROFESIONAL",
      professionalProfile: {
        isNot: null,
      },
    },
    select: {
      id: true,
      professionalProfile: {
        select: {
          avgRating: true,
        },
      },
    },
  });

  const results: RetrainResultItem[] = [];

  for (const professional of professionals) {
    const professionalId = professional.id;

    const [quotes, similarJobsCount] = await Promise.all([
      prisma.quote.findMany({
        where: {
          professionalId,
          createdAt: {
            gte: since,
          },
        },
        select: {
          status: true,
          createdAt: true,
          request: {
            select: {
              createdAt: true,
            },
          },
        },
      }),
      prisma.job.count({
        where: {
          professionalId,
          createdAt: {
            gte: since,
          },
          status: {
            in: [JobStatus.EN_PROGRESO, JobStatus.COMPLETADO],
          },
        },
      }),
    ]);

    const totalQuotes = quotes.length;
    const acceptedQuotes = quotes.filter((quote) => quote.status === "ACEPTADA").length;
    const acceptanceRate = totalQuotes > 0 ? acceptedQuotes / totalQuotes : 0;

    const responseHoursValues = quotes.map((quote) => {
      const diffMs = quote.createdAt.getTime() - quote.request.createdAt.getTime();
      return clamp(diffMs / (1000 * 60 * 60), 0, 168);
    });

    const averageResponseHours =
      responseHoursValues.length > 0
        ? responseHoursValues.reduce((sum, value) => sum + value, 0) / responseHoursValues.length
        : 72;

    const responseScore = 1 / (1 + averageResponseHours);
    const similarJobsScore = clamp(similarJobsCount / 10, 0, 1);
    const avgRating = Number(professional.professionalProfile?.avgRating || 0);
    const avgRatingScore = clamp(avgRating / 5, 0, 1);

    const scoreRaw =
      avgRatingScore * 0.35 +
      acceptanceRate * 0.25 +
      responseScore * 0.2 +
      similarJobsScore * 0.2;

    const aiScore = Number((scoreRaw * 100).toFixed(2));

    await prisma.professionalProfile.update({
      where: { userId: professionalId },
      data: {
        aiScore,
      },
    });
    setCachedProfessionalAiScore(professionalId, aiScore);

    results.push({
      professionalId,
      aiScore,
      avgRating,
      acceptanceRate: Number(acceptanceRate.toFixed(4)),
      averageResponseHours: Number(averageResponseHours.toFixed(2)),
      similarJobsScore: Number(similarJobsScore.toFixed(4)),
    });
  }

  return results.sort((a, b) => b.aiScore - a.aiScore);
}
