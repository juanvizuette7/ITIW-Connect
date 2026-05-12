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

async function resolveChatContext(requestId: string, userId: string, role: Role) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      clientId: true,
      description: true,
      quotes: {
        select: {
          professionalId: true,
          job: {
            select: {
              clientId: true,
              professionalId: true,
            },
          },
        },
      },
    },
  });

  if (!request) {
    return {
      request: null,
      isParticipant: false,
      participantIds: [] as string[],
    };
  }

  const participantIds = Array.from(
    new Set([
      request.clientId,
      ...request.quotes.map((quote) => quote.professionalId),
      ...request.quotes.flatMap((quote) =>
        quote.job ? [quote.job.clientId, quote.job.professionalId] : [],
      ),
    ]),
  );

  return {
    request,
    isParticipant: role === Role.ADMIN || participantIds.includes(userId),
    participantIds,
  };
}

export async function sendMessage(req: Request, res: Response) {
  const senderId = req.user!.userId;
  const { requestId } = req.params;
  const { content } = req.body as { content?: string };

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Debes escribir un mensaje antes de enviarlo." });
  }

  const chat = await resolveChatContext(requestId, senderId, req.user!.role as Role);
  if (!chat.request) {
    return res.status(404).json({ message: "No encontramos la solicitud de este chat." });
  }

  if (!chat.isParticipant) {
    return res.status(403).json({
      message: "Solo el cliente y los profesionales que ya cotizaron pueden enviar mensajes en este chat.",
    });
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
    newChatMessageTemplate(senderName, message.content, chat.request.description),
  );

  await notifyManyUsers(
    {
      userIds: chat.participantIds.filter((id) => id !== senderId),
      title: "Nuevo mensaje en el chat",
      body: `${senderName} envio un mensaje en la solicitud: ${chat.request.description}`,
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

  const chat = await resolveChatContext(requestId, userId, req.user!.role as Role);
  if (!chat.request) {
    return res.status(404).json({ message: "No encontramos la solicitud de este chat." });
  }

  if (!chat.isParticipant) {
    return res.status(403).json({
      message: "Solo el cliente y los profesionales que ya cotizaron pueden ver este chat.",
    });
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
