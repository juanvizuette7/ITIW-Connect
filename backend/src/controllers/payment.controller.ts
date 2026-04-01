import { PaymentStatus, Role } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/prisma";

type PaymentHistoryQuery = {
  fechaInicio?: string;
  fechaFin?: string;
  status?: PaymentStatus;
  montoMinimo?: string;
  montoMaximo?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: string;
  maxAmount?: string;
};

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseNumber(value?: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

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

export async function getPaymentHistory(req: Request, res: Response) {
  const userId = req.user!.userId;
  const role = req.user!.role;

  const query = req.query as PaymentHistoryQuery;
  const startDate = parseDate(query.fechaInicio || query.startDate);
  const endDate = parseDate(query.fechaFin || query.endDate);
  const minAmount = parseNumber(query.montoMinimo || query.minAmount);
  const maxAmount = parseNumber(query.montoMaximo || query.maxAmount);
  const status = query.status;

  if ((query.fechaInicio || query.startDate) && !startDate) {
    return res.status(400).json({ message: "La fecha de inicio no tiene un formato valido." });
  }

  if ((query.fechaFin || query.endDate) && !endDate) {
    return res.status(400).json({ message: "La fecha de fin no tiene un formato valido." });
  }

  if ((query.montoMinimo || query.minAmount) && minAmount === null) {
    return res.status(400).json({ message: "El monto minimo no tiene un formato valido." });
  }

  if ((query.montoMaximo || query.maxAmount) && maxAmount === null) {
    return res.status(400).json({ message: "El monto maximo no tiene un formato valido." });
  }

  if (status && !Object.values(PaymentStatus).includes(status)) {
    return res.status(400).json({ message: "El estado de pago no es valido." });
  }

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (startDate) createdAtFilter.gte = startDate;
  if (endDate) createdAtFilter.lte = endDate;

  const payments = await prisma.payment.findMany({
    where: {
      ...(Object.keys(createdAtFilter).length > 0 ? { createdAt: createdAtFilter } : {}),
      ...(status ? { status } : {}),
      ...(minAmount !== null || maxAmount !== null
        ? {
            amountCop: {
              ...(minAmount !== null ? { gte: minAmount } : {}),
              ...(maxAmount !== null ? { lte: maxAmount } : {}),
            },
          }
        : {}),
      job: role === "CLIENTE" ? { clientId: userId } : { professionalId: userId },
    },
    include: {
      job: {
        include: {
          client: {
            select: {
              role: true,
              clientProfile: {
                select: { name: true },
              },
              professionalProfile: {
                select: { name: true },
              },
            },
          },
          professional: {
            select: {
              role: true,
              clientProfile: {
                select: { name: true },
              },
              professionalProfile: {
                select: { name: true },
              },
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

  const totals = payments.reduce(
    (acc, payment) => {
      acc.totalPagado += payment.amountCop;
      acc.totalComisiones += payment.commissionCop;
      acc.totalNeto += payment.netProfessionalCop;
      return acc;
    },
    {
      totalPagado: 0,
      totalComisiones: 0,
      totalNeto: 0,
    },
  );

  return res.status(200).json({
    totals,
    items: payments.map((payment) => ({
      id: payment.id,
      jobId: payment.jobId,
      status: payment.status,
      amountCop: payment.amountCop,
      commissionCop: payment.commissionCop,
      netProfessionalCop: payment.netProfessionalCop,
      createdAt: payment.createdAt,
      request: {
        id: payment.job.quote.request.id,
        description: payment.job.quote.request.description,
        category: payment.job.quote.request.category,
      },
      client: {
        name: resolveName(payment.job.client),
      },
      professional: {
        name: resolveName(payment.job.professional),
      },
    })),
  });
}
