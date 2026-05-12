import { DisputeStatus, JobPaymentStatus, JobStatus, NotificationType, PaymentStatus, Role } from "@prisma/client";
import { Request, Response } from "express";
import { env } from "../config/env";
import { sendEmailSafe } from "../config/mailer";
import { prisma } from "../config/prisma";
import { notifyManyUsers } from "../services/notification.service";
import { disputeOpenedTemplate, notificationEventTemplate } from "../utils/emailTemplates";

const DISPUTE_WINDOW_MS = 72 * 60 * 60 * 1000;

type ResolveDisputeBody = {
  resolution?: string;
  outcome?: "LIBERAR" | "REEMBOLSAR";
};

function resolveName(user: {
  role: Role;
  clientProfile: { name: string } | null;
  professionalProfile: { name: string } | null;
}) {
  if (user.role === "CLIENTE") {
    return user.clientProfile?.name || "Cliente";
  }
  if (user.role === "PROFESIONAL") {
    return user.professionalProfile?.name || "Profesional";
  }
  return user.clientProfile?.name || user.professionalProfile?.name || "Administrador";
}

function mapDispute(dispute: {
  id: string;
  jobId: string;
  openedBy: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolution: string | null;
  createdAt: Date;
  updatedAt: Date;
  job: {
    id: string;
    status: JobStatus;
    paymentStatus: JobPaymentStatus;
    createdAt: Date;
    updatedAt: Date;
    payment: {
      status: PaymentStatus;
      amountCop: number;
      commissionCop: number;
      netProfessionalCop: number;
      createdAt: Date;
    } | null;
    quote: {
      request: {
        id: string;
        description: string;
        status: string;
        category: {
          id: string;
          name: string;
          iconUrl: string | null;
          createdAt: Date;
          updatedAt: Date;
        };
      };
    };
  };
}) {
  return {
    id: dispute.id,
    jobId: dispute.jobId,
    openedBy: dispute.openedBy,
    reason: dispute.reason,
    description: dispute.description,
    status: dispute.status,
    resolution: dispute.resolution,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
    job: {
      id: dispute.job.id,
      status: dispute.job.status,
      paymentStatus: dispute.job.paymentStatus,
      createdAt: dispute.job.createdAt,
      updatedAt: dispute.job.updatedAt,
      payment: dispute.job.payment,
      request: {
        id: dispute.job.quote.request.id,
        description: dispute.job.quote.request.description,
        status: dispute.job.quote.request.status,
        category: dispute.job.quote.request.category,
      },
    },
  };
}

export async function openDispute(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { jobId } = req.params;
  const { reason, description } = req.body as { reason?: string; description?: string };

  if (!reason || !reason.trim() || !description || !description.trim()) {
    return res.status(400).json({ message: "Debes enviar motivo y descripcion de la disputa." });
  }

  if (reason.trim().length < 3 || reason.trim().length > 120) {
    return res.status(400).json({ message: "El motivo debe tener entre 3 y 120 caracteres." });
  }

  if (description.trim().length < 20 || description.trim().length > 1200) {
    return res.status(400).json({ message: "La descripcion debe tener entre 20 y 1200 caracteres." });
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      dispute: true,
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
          clientProfile: { select: { name: true } },
          professionalProfile: { select: { name: true } },
        },
      },
      professional: {
        select: {
          id: true,
          role: true,
          clientProfile: { select: { name: true } },
          professionalProfile: { select: { name: true } },
        },
      },
    },
  });

  if (!job) {
    return res.status(404).json({ message: "No encontramos el job indicado." });
  }

  if (job.clientId !== userId && job.professionalId !== userId) {
    return res.status(403).json({ message: "Solo participantes del job pueden abrir una disputa." });
  }

  if (job.dispute) {
    return res.status(400).json({ message: "Este job ya tiene una disputa abierta o resuelta." });
  }

  if (job.status !== JobStatus.COMPLETADO || job.paymentStatus !== JobPaymentStatus.LIBERADO) {
    return res.status(400).json({ message: "Solo puedes abrir disputa cuando el job este completado y con pago liberado." });
  }

  const elapsed = Date.now() - job.updatedAt.getTime();
  if (elapsed > DISPUTE_WINDOW_MS) {
    return res.status(400).json({ message: "La disputa solo puede abrirse dentro de las primeras 72 horas." });
  }

  const dispute = await prisma.$transaction(async (tx) => {
    await tx.job.update({
      where: { id: job.id },
      data: {
        paymentStatus: JobPaymentStatus.RETENIDO,
      },
    });

    return tx.dispute.create({
      data: {
        jobId: job.id,
        openedBy: userId,
        reason: reason.trim(),
        description: description.trim(),
        status: DisputeStatus.ABIERTA,
      },
    });
  });

  const openedByName = userId === job.clientId ? resolveName(job.client) : resolveName(job.professional);

  await notifyManyUsers(
    {
      userIds: [job.clientId, job.professionalId],
      title: "Disputa abierta",
      body: `Se abrio una disputa para el job ${job.id}. Motivo: ${reason.trim()}.`,
      type: NotificationType.DISPUTA,
    },
    {
      emailSubject: "Nueva disputa abierta � ITIW Connect",
    },
  );

  void sendEmailSafe(
    env.emailUser,
    "Nueva disputa abierta � ITIW Connect",
    disputeOpenedTemplate(openedByName, reason.trim(), description.trim(), job.quote.request.description),
  );

  return res.status(201).json({
    message: "Disputa abierta correctamente. El pago quedo retenido en revision.",
    dispute,
  });
}

export async function listMyDisputes(req: Request, res: Response) {
  const userId = req.user!.userId;
  const role = req.user!.role;

  const disputes = await prisma.dispute.findMany({
    where:
      role === "ADMIN"
        ? undefined
        : {
            OR: [
              { openedBy: userId },
              { job: { clientId: userId } },
              { job: { professionalId: userId } },
            ],
          },
    include: {
      job: {
        include: {
          payment: {
            select: {
              status: true,
              amountCop: true,
              commissionCop: true,
              netProfessionalCop: true,
              createdAt: true,
            },
          },
          quote: {
            include: {
              request: {
                include: {
                  category: true,
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

  return res.status(200).json(disputes.map(mapDispute));
}

export async function getDisputeDetail(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      job: {
        include: {
          quote: {
            include: {
              request: {
                include: {
                  category: true,
                },
              },
            },
          },
          payment: {
            select: {
              status: true,
              amountCop: true,
              commissionCop: true,
              netProfessionalCop: true,
              createdAt: true,
            },
          },
        },
      },
      openedByUser: {
        select: {
          id: true,
          role: true,
          clientProfile: { select: { name: true } },
          professionalProfile: { select: { name: true } },
        },
      },
    },
  });

  if (!dispute) {
    return res.status(404).json({ message: "No encontramos la disputa indicada." });
  }

  if (
    req.user!.role !== "ADMIN" &&
    dispute.openedBy !== userId &&
    dispute.job.clientId !== userId &&
    dispute.job.professionalId !== userId
  ) {
    return res.status(403).json({ message: "No tienes permiso para ver esta disputa." });
  }

  return res.status(200).json({
    ...mapDispute(dispute),
    openedByUser: {
      id: dispute.openedByUser.id,
      role: dispute.openedByUser.role,
      name: resolveName(dispute.openedByUser),
    },
  });
}

export async function resolveDispute(req: Request, res: Response) {
  const { id } = req.params;
  const { resolution, outcome } = req.body as ResolveDisputeBody;

  if (!resolution || !resolution.trim() || !outcome) {
    return res.status(400).json({ message: "Debes enviar outcome (LIBERAR o REEMBOLSAR) y resolution." });
  }

  if (resolution.trim().length < 10 || resolution.trim().length > 1200) {
    return res.status(400).json({ message: "La resolucion debe tener entre 10 y 1200 caracteres." });
  }

  if (!["LIBERAR", "REEMBOLSAR"].includes(outcome)) {
    return res.status(400).json({ message: "El outcome debe ser LIBERAR o REEMBOLSAR." });
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      job: {
        include: {
          payment: true,
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
      },
    },
  });

  if (!dispute) {
    return res.status(404).json({ message: "No encontramos la disputa indicada." });
  }

  if (dispute.status === DisputeStatus.RESUELTA || dispute.status === DisputeStatus.CERRADA) {
    return res.status(400).json({ message: "La disputa ya fue resuelta previamente." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (outcome === "LIBERAR") {
      await tx.job.update({
        where: { id: dispute.jobId },
        data: {
          paymentStatus: JobPaymentStatus.LIBERADO,
          status: JobStatus.COMPLETADO,
        },
      });

      if (dispute.job.payment) {
        await tx.payment.update({
          where: { jobId: dispute.jobId },
          data: { status: PaymentStatus.COMPLETADO },
        });
      }
    }

    if (outcome === "REEMBOLSAR") {
      await tx.job.update({
        where: { id: dispute.jobId },
        data: {
          paymentStatus: JobPaymentStatus.REEMBOLSADO,
          status: JobStatus.CANCELADO,
        },
      });

      if (dispute.job.payment) {
        await tx.payment.update({
          where: { jobId: dispute.jobId },
          data: { status: PaymentStatus.REEMBOLSADO },
        });
      }
    }

    return tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: DisputeStatus.RESUELTA,
        resolution: resolution.trim(),
      },
    });
  });

  const notificationMessage =
    outcome === "LIBERAR"
      ? "La disputa fue resuelta y el pago fue liberado."
      : "La disputa fue resuelta y el pago fue marcado como reembolsado.";

  await notifyManyUsers(
    {
      userIds: [dispute.job.clientId, dispute.job.professionalId],
      title: "Disputa resuelta",
      body: notificationMessage,
      type: NotificationType.DISPUTA,
    },
    {
      emailSubject: "Disputa resuelta - ITIW Connect",
    },
  );

  void sendEmailSafe(
    env.emailUser,
    "Disputa resuelta - ITIW Connect",
    notificationEventTemplate(
      "Disputa resuelta",
      `${notificationMessage} Trabajo: ${dispute.job.quote.request.description}. Resolucion: ${resolution.trim()}`,
    ),
  );

  return res.status(200).json({
    message: "Disputa resuelta correctamente.",
    dispute: updated,
  });
}
