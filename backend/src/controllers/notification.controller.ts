import { Notification, NotificationType, Role } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { notifyUser } from "../services/notification.service";
import { paginatedResponse, resolvePagination } from "../utils/pagination";

type CreateNotificationBody = {
  userId?: string;
  title?: string;
  body?: string;
  type?: NotificationType;
};

type NotificationTargetContext = {
  role: Role;
  requests: Array<{ id: string; description: string }>;
  professionalQuotes: Array<{ requestId: string; jobId: string | null; description: string }>;
  jobs: Array<{ id: string; description: string }>;
  disputes: Array<{ id: string; jobId: string }>;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bodyHasDescription(text: string, description: string) {
  const normalizedText = normalize(text);
  const normalizedDescription = normalize(description);

  if (!normalizedDescription) return false;
  return normalizedText.includes(normalizedDescription.slice(0, Math.min(normalizedDescription.length, 90)));
}

function extractJobId(text: string) {
  const match = text.match(/\bjob\s+([0-9a-f-]{36})\b/i);
  return match?.[1] || null;
}

function resolveNotificationHref(notification: Notification, context: NotificationTargetContext) {
  const text = `${notification.title} ${notification.body}`;
  const normalizedText = normalize(text);

  if (notification.type === NotificationType.MENSAJE) {
    const job = context.jobs.find((item) => bodyHasDescription(text, item.description));
    if (job) return `/dashboard/job/${job.id}/chat`;

    const request = context.requests.find((item) => bodyHasDescription(text, item.description));
    if (request) return `/dashboard/solicitud/${request.id}`;

    const quote = context.professionalQuotes.find((item) => bodyHasDescription(text, item.description));
    if (quote?.jobId) return `/dashboard/job/${quote.jobId}/chat`;
    if (quote) return `/dashboard/solicitud/${quote.requestId}`;

    return "/dashboard/mis-jobs";
  }

  if (notification.type === NotificationType.PAGO) {
    const job = context.jobs.find((item) => bodyHasDescription(text, item.description));
    return job ? `/dashboard/job/${job.id}` : "/dashboard/mis-jobs";
  }

  if (notification.type === NotificationType.SOLICITUD) {
    const request = context.requests.find((item) => bodyHasDescription(text, item.description));
    return request ? `/dashboard/solicitud/${request.id}` : context.role === Role.PROFESIONAL ? "/dashboard/solicitudes-disponibles" : "/dashboard/mis-solicitudes";
  }

  if (notification.type === NotificationType.PRESUPUESTO) {
    const quote = context.professionalQuotes.find((item) => bodyHasDescription(text, item.description));
    if (quote?.jobId) return `/dashboard/job/${quote.jobId}`;
    if (quote) return `/dashboard/solicitud/${quote.requestId}`;

    const request = context.requests.find((item) => bodyHasDescription(text, item.description));
    if (request) return `/dashboard/solicitud/${request.id}`;

    return context.role === Role.PROFESIONAL ? "/dashboard/mis-cotizaciones" : "/dashboard/mis-solicitudes";
  }

  if (notification.type === NotificationType.DISPUTA) {
    const jobId = extractJobId(text);
    const dispute = jobId ? context.disputes.find((item) => item.jobId === jobId) : null;
    return dispute ? `/dashboard/disputas/${dispute.id}` : "/dashboard/disputas";
  }

  if (notification.type === NotificationType.CALIFICACION || notification.type === NotificationType.BADGE) {
    return "/dashboard/profile";
  }

  if (normalizedText.includes("perfil") || normalizedText.includes("cuenta")) {
    return "/dashboard/profile";
  }

  if (normalizedText.includes("encuesta") || normalizedText.includes("nps")) {
    return "/dashboard";
  }

  return "/dashboard/notificaciones";
}

async function getNotificationTargetContext(userId: string): Promise<NotificationTargetContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const [requests, professionalQuotes, jobs, disputes] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { clientId: userId },
      select: { id: true, description: true },
      take: 80,
      orderBy: { createdAt: "desc" },
    }),
    prisma.quote.findMany({
      where: { professionalId: userId },
      select: {
        requestId: true,
        job: { select: { id: true } },
        request: { select: { description: true } },
      },
      take: 80,
      orderBy: { createdAt: "desc" },
    }),
    prisma.job.findMany({
      where: {
        OR: [{ clientId: userId }, { professionalId: userId }],
      },
      select: {
        id: true,
        quote: { select: { request: { select: { description: true } } } },
      },
      take: 80,
      orderBy: { createdAt: "desc" },
    }),
    prisma.dispute.findMany({
      where: {
        OR: [
          { openedBy: userId },
          { job: { OR: [{ clientId: userId }, { professionalId: userId }] } },
        ],
      },
      select: { id: true, jobId: true },
      take: 80,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    role: user?.role || Role.CLIENTE,
    requests,
    professionalQuotes: professionalQuotes.map((quote) => ({
      requestId: quote.requestId,
      jobId: quote.job?.id || null,
      description: quote.request.description,
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      description: job.quote.request.description,
    })),
    disputes,
  };
}

export async function createNotification(req: Request, res: Response) {
  const actor = req.user!;
  const { userId, title, body, type } = req.body as CreateNotificationBody;

  if (!userId || !title || !body || !type) {
    return res.status(400).json({ message: "Debes enviar userId, title, body y type." });
  }

  if (!Object.values(NotificationType).includes(type)) {
    return res.status(400).json({ message: "El tipo de notificacion no es valido." });
  }

  if (actor.role !== "ADMIN" && actor.userId !== userId) {
    return res.status(403).json({ message: "Solo puedes crear notificaciones para tu propia cuenta." });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return res.status(404).json({ message: "No encontramos el usuario de destino." });
  }

  const notification = await notifyUser(
    {
      userId,
      title: title.trim(),
      body: body.trim(),
      type,
    },
    {
      emailSubject: `${title.trim()} - ITIW Connect`,
    },
  );

  return res.status(201).json({
    message: "Notificacion creada correctamente.",
    notification,
  });
}

export async function listMyNotifications(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { page, limit, skip, take } = resolvePagination(req.query);

  const [total, notifications] = await Promise.all([
    prisma.notification.count({
      where: { userId },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
  ]);

  const context = await getNotificationTargetContext(userId);
  const enrichedNotifications = notifications.map((notification) => ({
    ...notification,
    href: resolveNotificationHref(notification, context),
  }));

  return res.status(200).json(
    paginatedResponse({
      data: enrichedNotifications,
      total,
      page,
      limit,
    }),
  );
}

export async function markNotificationAsRead(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { id } = req.params;

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    return res.status(404).json({ message: "No encontramos la notificacion." });
  }

  if (notification.userId !== userId) {
    return res.status(403).json({ message: "No tienes permiso para modificar esta notificacion." });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return res.status(200).json({
    message: "Notificacion marcada como leida.",
    notification: updated,
  });
}

export async function markAllNotificationsAsRead(req: Request, res: Response) {
  const userId = req.user!.userId;

  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  return res.status(200).json({
    message: "Todas las notificaciones fueron marcadas como leidas.",
    updatedCount: result.count,
  });
}

export async function getUnreadNotificationsCount(req: Request, res: Response) {
  const userId = req.user!.userId;

  const unread = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return res.status(200).json({ unread });
}
