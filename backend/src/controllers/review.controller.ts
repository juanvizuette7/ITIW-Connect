import { BadgeType, JobPaymentStatus, JobStatus, NotificationType, Prisma, Role } from "@prisma/client";
import { Request, Response } from "express";
import { env } from "../config/env";
import { sendEmail } from "../config/mailer";
import { prisma } from "../config/prisma";
import {
  badgeAwardedTemplate,
  reviewReceivedTemplate,
} from "../utils/emailTemplates";
import {
  assignProfessionalBadges,
  parseSubcategoryRatings,
  recalculateProfessionalMetrics,
  SubcategoryRatingsInput,
} from "../services/reviewBadge.service";
import { notifyUser } from "../services/notification.service";

const REVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function resolveName(user: {
  role: Role;
  clientProfile: { name: string } | null;
  professionalProfile: { name: string } | null;
}) {
  if (user.role === "CLIENTE") {
    return user.clientProfile?.name || "Cliente";
  }
  return user.professionalProfile?.name || "Profesional";
}

function validateReviewInputs(payload: {
  rating?: number;
  subcategoryRatings?: unknown;
  comment?: string;
}) {
  const rating = Number(payload.rating);
  const subcategoryRatings = parseSubcategoryRatings(payload.subcategoryRatings);
  const comment = (payload.comment || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "La calificacion debe ser un numero entre 1 y 5." } as const;
  }

  if (!subcategoryRatings) {
    return { error: "Debes calificar puntualidad, calidad, comunicacion y limpieza (1 a 5)." } as const;
  }

  if (!comment) {
    return { error: "Debes escribir un comentario sobre tu experiencia." } as const;
  }

  if (comment.length > 400) {
    return { error: "El comentario no puede superar 400 caracteres." } as const;
  }

  return { rating, subcategoryRatings, comment } as const;
}

async function ensureReviewAllowed(params: {
  jobId: string;
  reviewerId: string;
}) {
  const { jobId, reviewerId } = params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      quote: {
        include: {
          request: {
            select: {
              id: true,
              description: true,
            },
          },
        },
      },
      client: {
        select: {
          id: true,
          role: true,
          clientProfile: {
            select: {
              name: true,
            },
          },
          professionalProfile: {
            select: {
              name: true,
            },
          },
        },
      },
      professional: {
        select: {
          id: true,
          role: true,
          clientProfile: {
            select: {
              name: true,
            },
          },
          professionalProfile: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!job) {
    return { error: "No encontramos el job indicado." } as const;
  }

  if (job.clientId !== reviewerId && job.professionalId !== reviewerId) {
    return { error: "Solo participantes del job pueden calificar." } as const;
  }

  if (job.status !== JobStatus.COMPLETADO || job.paymentStatus !== JobPaymentStatus.LIBERADO) {
    return { error: "Solo puedes calificar cuando el job este COMPLETADO y el pago LIBERADO." } as const;
  }

  const elapsed = Date.now() - job.updatedAt.getTime();
  if (elapsed > REVIEW_WINDOW_MS) {
    return { error: "La ventana de calificacion (7 dias) ya expiro para este job." } as const;
  }

  const alreadyReviewed = await prisma.review.findUnique({
    where: {
      jobId_reviewerId: {
        jobId,
        reviewerId,
      },
    },
  });

  if (alreadyReviewed) {
    return { error: "Ya registraste una calificacion para este job." } as const;
  }

  return { job } as const;
}

async function createReview(params: {
  jobId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  subcategoryRatings: SubcategoryRatingsInput;
  comment: string;
  shouldRecalculateProfessional: boolean;
}) {
  const { jobId, reviewerId, reviewedId, rating, subcategoryRatings, comment, shouldRecalculateProfessional } = params;

  const transactionResult = await prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        jobId,
        reviewerId,
        reviewedId,
        rating,
        subcategoryRatings: subcategoryRatings as Prisma.InputJsonValue,
        comment,
      },
    });

    let assignedBadges: BadgeType[] = [];

    if (shouldRecalculateProfessional) {
      await recalculateProfessionalMetrics(reviewedId, tx);
      assignedBadges = await assignProfessionalBadges(reviewedId, tx);
    }

    return {
      review,
      assignedBadges,
    };
  });

  return transactionResult;
}

export async function reviewProfessional(req: Request, res: Response) {
  const reviewerId = req.user!.userId;
  const { jobId } = req.params;
  const { rating, subcategoryRatings, comment } = req.body as {
    rating?: number;
    subcategoryRatings?: unknown;
    comment?: string;
  };

  const validation = validateReviewInputs({ rating, subcategoryRatings, comment });
  if ("error" in validation) {
    return res.status(400).json({ message: validation.error });
  }

  const allowed = await ensureReviewAllowed({ jobId, reviewerId });
  if ("error" in allowed) {
    return res.status(400).json({ message: allowed.error });
  }

  const { job } = allowed;

  if (job.clientId !== reviewerId) {
    return res.status(403).json({ message: "Solo el cliente puede calificar al profesional." });
  }

  const reviewedName = resolveName(job.professional);

  const result = await createReview({
    jobId,
    reviewerId,
    reviewedId: job.professionalId,
    rating: validation.rating,
    subcategoryRatings: validation.subcategoryRatings,
    comment: validation.comment,
    shouldRecalculateProfessional: true,
  });

  await sendEmail(
    env.emailUser,
    "Tienes una nueva resena - ITIW Connect",
    reviewReceivedTemplate(reviewedName, validation.rating, validation.comment, job.quote.request.description),
  );

  await notifyUser(
    {
      userId: job.professionalId,
      title: "Nueva calificacion recibida",
      body: `Recibiste ${validation.rating}/5 en el trabajo: ${job.quote.request.description}.`,
      type: NotificationType.CALIFICACION,
    },
    {
      emailSubject: "Tienes una nueva resena - ITIW Connect",
    },
  );

  for (const badgeType of result.assignedBadges) {
    await sendEmail(
      env.emailUser,
      "Obtuviste un nuevo badge! - ITIW Connect",
      badgeAwardedTemplate(reviewedName, badgeType),
    );

    await notifyUser(
      {
        userId: job.professionalId,
        title: "Nuevo badge obtenido",
        body: `Obtuviste el badge ${badgeType}.`,
        type: NotificationType.BADGE,
      },
      {
        emailSubject: "Obtuviste un nuevo badge! - ITIW Connect",
      },
    );
  }

  return res.status(201).json({
    message: "Calificacion enviada correctamente.",
    review: result.review,
    assignedBadges: result.assignedBadges,
  });
}

export async function reviewClient(req: Request, res: Response) {
  const reviewerId = req.user!.userId;
  const { jobId } = req.params;
  const { rating, subcategoryRatings, comment } = req.body as {
    rating?: number;
    subcategoryRatings?: unknown;
    comment?: string;
  };

  const validation = validateReviewInputs({ rating, subcategoryRatings, comment });
  if ("error" in validation) {
    return res.status(400).json({ message: validation.error });
  }

  const allowed = await ensureReviewAllowed({ jobId, reviewerId });
  if ("error" in allowed) {
    return res.status(400).json({ message: allowed.error });
  }

  const { job } = allowed;

  if (job.professionalId !== reviewerId) {
    return res.status(403).json({ message: "Solo el profesional puede calificar al cliente." });
  }

  const reviewedName = resolveName(job.client);

  const result = await createReview({
    jobId,
    reviewerId,
    reviewedId: job.clientId,
    rating: validation.rating,
    subcategoryRatings: validation.subcategoryRatings,
    comment: validation.comment,
    shouldRecalculateProfessional: false,
  });

  await sendEmail(
    env.emailUser,
    "Tienes una nueva resena - ITIW Connect",
    reviewReceivedTemplate(reviewedName, validation.rating, validation.comment, job.quote.request.description),
  );

  await notifyUser(
    {
      userId: job.clientId,
      title: "Nueva calificacion recibida",
      body: `Recibiste ${validation.rating}/5 en el trabajo: ${job.quote.request.description}.`,
      type: NotificationType.CALIFICACION,
    },
    {
      emailSubject: "Tienes una nueva resena - ITIW Connect",
    },
  );

  return res.status(201).json({
    message: "Calificacion enviada correctamente.",
    review: result.review,
    assignedBadges: result.assignedBadges,
  });
}

export async function listProfessionalReviews(req: Request, res: Response) {
  const { professionalId } = req.params;

  const professional = await prisma.professionalProfile.findUnique({
    where: { userId: professionalId },
    select: { userId: true },
  });

  if (!professional) {
    return res.status(404).json({ message: "No encontramos el profesional indicado." });
  }

  const reviews = await prisma.review.findMany({
    where: {
      reviewedId: professionalId,
    },
    include: {
      reviewer: {
        select: {
          id: true,
          role: true,
          clientProfile: {
            select: {
              name: true,
            },
          },
          professionalProfile: {
            select: {
              name: true,
            },
          },
        },
      },
      job: {
        select: {
          id: true,
          quote: {
            select: {
              request: {
                select: {
                  id: true,
                  description: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.status(200).json(
    reviews.map((review) => ({
      id: review.id,
      jobId: review.jobId,
      rating: review.rating,
      subcategoryRatings: review.subcategoryRatings,
      comment: review.comment,
      createdAt: review.createdAt,
      reviewer: {
        id: review.reviewer.id,
        role: review.reviewer.role,
        name: resolveName(review.reviewer),
      },
      request: {
        id: review.job.quote.request.id,
        description: review.job.quote.request.description,
      },
    })),
  );
}
