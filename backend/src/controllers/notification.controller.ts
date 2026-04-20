import { NotificationType } from "@prisma/client";
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

  return res.status(200).json(
    paginatedResponse({
      data: notifications,
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
