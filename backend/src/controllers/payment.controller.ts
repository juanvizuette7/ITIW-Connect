import crypto from "crypto";
import { PaymentStatus, Role } from "@prisma/client";
import { Request, Response } from "express";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { paginatedResponse, resolvePagination } from "../utils/pagination";

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

function receiptNumber(paymentId: string, createdAt: Date) {
  const datePart = createdAt.toISOString().slice(0, 10).replace(/-/g, "");
  return `ITIW-${datePart}-${paymentId.slice(0, 8).toUpperCase()}`;
}

function signReceipt(payload: Record<string, unknown>) {
  const canonicalPayload = JSON.stringify(payload);
  const payloadHash = crypto.createHash("sha256").update(canonicalPayload).digest("hex");
  const signature = crypto.createHmac("sha256", env.jwtSecret).update(canonicalPayload).digest("hex");

  return {
    algorithm: "HMAC-SHA256",
    payloadHash,
    signature,
    signedBy: "ITIW Connect",
  };
}

export async function getPaymentHistory(req: Request, res: Response) {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { page, limit, skip, take } = resolvePagination(req.query);

  const query = req.query as PaymentHistoryQuery;
  const startDate = parseDate(query.fechaInicio || query.startDate);
  const endDate = parseDate(query.fechaFin || query.endDate);
  const minAmount = parseNumber(query.montoMinimo || query.minAmount);
  const maxAmount = parseNumber(query.montoMaximo || query.maxAmount);
  const status = query.status;

  if ((query.fechaInicio || query.startDate) && !startDate) {
    return res.status(400).json({ message: "La fecha de inicio no tiene un formato válido." });
  }

  if ((query.fechaFin || query.endDate) && !endDate) {
    return res.status(400).json({ message: "La fecha de fin no tiene un formato válido." });
  }

  if ((query.montoMinimo || query.minAmount) && minAmount === null) {
    return res.status(400).json({ message: "El monto mínimo no tiene un formato válido." });
  }

  if ((query.montoMaximo || query.maxAmount) && maxAmount === null) {
    return res.status(400).json({ message: "El monto máximo no tiene un formato válido." });
  }

  if (status && !Object.values(PaymentStatus).includes(status)) {
    return res.status(400).json({ message: "El estado de pago no es válido." });
  }

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (startDate) createdAtFilter.gte = startDate;
  if (endDate) createdAtFilter.lte = endDate;

  const where = {
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
  };

  const [total, aggregateTotals, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where,
      _sum: {
        amountCop: true,
        commissionCop: true,
        netProfessionalCop: true,
      },
    }),
    prisma.payment.findMany({
      where,
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
      skip,
      take,
    }),
  ]);

  const totals = {
    totalPagado: Number(aggregateTotals._sum.amountCop || 0),
    totalComisiones: Number(aggregateTotals._sum.commissionCop || 0),
    totalNeto: Number(aggregateTotals._sum.netProfessionalCop || 0),
  };

  return res.status(200).json(
    paginatedResponse({
      data: payments.map((payment) => ({
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
      total,
      page,
      limit,
      extra: { totals },
    }),
  );
}

export async function getPaymentReceipt(req: Request, res: Response) {
  const userId = req.user!.userId;
  const role = req.user!.role;
  const { paymentId } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      job: {
        include: {
          client: {
            select: {
              id: true,
              role: true,
              email: true,
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
              id: true,
              role: true,
              email: true,
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
  });

  if (!payment) {
    return res.status(404).json({ message: "No encontramos el pago solicitado." });
  }

  const isClient = payment.job.clientId === userId;
  const isProfessional = payment.job.professionalId === userId;

  if (role !== "ADMIN" && !isClient && !isProfessional) {
    return res.status(403).json({ message: "No tienes permiso para exportar este recibo." });
  }

  const viewerRole = isClient ? "CLIENTE" : isProfessional ? "PROFESIONAL" : "ADMIN";
  const issuedAt = new Date();
  const receipt = {
    receiptNumber: receiptNumber(payment.id, payment.createdAt),
    issuedAt: issuedAt.toISOString(),
    payment: {
      id: payment.id,
      jobId: payment.jobId,
      status: payment.status,
      createdAt: payment.createdAt.toISOString(),
      amountCop: payment.amountCop,
      commissionCop: viewerRole === "CLIENTE" ? null : payment.commissionCop,
      netProfessionalCop: viewerRole === "CLIENTE" ? null : payment.netProfessionalCop,
      clientVisibleTotalCop: payment.amountCop,
    },
    service: {
      requestId: payment.job.quote.request.id,
      category: payment.job.quote.request.category.name,
      description: payment.job.quote.request.description,
    },
    parties: {
      client: {
        name: resolveName(payment.job.client),
        email: viewerRole === "ADMIN" ? payment.job.client.email : undefined,
      },
      professional: {
        name: resolveName(payment.job.professional),
        email: viewerRole === "ADMIN" ? payment.job.professional.email : undefined,
      },
    },
    viewerRole,
    note:
      viewerRole === "CLIENTE"
        ? "Este recibo certifica el total pagado por el cliente. La comisión de plataforma está incluida internamente en el servicio."
        : "Este recibo certifica el valor cobrado, la comisión de plataforma y el neto liquidado al profesional.",
  };

  return res.status(200).json({
    receipt,
    digitalSignature: signReceipt(receipt),
  });
}

