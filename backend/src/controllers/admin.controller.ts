import { NotificationType, Prisma, Role } from "@prisma/client";
import { Request, Response } from "express";
import { env } from "../config/env";
import { sendEmailSafe } from "../config/mailer";
import { prisma } from "../config/prisma";
import {
  adminApprovalTemplate,
  adminRejectionTemplate,
  notificationEventTemplate,
} from "../utils/emailTemplates";
import { assignProfessionalBadges } from "../services/reviewBadge.service";
import { notifyUser } from "../services/notification.service";

type RejectBody = {
  reason?: string;
};

type DeactivateBody = {
  reason?: string;
};

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  return Number(value || 0);
}

function computeNpsMetrics(scores: number[]) {
  if (scores.length === 0) {
    return {
      total: 0,
      averageScore: 0,
      nps: 0,
      promoters: 0,
      detractors: 0,
    };
  }

  const promoters = scores.filter((score) => score >= 9).length;
  const detractors = scores.filter((score) => score <= 6).length;
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const nps = ((promoters - detractors) / scores.length) * 100;

  return {
    total: scores.length,
    averageScore: Number(averageScore.toFixed(2)),
    nps: Number(nps.toFixed(2)),
    promoters,
    detractors,
  };
}

export async function listAdminProfessionals(_req: Request, res: Response) {
  const statusFilter = String(_req.query.status || "").trim().toUpperCase();
  const searchFilter = String(_req.query.search || "").trim().toLowerCase();

  const professionals = await prisma.user.findMany({
    where: {
      role: Role.PROFESIONAL,
    },
    select: {
      id: true,
      email: true,
      phone: true,
      isActive: true,
      isIdentityVerified: true,
      createdAt: true,
      professionalProfile: {
        select: {
          name: true,
          verificationStatus: true,
          verificationNotes: true,
          verifiedBadge: true,
          aiScore: true,
          totalJobs: true,
          avgRating: true,
          reviewCount: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const mapped = professionals.map((professional) => {
    const profile = professional.professionalProfile;
    const storedStatus = (profile?.verificationStatus || "PENDIENTE").toUpperCase();
    const verificationStatus = !professional.isActive
      ? "DESACTIVADO"
      : storedStatus === "PENDIENTE" && (profile?.verifiedBadge || professional.isIdentityVerified)
      ? "APROBADO"
      : storedStatus;

    return {
      id: professional.id,
      name: profile?.name || professional.email,
      email: professional.email,
      phone: professional.phone,
      isActive: professional.isActive,
      verificationStatus,
      verificationNotes: profile?.verificationNotes || null,
      aiScore: Number(profile?.aiScore || 0),
      totalJobs: Number(profile?.totalJobs || 0),
      avgRating: Number(profile?.avgRating || 0),
      reviewCount: Number(profile?.reviewCount || 0),
      createdAt: professional.createdAt,
    };
  });

  const filtered = mapped.filter((professional) => {
    const matchesSearch =
      !searchFilter ||
      professional.name.toLowerCase().includes(searchFilter) ||
      professional.email.toLowerCase().includes(searchFilter);

    if (!matchesSearch) {
      return false;
    }

    if (!statusFilter || statusFilter === "TODOS") {
      return true;
    }

    if (statusFilter === "PENDIENTE") {
      return professional.verificationStatus === "PENDIENTE";
    }

    if (statusFilter === "APROBADO") {
      return professional.verificationStatus === "APROBADO";
    }

    if (statusFilter === "RECHAZADO") {
      return professional.verificationStatus === "RECHAZADO";
    }

    if (statusFilter === "DESACTIVADO") {
      return professional.verificationStatus === "DESACTIVADO";
    }

    return true;
  });

  return res.status(200).json(filtered);
}

export async function approveProfessional(req: Request, res: Response) {
  const { id } = req.params;

  const professional = await prisma.user.findUnique({
    where: { id },
    include: {
      professionalProfile: true,
    },
  });

  if (!professional || professional.role !== Role.PROFESIONAL || !professional.professionalProfile) {
    return res.status(404).json({ message: "No encontramos el profesional solicitado." });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        isIdentityVerified: true,
        isActive: true,
        deactivationReason: null,
        deactivatedAt: null,
      },
    });

    await tx.professionalProfile.update({
      where: { userId: id },
      data: {
        verificationStatus: "APROBADO",
        verificationNotes: null,
        verifiedBadge: true,
      },
    });

    await assignProfessionalBadges(id, tx);
  });

  await notifyUser(
    {
      userId: id,
      title: "Perfil aprobado",
      body: "Tu perfil profesional fue aprobado y ya cuenta con badge VERIFICADO.",
      type: NotificationType.BADGE,
    },
    {
      emailSubject: "Tu perfil fue aprobado — ITIW Connect",
    },
  );

  void sendEmailSafe(
    env.emailUser,
    "Tu perfil fue aprobado — ITIW Connect",
    adminApprovalTemplate(professional.professionalProfile.name, "VERIFICADO"),
  );

  return res.status(200).json({ message: "Perfil profesional aprobado correctamente." });
}

export async function rejectProfessional(req: Request, res: Response) {
  const { id } = req.params;
  const { reason } = req.body as RejectBody;

  if (!reason || reason.trim().length < 8) {
    return res.status(400).json({ message: "Debes indicar un motivo de rechazo de al menos 8 caracteres." });
  }

  const professional = await prisma.user.findUnique({
    where: { id },
    include: {
      professionalProfile: true,
    },
  });

  if (!professional || professional.role !== Role.PROFESIONAL || !professional.professionalProfile) {
    return res.status(404).json({ message: "No encontramos el profesional solicitado." });
  }

  await prisma.professionalProfile.update({
    where: { userId: id },
    data: {
      verificationStatus: "RECHAZADO",
      verificationNotes: reason.trim(),
      verifiedBadge: false,
    },
  });

  await notifyUser(
    {
      userId: id,
      title: "Perfil necesita ajustes",
      body: "Tu perfil fue revisado y necesita ajustes para ser aprobado.",
      type: NotificationType.SISTEMA,
    },
    {
      emailSubject: "Tu perfil necesita ajustes — ITIW Connect",
    },
  );

  void sendEmailSafe(
    env.emailUser,
    "Tu perfil necesita ajustes — ITIW Connect",
    adminRejectionTemplate(professional.professionalProfile.name, reason.trim()),
  );

  return res.status(200).json({ message: "Perfil profesional rechazado con motivo registrado." });
}

export async function deactivateProfessional(req: Request, res: Response) {
  const { id } = req.params;
  const { reason } = req.body as DeactivateBody;

  const professional = await prisma.user.findUnique({
    where: { id },
    include: {
      professionalProfile: true,
    },
  });

  if (!professional || professional.role !== Role.PROFESIONAL || !professional.professionalProfile) {
    return res.status(404).json({ message: "No encontramos el profesional solicitado." });
  }

  await prisma.user.update({
    where: { id },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivationReason: reason?.trim() || "Desactivacion administrativa temporal.",
    },
  });

  await prisma.professionalProfile.update({
    where: { userId: id },
    data: {
      verificationStatus: "DESACTIVADO",
      verificationNotes: reason?.trim() || "Cuenta desactivada temporalmente por administracion.",
    },
  });

  void sendEmailSafe(
    env.emailUser,
    "Cuenta profesional desactivada — ITIW Connect",
    notificationEventTemplate(
      "Cuenta profesional desactivada",
      `Se desactivo temporalmente la cuenta de ${professional.professionalProfile.name}. Motivo: ${
        reason?.trim() || "No especificado"
      }`,
    ),
  );

  return res.status(200).json({ message: "Cuenta profesional desactivada correctamente." });
}

export async function getAdminStats(_req: Request, res: Response) {
  const { start, end } = monthRange();

  const [
    activeProfessionals,
    totalClients,
    monthRequests,
    requestsInMonth,
    monthRequestsWithPaidJob,
    payments,
    npsResponses,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: Role.PROFESIONAL,
        isActive: true,
      },
    }),
    prisma.user.count({
      where: {
        role: Role.CLIENTE,
        isActive: true,
      },
    }),
    prisma.serviceRequest.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    }),
    prisma.serviceRequest.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      select: {
        createdAt: true,
      },
    }),
    prisma.serviceRequest.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        quotes: {
          some: {
            job: {
              is: {
                paymentStatus: {
                  in: ["RETENIDO", "LIBERADO", "REEMBOLSADO"],
                },
              },
            },
          },
        },
      },
    }),
    prisma.payment.findMany({
      select: {
        amountCop: true,
        commissionCop: true,
      },
    }),
    prisma.npsResponse.findMany({
      include: {
        user: {
          select: {
            role: true,
          },
        },
      },
    }),
  ]);

  const conversionRate = monthRequests > 0 ? (monthRequestsWithPaidJob / monthRequests) * 100 : 0;
  const ticketAverage =
    payments.length > 0
      ? payments.reduce((sum, payment) => sum + payment.amountCop, 0) / payments.length
      : 0;
  const totalRevenue = payments.reduce((sum, payment) => sum + payment.commissionCop, 0);

  const clientScores = npsResponses
    .filter((item) => item.user.role === Role.CLIENTE)
    .map((item) => item.score);
  const professionalScores = npsResponses
    .filter((item) => item.user.role === Role.PROFESIONAL)
    .map((item) => item.score);
  const globalScores = npsResponses.map((item) => item.score);

  const clientNps = computeNpsMetrics(clientScores);
  const professionalNps = computeNpsMetrics(professionalScores);
  const globalNps = computeNpsMetrics(globalScores);

  const requestsByWeek = [
    { label: "Semana 1", value: 0 },
    { label: "Semana 2", value: 0 },
    { label: "Semana 3", value: 0 },
    { label: "Semana 4", value: 0 },
    { label: "Semana 5", value: 0 },
  ];

  for (const request of requestsInMonth) {
    const day = request.createdAt.getDate();
    const weekIndex = Math.min(4, Math.floor((day - 1) / 7));
    requestsByWeek[weekIndex].value += 1;
  }

  return res.status(200).json({
    totalProfessionalsActive: activeProfessionals,
    totalClients,
    requestsMonth: monthRequests,
    conversionRate: Number(conversionRate.toFixed(2)),
    averageTicketCop: Number(ticketAverage.toFixed(2)),
    totalRevenueCop: Number(totalRevenue.toFixed(2)),
    npsAverage: globalNps.averageScore,
    npsClientes: clientNps,
    npsProfesionales: professionalNps,
    requestsByWeek,
  });
}

export async function getAdminNps(_req: Request, res: Response) {
  const responses = await prisma.npsResponse.findMany({
    include: {
      user: {
        select: {
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const clientScores = responses
    .filter((item) => item.user.role === Role.CLIENTE)
    .map((item) => item.score);
  const professionalScores = responses
    .filter((item) => item.user.role === Role.PROFESIONAL)
    .map((item) => item.score);

  return res.status(200).json({
    clientes: computeNpsMetrics(clientScores),
    profesionales: computeNpsMetrics(professionalScores),
    totalResponses: responses.length,
    recentResponses: responses.slice(0, 20).map((response) => ({
      id: response.id,
      jobId: response.jobId,
      userId: response.userId,
      role: response.user.role,
      score: response.score,
      comment: response.comment,
      createdAt: response.createdAt,
    })),
  });
}
