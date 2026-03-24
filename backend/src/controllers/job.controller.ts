import { JobPaymentStatus, JobStatus, PaymentStatus, Prisma, Role } from "@prisma/client";
import { Request, Response } from "express";
import { env } from "../config/env";
import { sendEmail } from "../config/mailer";
import {
  capturePaymentIntent,
  createPaymentIntent,
  getPaymentIntentClientSecret,
  validatePaymentIntentForEscrow,
} from "../config/stripe";
import { prisma } from "../config/prisma";
import {
  escrowPaymentTemplate,
  paymentReleasedTemplate,
} from "../utils/emailTemplates";

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
        },
      },
      clientProfile: {
        select: {
          name: true,
        },
      },
    },
  },
} as const;

type JobWithRelations = Prisma.JobGetPayload<{
  include: typeof jobInclude;
}>;

function getDisplayName(user: {
  role: Role;
  clientProfile: { name: string } | null;
  professionalProfile: { name: string } | null;
}) {
  if (user.role === "CLIENTE") {
    return user.clientProfile?.name || "Cliente";
  }
  return user.professionalProfile?.name || "Profesional";
}

function mapJob(job: JobWithRelations) {
  const clientName = getDisplayName(job.client);
  const professionalName = getDisplayName(job.professional);

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
    },
    payment: job.payment
      ? {
          id: job.payment.id,
          stripePaymentIntentId: job.payment.stripePaymentIntentId,
          amountCop: job.payment.amountCop,
          commissionCop: job.payment.commissionCop,
          netProfessionalCop: job.payment.netProfessionalCop,
          status: job.payment.status,
          createdAt: job.payment.createdAt,
        }
      : null,
  };
}

export async function createOrConfirmEscrowPayment(req: Request, res: Response) {
  const clientId = req.user!.userId;
  const { jobId } = req.params;
  const { action, paymentIntentId } = req.body as {
    action?: "create" | "confirm";
    paymentIntentId?: string;
  };

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

  const selectedAction = action || "create";

  if (selectedAction === "create") {
    const amountCop = toCop(job.quote.amountCop);
    const commissionCop = toCop(amountCop * COMMISSION_RATE);
    const netProfessionalCop = toCop(amountCop - commissionCop);

    let clientSecret = "";
    let stripePaymentIntentId = job.payment?.stripePaymentIntentId;

    if (stripePaymentIntentId) {
      clientSecret = await getPaymentIntentClientSecret(stripePaymentIntentId);
    } else {
      const intent = await createPaymentIntent(job.id, amountCop);
      stripePaymentIntentId = intent.id;
      clientSecret = intent.clientSecret;
    }

    const payment = await prisma.payment.upsert({
      where: { jobId: job.id },
      create: {
        jobId: job.id,
        stripePaymentIntentId,
        amountCop,
        commissionCop,
        netProfessionalCop,
        status: PaymentStatus.PENDIENTE,
      },
      update: {
        stripePaymentIntentId,
        amountCop,
        commissionCop,
        netProfessionalCop,
      },
    });

    return res.status(200).json({
      message: "PaymentIntent generado correctamente.",
      clientSecret,
      paymentIntentId: stripePaymentIntentId,
      payment,
      amountCop,
      commissionCop,
      netProfessionalCop,
    });
  }

  const existingPayment = await prisma.payment.findUnique({
    where: { jobId: job.id },
  });

  if (!existingPayment) {
    return res.status(400).json({ message: "Primero debes iniciar el pago del job." });
  }

  if (paymentIntentId && paymentIntentId !== existingPayment.stripePaymentIntentId) {
    return res.status(400).json({ message: "El PaymentIntent no coincide con el registrado para este job." });
  }

  const isValidIntent = await validatePaymentIntentForEscrow(existingPayment.stripePaymentIntentId);
  if (!isValidIntent) {
    return res.status(400).json({ message: "El pago no fue confirmado por Stripe. Intenta nuevamente." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { jobId: job.id },
      data: {
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

  await sendEmail(
    env.emailUser,
    "Tu pago esta seguro en escrow - ITIW Connect",
    escrowPaymentTemplate(updated.updatedJob.quote.amountCop, updated.updatedJob.quote.request.description),
  );

  return res.status(200).json({
    message: "Pago procesado y retenido en escrow correctamente.",
    job: mapJob(updated.updatedJob),
    payment: updated.payment,
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

  await capturePaymentIntent(job.payment.stripePaymentIntentId);

  const updatedJob = await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { jobId: job.id },
      data: {
        status: PaymentStatus.COMPLETADO,
      },
    });

    return tx.job.update({
      where: { id: job.id },
      data: {
        clientConfirmed: true,
        status: JobStatus.COMPLETADO,
        paymentStatus: JobPaymentStatus.LIBERADO,
      },
      include: jobInclude,
    });
  });

  await sendEmail(
    env.emailUser,
    "Pago liberado al profesional - ITIW Connect",
    paymentReleasedTemplate(updatedJob.quote.amountCop, updatedJob.quote.request.description, false),
  );

  return res.status(200).json({
    message: "Trabajo confirmado y pago liberado al profesional.",
    job: mapJob(updatedJob),
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
