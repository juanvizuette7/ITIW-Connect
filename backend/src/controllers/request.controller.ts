import { JobPaymentStatus, JobStatus, NotificationType, QuoteStatus, Role, ServiceRequestStatus } from "@prisma/client";
import { Request, Response } from "express";
import { env } from "../config/env";
import { sendEmailSafe } from "../config/mailer";
import { prisma } from "../config/prisma";
import {
  newQuoteTemplate,
  quoteAcceptedTemplate,
  requestCreatedTemplate,
} from "../utils/emailTemplates";
import { notifyManyUsers, notifyUser } from "../services/notification.service";
import { logAiTrainingEvent } from "../services/aiTraining.service";
import {
  getCachedProfessionalAiScore,
  setCachedProfessionalAiScore,
} from "../services/cache.service";
import { paginatedResponse, resolvePagination } from "../utils/pagination";

const JOB_ESCROW_HOURS = 72;

function getProfessionalName(
  professional: {
    email: string;
    professionalProfile: { name: string } | null;
  } | null,
): string {
  if (!professional) {
    return "Profesional";
  }

  return professional.professionalProfile?.name || professional.email;
}

function getClientName(
  client: {
    email: string;
    clientProfile: { name: string } | null;
  } | null,
): string {
  if (!client) {
    return "Cliente";
  }

  return client.clientProfile?.name || client.email;
}

function scoreQuote(avgRating: number, totalJobs: number, amountCop: number): number {
  if (amountCop <= 0) {
    return 0;
  }

  return avgRating * 0.5 + totalJobs * 0.3 + (1 / amountCop) * 0.2;
}

export async function createServiceRequest(req: Request, res: Response) {
  const clientId = req.user!.userId;
  const { categoryId, description, photosUrls } = req.body as {
    categoryId?: string;
    description?: string;
    photosUrls?: string[];
  };

  if (!categoryId || !description || !description.trim()) {
    return res.status(400).json({ message: "Debes enviar categoryId y descripcion de la solicitud." });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });

  if (!category) {
    return res.status(404).json({ message: "La categoria seleccionada no existe." });
  }

  const request = await prisma.serviceRequest.create({
    data: {
      clientId,
      categoryId,
      description: description.trim(),
      photosUrls: Array.isArray(photosUrls) ? photosUrls.filter(Boolean) : [],
      status: ServiceRequestStatus.ACTIVA,
    },
    include: {
      category: true,
    },
  });

  void sendEmailSafe(
    env.emailUser,
    "Nueva solicitud creada - ITIW Connect",
    requestCreatedTemplate(request.description, request.category.name),
  );

  const compatibleProfessionals = await prisma.user.findMany({
    where: {
      role: Role.PROFESIONAL,
      id: {
        not: clientId,
      },
      OR: [
        {
          professionalProfile: {
            specialties: {
              has: request.category.name,
            },
          },
        },
        {
          professionalProfile: {
            specialties: {
              isEmpty: true,
            },
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  await notifyManyUsers(
    {
      userIds: compatibleProfessionals.map((user) => user.id),
      title: "Nueva solicitud disponible",
      body: `Hay una nueva solicitud en ${request.category.name}: ${request.description}`,
      type: NotificationType.SOLICITUD,
    },
    {
      emailSubject: "Nueva solicitud creada - ITIW Connect",
    },
  );

  if (compatibleProfessionals.length > 0) {
    await prisma.aiTrainingEvent.createMany({
      data: compatibleProfessionals.map((professional) => ({
        professionalId: professional.id,
        requestId: request.id,
        action: "SOLICITUD_RECIBIDA",
        outcome: "NOTIFICADA",
      })),
      skipDuplicates: true,
    });
  }

  return res.status(201).json({
    message: "Solicitud creada correctamente.",
    request,
  });
}

export async function getClientRequests(req: Request, res: Response) {
  const clientId = req.user!.userId;
  const { page, limit, skip, take } = resolvePagination(req.query);

  const [total, requests] = await Promise.all([
    prisma.serviceRequest.count({
      where: { clientId },
    }),
    prisma.serviceRequest.findMany({
      where: { clientId },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
          },
        },
        _count: {
          select: {
            quotes: true,
          },
        },
        quotes: {
          where: {
            status: QuoteStatus.ACEPTADA,
          },
          select: {
            id: true,
            job: {
              select: {
                id: true,
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

  const data = requests.map((request) => ({
    ...request,
    jobId: request.quotes[0]?.job?.id || null,
  }));

  return res.status(200).json(
    paginatedResponse({
      data,
      total,
      page,
      limit,
    }),
  );
}

export async function getRequestDetail(req: Request, res: Response) {
  const userId = req.user!.userId;
  const userRole = req.user!.role;
  const { id } = req.params;

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      category: true,
      client: {
        select: {
          id: true,
          email: true,
          clientProfile: {
            select: {
              name: true,
            },
          },
        },
      },
      quotes: {
        include: {
          job: {
            select: {
              id: true,
            },
          },
          professional: {
            select: {
              id: true,
              email: true,
              professionalProfile: {
                select: {
                  name: true,
                  avgRating: true,
                  totalJobs: true,
                  reviewCount: true,
                  verifiedBadge: true,
                  badges: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!request) {
    return res.status(404).json({ message: "No encontramos la solicitud." });
  }

  if (userRole === "CLIENTE" && request.clientId !== userId) {
    return res.status(403).json({ message: "No tienes permiso para ver esta solicitud." });
  }

  if (userRole === "PROFESIONAL") {
    const isOwnQuote = request.quotes.some((quote) => quote.professionalId === userId);
    if (!isOwnQuote && request.status !== ServiceRequestStatus.ACTIVA) {
      return res.status(403).json({ message: "No tienes permiso para ver esta solicitud." });
    }
  }

  const quotesSortedByAi = request.quotes
    .map((quote) => {
      const avgRating = Number(quote.professional.professionalProfile?.avgRating || 0);
      const totalJobs = Number(quote.professional.professionalProfile?.totalJobs || 0);
      const score = scoreQuote(avgRating, totalJobs, quote.amountCop);

      return {
        id: quote.id,
        requestId: quote.requestId,
        professionalId: quote.professionalId,
        amountCop: quote.amountCop,
        estimatedHours: quote.estimatedHours,
        message: quote.message,
        status: quote.status,
        expiresAt: quote.expiresAt,
        createdAt: quote.createdAt,
        score,
        jobId: quote.job?.id || null,
        professional: {
          id: quote.professional.id,
          name: quote.professional.professionalProfile?.name || quote.professional.email,
          avgRating,
          totalJobs,
          reviewCount: Number(quote.professional.professionalProfile?.reviewCount || 0),
          verifiedBadge: Boolean(quote.professional.professionalProfile?.verifiedBadge),
          badges: quote.professional.professionalProfile?.badges || [],
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return res.status(200).json({
    id: request.id,
    status: request.status,
    description: request.description,
    photosUrls: request.photosUrls,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    category: request.category,
    client: {
      id: request.client.id,
      name: request.client.clientProfile?.name || request.client.email,
      email: request.client.email,
    },
    quotes: quotesSortedByAi,
  });
}

export async function getAvailableRequests(req: Request, res: Response) {
  const professionalId = req.user!.userId;

  let aiScore = getCachedProfessionalAiScore(professionalId);
  const professional = await prisma.professionalProfile.findUnique({
    where: { userId: professionalId },
    select: {
      aiScore: aiScore === null,
      specialties: true,
    },
  });

  const requests = await prisma.serviceRequest.findMany({
    where: {
      status: ServiceRequestStatus.ACTIVA,
      quotes: {
        none: {
          professionalId,
        },
      },
    },
    include: {
      category: true,
      client: {
        select: {
          clientProfile: {
            select: {
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          quotes: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  if (aiScore === null) {
    aiScore = Number(professional?.aiScore || 0);
    setCachedProfessionalAiScore(professionalId, aiScore);
  }
  const specialties = professional?.specialties || [];

  const rankedRequests = requests
    .map((request) => {
      const isSpecialtyMatch = specialties.some(
        (specialty) => specialty.trim().toLowerCase() === request.category.name.trim().toLowerCase(),
      );
      const freshnessHours = Math.max(
        0,
        (Date.now() - request.createdAt.getTime()) / (1000 * 60 * 60),
      );
      const freshnessScore = 1 / (1 + freshnessHours);
      const demandScore = request._count.quotes >= 5 ? 0.2 : 1 - request._count.quotes * 0.15;
      const rankingScore =
        aiScore * (isSpecialtyMatch ? 1.05 : 0.9) +
        freshnessScore * 20 +
        Math.max(0, demandScore) * 10;

      return {
        ...request,
        rankingScore: Number(rankingScore.toFixed(2)),
      };
    })
    .sort((a, b) => b.rankingScore - a.rankingScore);

  return res.status(200).json(rankedRequests);
}

export async function getProfessionalQuotes(req: Request, res: Response) {
  const professionalId = req.user!.userId;

  const quotes = await prisma.quote.findMany({
    where: {
      professionalId,
    },
    include: {
      job: {
        select: {
          id: true,
          paymentStatus: true,
          status: true,
        },
      },
      request: {
        include: {
          category: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.status(200).json(
    quotes.map((quote) => ({
      id: quote.id,
      requestId: quote.requestId,
      amountCop: quote.amountCop,
      estimatedHours: quote.estimatedHours,
      message: quote.message,
      status: quote.status,
      createdAt: quote.createdAt,
      request: {
        id: quote.request.id,
        description: quote.request.description,
        status: quote.request.status,
        category: quote.request.category,
      },
      job: quote.job,
    })),
  );
}

export async function cancelClientRequest(req: Request, res: Response) {
  const clientId = req.user!.userId;
  const { id } = req.params;

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      status: true,
    },
  });

  if (!request) {
    return res.status(404).json({ message: "No encontramos la solicitud indicada." });
  }

  if (request.clientId !== clientId) {
    return res.status(403).json({ message: "No tienes permiso para cancelar esta solicitud." });
  }

  if (request.status !== ServiceRequestStatus.ACTIVA) {
    return res.status(400).json({ message: "Solo puedes cancelar solicitudes activas." });
  }

  const updated = await prisma.serviceRequest.update({
    where: { id },
    data: {
      status: ServiceRequestStatus.CANCELADA,
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
    },
  });

  return res.status(200).json({
    message: "Solicitud cancelada correctamente.",
    request: updated,
  });
}

export async function createQuote(req: Request, res: Response) {
  const professionalId = req.user!.userId;
  const { id } = req.params;
  const { amountCop, estimatedHours, message } = req.body as {
    amountCop?: number;
    estimatedHours?: number;
    message?: string;
  };

  if (!amountCop || !estimatedHours || !message || !message.trim()) {
    return res.status(400).json({ message: "Debes enviar monto, horas estimadas y mensaje." });
  }

  if (amountCop <= 0 || estimatedHours <= 0) {
    return res.status(400).json({ message: "El monto y las horas estimadas deben ser mayores a cero." });
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      category: true,
      client: {
        select: {
          email: true,
          clientProfile: {
            select: {
              name: true,
            },
          },
        },
      },
      quotes: {
        select: {
          id: true,
          professionalId: true,
        },
      },
    },
  });

  if (!request) {
    return res.status(404).json({ message: "No encontramos la solicitud indicada." });
  }

  if (request.status !== ServiceRequestStatus.ACTIVA) {
    return res.status(400).json({ message: "Solo puedes cotizar solicitudes activas." });
  }

  if (request.clientId === professionalId) {
    return res.status(400).json({ message: "No puedes cotizar en una solicitud creada por tu propia cuenta." });
  }

  if (request.quotes.length >= 5) {
    return res.status(400).json({ message: "Esta solicitud ya alcanzo el maximo de 5 presupuestos." });
  }

  if (request.quotes.some((quote) => quote.professionalId === professionalId)) {
    return res.status(400).json({ message: "Ya enviaste un presupuesto para esta solicitud." });
  }

  const quote = await prisma.quote.create({
    data: {
      requestId: id,
      professionalId,
      amountCop: Number(amountCop),
      estimatedHours: Number(estimatedHours),
      message: message.trim(),
      status: QuoteStatus.PENDIENTE,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
    include: {
      professional: {
        select: {
          email: true,
          professionalProfile: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const professionalName = getProfessionalName(quote.professional);
  const clientName = getClientName(request.client);

  void sendEmailSafe(
    request.client.email,
    "Tienes un nuevo presupuesto - ITIW Connect",
    newQuoteTemplate(
      clientName,
      professionalName,
      quote.amountCop,
      quote.estimatedHours,
      `${env.frontendUrl}/dashboard/solicitud/${request.id}`,
    ),
  );

  await notifyUser(
    {
      userId: request.clientId,
      title: "Nuevo presupuesto recibido",
      body: `${professionalName} envio un presupuesto por $${new Intl.NumberFormat("es-CO").format(Math.round(quote.amountCop))} COP.`,
      type: NotificationType.PRESUPUESTO,
    },
    {
      emailSubject: "Tienes un nuevo presupuesto - ITIW Connect",
    },
  );

  await logAiTrainingEvent({
    professionalId,
    requestId: request.id,
    action: "COTIZACION",
    outcome: "ENVIADA",
  });

  return res.status(201).json({
    message: "Presupuesto enviado correctamente.",
    quote,
  });
}

export async function acceptQuote(req: Request, res: Response) {
  const clientId = req.user!.userId;
  const { id, quoteId } = req.params;

  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      quotes: true,
    },
  });

  if (!request) {
    return res.status(404).json({ message: "No encontramos la solicitud indicada." });
  }

  if (request.clientId !== clientId) {
    return res.status(403).json({ message: "No tienes permiso para aceptar presupuestos de esta solicitud." });
  }

  if (request.status !== ServiceRequestStatus.ACTIVA) {
    return res.status(400).json({ message: "Solo puedes aceptar presupuestos en solicitudes activas." });
  }

  const targetQuote = request.quotes.find((quote) => quote.id === quoteId);

  if (!targetQuote) {
    return res.status(404).json({ message: "No encontramos el presupuesto seleccionado." });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.quote.updateMany({
      where: {
        requestId: id,
        id: {
          not: quoteId,
        },
      },
      data: {
        status: QuoteStatus.RECHAZADA,
      },
    });

    const acceptedQuote = await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.ACEPTADA,
      },
      include: {
        professional: {
          select: {
            email: true,
            professionalProfile: {
              select: {
                name: true,
              },
            },
          },
        },
        request: {
          select: {
            description: true,
          },
        },
      },
    });

    const updatedRequest = await tx.serviceRequest.update({
      where: { id },
      data: {
        status: ServiceRequestStatus.AGENDADA,
      },
    });

    const job = await tx.job.upsert({
      where: {
        quoteId: acceptedQuote.id,
      },
      create: {
        quoteId: acceptedQuote.id,
        clientId: request.clientId,
        professionalId: acceptedQuote.professionalId,
        status: JobStatus.PENDIENTE,
        paymentStatus: JobPaymentStatus.PENDIENTE,
        escrowReleaseAt: new Date(Date.now() + JOB_ESCROW_HOURS * 60 * 60 * 1000),
      },
      update: {
        clientId: request.clientId,
        professionalId: acceptedQuote.professionalId,
      },
    });

    return { acceptedQuote, updatedRequest, job };
  });

  await logAiTrainingEvent({
    professionalId: result.acceptedQuote.professionalId,
    requestId: id,
    action: "COTIZACION",
    outcome: "ACEPTADA",
  });

  const rejectedProfessionalIds = request.quotes
    .filter((quote) => quote.id !== quoteId)
    .map((quote) => quote.professionalId);

  for (const professionalId of rejectedProfessionalIds) {
    await logAiTrainingEvent({
      professionalId,
      requestId: id,
      action: "COTIZACION",
      outcome: "RECHAZADA",
    });
  }

  const professionalName = getProfessionalName(result.acceptedQuote.professional);

  void sendEmailSafe(
    result.acceptedQuote.professional.email,
    "Tu presupuesto fue aceptado! - ITIW Connect",
    quoteAcceptedTemplate(
      professionalName,
      result.acceptedQuote.amountCop,
      result.acceptedQuote.estimatedHours,
      result.acceptedQuote.request.description,
      `${env.frontendUrl}/dashboard`,
    ),
  );

  await notifyUser(
    {
      userId: result.acceptedQuote.professionalId,
      title: "Tu presupuesto fue aceptado",
      body: `El cliente acepto tu cotizacion para: ${result.acceptedQuote.request.description}`,
      type: NotificationType.PRESUPUESTO,
    },
    {
      emailSubject: "Presupuesto aceptado - ITIW Connect",
    },
  );

  return res.status(200).json({
    message: "Presupuesto aceptado correctamente. La solicitud fue agendada.",
    request: result.updatedRequest,
    acceptedQuote: result.acceptedQuote,
    job: {
      id: result.job.id,
      status: result.job.status,
      paymentStatus: result.job.paymentStatus,
    },
  });
}
