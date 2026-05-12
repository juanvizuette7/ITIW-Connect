import { Request, Response } from "express";
import { NotificationType, Role } from "@prisma/client";
import { env } from "../config/env";
import { sendEmailSafe } from "../config/mailer";
import { prisma } from "../config/prisma";
import { notifyManyUsers } from "../services/notification.service";
import { newChatMessageTemplate } from "../utils/emailTemplates";

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

async function ensureJobParticipant(requestId: string, userId: string) {
  const job = await prisma.job.findFirst({
    where: {
      quote: {
        requestId,
      },
      OR: [{ clientId: userId }, { professionalId: userId }],
    },
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
        },
      },
      professional: {
        select: {
          id: true,
        },
      },
    },
  });

  return job;
}

export async function sendMessage(req: Request, res: Response) {
  const senderId = req.user!.userId;
  const { requestId } = req.params;
  const { content } = req.body as { content?: string };

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Debes escribir un mensaje antes de enviarlo." });
  }

  const job = await ensureJobParticipant(requestId, senderId);
  if (!job) {
    return res.status(403).json({ message: "Solo los participantes del job pueden enviar mensajes en este chat." });
  }

  const message = await prisma.message.create({
    data: {
      requestId,
      senderId,
      content: content.trim(),
    },
    include: {
      sender: {
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

  const senderName = resolveName(message.sender);

  void sendEmailSafe(
    env.emailUser,
    "Tienes un mensaje nuevo - ITIW Connect",
    newChatMessageTemplate(senderName, message.content, job.quote.request.description),
  );

  await notifyManyUsers(
    {
      userIds: [job.client.id, job.professional.id].filter((id) => id !== senderId),
      title: "Nuevo mensaje en el chat",
      body: `${senderName} envio un mensaje en la solicitud: ${job.quote.request.description}`,
      type: NotificationType.MENSAJE,
    },
    {
      emailSubject: "Tienes un mensaje nuevo - ITIW Connect",
    },
  );

  return res.status(201).json({
    id: message.id,
    requestId: message.requestId,
    content: message.content,
    createdAt: message.createdAt,
    sender: {
      id: message.sender.id,
      role: message.sender.role,
      name: senderName,
    },
  });
}

export async function getMessages(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { requestId } = req.params;

  const job = await ensureJobParticipant(requestId, userId);
  if (!job) {
    return res.status(403).json({ message: "Solo los participantes del job pueden ver este chat." });
  }

  const messages = await prisma.message.findMany({
    where: { requestId },
    include: {
      sender: {
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
    orderBy: {
      createdAt: "asc",
    },
  });

  return res.status(200).json(
    messages.map((message) => ({
      id: message.id,
      requestId: message.requestId,
      content: message.content,
      createdAt: message.createdAt,
      sender: {
        id: message.sender.id,
        role: message.sender.role,
        name: resolveName(message.sender),
      },
    })),
  );
}
