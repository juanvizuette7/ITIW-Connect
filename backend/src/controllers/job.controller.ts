import { JobPaymentStatus, JobStatus, NotificationType, PaymentStatus, Prisma, Role } from "@prisma/client";
import { Request, Response } from "express";
import { env } from "../config/env";
import { sendEmailSafe } from "../config/mailer";
import { prisma } from "../config/prisma";
import {
  badgeAwardedTemplate,
  escrowPaymentTemplate,
  paymentReleasedTemplate,
  rateExperienceTemplate,
} from "../utils/emailTemplates";
import { assignProfessionalBadges } from "../services/reviewBadge.service";
import { notifyManyUsers, notifyUser } from "../services/notification.service";

const COMMISSION_RATE = 0.1;
const ESCROW_HOURS = 72;

function toCop(value: number) {
  return Math.round(value);
}

const jobInclude = {
  payment: true,
  quote: {
    include: {
      request: {
        include: {
          category: true,
        },
      },
      professional: {
        select: {
          id: true,
          role: true,
          professionalProfile: {
            select: {
              name: true,
              badges: true,
            },
          },
          clientProfile: {
            select: {
              name: true,
            },
          },
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
          badges: true,
        },
      },
    },
  },
  professional: {
    select: {
      id: true,
      role: true,
      professionalProfile: {
        select: {
          name: true,
          badges: true,
        },
      },
      clientProfile: {
        select: {
          name: true,
        },
      },
    },
  },
  reviews: {
    select: {
      id: true,
      reviewerId: true,
      reviewedId: true,
      createdAt: true,
    },
  },
} as const;

type JobWithRelations = Prisma.JobGetPayload<{
  include: typeof jobInclude;
}>;

function getDisplayName(user: {
  role: Role;
  clientProfile: { name: string } | null;
  professionalProfile: { name: string; badges?: string[] } | null;
}) {
  if (user.role === "CLIENTE") {
    return user.clientProfile?.name || "Cliente";
  }
  return user.professionalProfile?.name || "Profesional";
}

function mapJob(job: JobWithRelations) {
  const clientName = getDisplayName(job.client);
  const professionalName = getDisplayName(job.professional);

  const hasReviewedProfessional = job.reviews.some(
    (review) => review.reviewerId === job.clientId && review.reviewedId === job.professionalId,
  );
  const hasReviewedClient = job.reviews.some(
    (review) => review.reviewerId === job.professionalId && review.reviewedId === job.clientId,
  );

  return {
    id: job.id,
    quoteId: job.quoteId,
    status: job.status,
    paymentStatus: job.paymentStatus,
    escrowReleaseAt: job.escrowReleaseAt,
    clientConfirmed: job.clientConfirmed,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    amountCop: job.quote.amountCop,
    estimatedHours: job.quote.estimatedHours,
    request: {
      id: job.quote.request.id,
      description: job.quote.request.description,
      status: job.quote.request.status,
      category: job.quote.request.category,
    },
    client: {
      id: job.client.id,
      name: clientName,
    },
    professional: {
      id: job.professional.id,
      name: professionalName,
      badges: job.professional.professionalProfile?.badges || [],
    },
    payment: job.payment
      ? {
          id: job.payment.id,
          amountCop: job.payment.amountCop,
          commissionCop: job.payment.commissionCop,
          netProfessionalCop: job.payment.netProfessionalCop,
          status: job.payment.status,
          createdAt: job.payment.createdAt,
        }
      : null,
    hasReviewedProfessional,
    hasReviewedClient,
  };
}

export async function createOrConfirmEscrowPayment(req: Request, res: Response) {
  const clientId = req.user!.userId;
  const { jobId } = req.params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: jobInclude,
  });

  if (!job) {
    return res.status(404).json({ message: "No encontramos el job indicado." });
  }

  if (job.clientId !== clientId) {
    return res.status(403).json({ message: "Solo el cliente del job puede procesar el pago." });
  }

  if (job.paymentStatus === JobPaymentStatus.LIBERADO) {
    return res.status(400).json({ message: "Este job ya tiene el pago liberado." });
  }

  if (job.paymentStatus === JobPaymentStatus.RETENIDO) {
    return res.status(200).json({
      message: "El pago ya esta retenido de forma segura en escrow.",
      job: mapJob(job),
      payment: job.payment,
    });
  }

  const serviceCop = toCop(job.quote.amountCop);
  const commissionCop = toCop(serviceCop * COMMISSION_RATE);
  const amountCop = serviceCop + commissionCop;
  const netProfessionalCop = serviceCop;
  const simulatedPaymentId =
    job.payment?.stripePaymentIntentId || `simulated_escrow_${job.id}_${Date.now()}`;

  const updated = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.upsert({
      where: { jobId: job.id },
      create: {
        jobId: job.id,
        stripePaymentIntentId: simulatedPaymentId,
        amountCop,
        commissionCop,
        netProfessionalCop,
        status: PaymentStatus.COMPLETADO,
      },
      update: {
        stripePaymentIntentId: simulatedPaymentId,
        amountCop,
        commissionCop,
        netProfessionalCop,
        status: PaymentStatus.COMPLETADO,
      },
    });

    const updatedJob = await tx.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.EN_PROGRESO,
        paymentStatus: JobPaymentStatus.RETENIDO,
        escrowReleaseAt: new Date(Date.now() + ESCROW_HOURS * 60 * 60 * 1000),
      },
      include: jobInclude,
    });

    return { payment, updatedJob };
  });

  void sendEmailSafe(
    env.emailUser,
    "Tu pago esta seguro en escrow - ITIW Connect",
    escrowPaymentTemplate(updated.payment.amountCop, updated.updatedJob.quote.request.description),
  );

  await notifyManyUsers(
    {
      userIds: [updated.updatedJob.clientId, updated.updatedJob.professionalId],
      title: "Pago procesado en escrow",
      body: `El pago del trabajo "${updated.updatedJob.quote.request.description}" esta retenido de forma segura.`,
      type: NotificationType.PAGO,
    },
    {
      emailSubject: "Tu pago esta seguro en escrow - ITIW Connect",
    },
  );

  return res.status(200).json({
    message: "Pago procesado. Tu dinero esta seguro en escrow.",
    job: mapJob(updated.updatedJob),
    payment: {
      id: updated.payment.id,
      amountCop: updated.payment.amountCop,
      commissionCop: updated.payment.commissionCop,
      netProfessionalCop: updated.payment.netProfessionalCop,
      status: updated.payment.status,
      createdAt: updated.payment.createdAt,
    },
  });
}

export async function confirmJobCompletion(req: Request, res: Response) {
  const clientId = req.user!.userId;
  const { jobId } = req.params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: jobInclude,
  });

  if (!job) {
    return res.status(404).json({ message: "No encontramos el job indicado." });
  }

  if (job.clientId !== clientId) {
    return res.status(403).json({ message: "Solo el cliente puede confirmar la finalizacion del trabajo." });
  }

  if (job.paymentStatus !== JobPaymentStatus.RETENIDO) {
    return res.status(400).json({ message: "El pago del job debe estar retenido para liberarlo." });
  }

  if (!job.payment) {
    return res.status(400).json({ message: "No encontramos el registro de pago para este job." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { jobId: job.id },
      data: {
        status: PaymentStatus.COMPLETADO,
      },
    });

    const releasedJob = await tx.job.update({
      where: { id: job.id },
      data: {
        clientConfirmed: true,
        status: JobStatus.COMPLETADO,
        paymentStatus: JobPaymentStatus.LIBERADO,
      },
      include: jobInclude,
    });

    await tx.professionalProfile.update({
      where: { userId: releasedJob.professionalId },
      data: {
        totalJobs: {
          increment: 1,
        },
      },
    });

    const assignedBadges = await assignProfessionalBadges(releasedJob.professionalId, tx);

    return { releasedJob, assignedBadges };
  });

  void sendEmailSafe(
    env.emailUser,
    "Pago liberado al profesional - ITIW Connect",
    paymentReleasedTemplate(updated.releasedJob.quote.amountCop, updated.releasedJob.quote.request.description, false),
  );

  await notifyManyUsers(
    {
      userIds: [updated.releasedJob.clientId, updated.releasedJob.professionalId],
      title: "Pago liberado",
      body: `El pago del trabajo "${updated.releasedJob.quote.request.description}" fue liberado correctamente.`,
      type: NotificationType.PAGO,
    },
    {
      emailSubject: "Pago liberado al profesional - ITIW Connect",
    },
  );

  void sendEmailSafe(
    env.emailUser,
    "Califica tu experiencia! - ITIW Connect",
    rateExperienceTemplate(
      updated.releasedJob.quote.request.description,
      `${env.frontendUrl}/dashboard/job/${updated.releasedJob.id}/calificar`,
    ),
  );

  for (const badgeType of updated.assignedBadges) {
    void sendEmailSafe(
      env.emailUser,
      "Obtuviste un nuevo badge! - ITIW Connect",
      badgeAwardedTemplate(getDisplayName(updated.releasedJob.professional), badgeType),
    );

    await notifyUser(
      {
        userId: updated.releasedJob.professionalId,
        title: "Nuevo badge obtenido",
        body: `Ganaste el badge ${badgeType}.`,
        type: NotificationType.BADGE,
      },
      {
        emailSubject: "Obtuviste un nuevo badge! - ITIW Connect",
      },
    );
  }

  return res.status(200).json({
    message: "Pago liberado al profesional.",
    job: mapJob(updated.releasedJob),
  });
}

export async function listMyJobs(req: Request, res: Response) {
  const userId = req.user!.userId;

  const jobs = await prisma.job.findMany({
    where: {
      OR: [{ clientId: userId }, { professionalId: userId }],
    },
    include: jobInclude,
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.status(200).json(jobs.map(mapJob));
}

export async function getJobDetail(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { jobId } = req.params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: jobInclude,
  });

  if (!job) {
    return res.status(404).json({ message: "No encontramos el job solicitado." });
  }

  if (job.clientId !== userId && job.professionalId !== userId) {
    return res.status(403).json({ message: "No tienes permiso para ver este job." });
  }

  return res.status(200).json(mapJob(job));
}
