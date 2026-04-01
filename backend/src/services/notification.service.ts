import { NotificationType } from "@prisma/client";
import { env } from "../config/env";
import { sendEmail } from "../config/mailer";
import { prisma } from "../config/prisma";
import { notificationEventTemplate } from "../utils/emailTemplates";

type NotifyUserInput = {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
};

type NotifyManyInput = {
  userIds: string[];
  title: string;
  body: string;
  type: NotificationType;
};

type NotifyOptions = {
  emailSubject?: string;
  sendMirrorEmail?: boolean;
};

export async function notifyUser(input: NotifyUserInput, options: NotifyOptions = {}) {
  const { userId, title, body, type } = input;
  const { emailSubject, sendMirrorEmail = true } = options;

  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      body,
      type,
    },
  });

  if (sendMirrorEmail) {
    await sendEmail(
      env.emailUser,
      emailSubject || `${title} - ITIW Connect`,
      notificationEventTemplate(title, body),
    );
  }

  return notification;
}

export async function notifyManyUsers(input: NotifyManyInput, options: NotifyOptions = {}) {
  const { userIds, title, body, type } = input;
  const { emailSubject, sendMirrorEmail = true } = options;
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      title,
      body,
      type,
    })),
  });

  if (sendMirrorEmail) {
    await sendEmail(
      env.emailUser,
      emailSubject || `${title} - ITIW Connect`,
      notificationEventTemplate(title, `${body} (destinatarios: ${uniqueUserIds.length})`),
    );
  }
}

