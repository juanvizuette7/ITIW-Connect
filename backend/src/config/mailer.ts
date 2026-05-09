import nodemailer from "nodemailer";
import { env } from "./env";

const MAIL_TIMEOUT_MS = 10000;

export const transporter = nodemailer.createTransport({
  host: env.emailHost,
  port: env.emailPort,
  secure: env.emailPort === 465,
  connectionTimeout: MAIL_TIMEOUT_MS,
  greetingTimeout: MAIL_TIMEOUT_MS,
  socketTimeout: MAIL_TIMEOUT_MS,
  auth: {
    user: env.emailUser,
    pass: env.emailPass,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: env.emailFrom,
    to,
    subject,
    html,
  });
}

export async function sendEmailSafe(to: string, subject: string, html: string) {
  try {
    await sendEmail(to, subject, html);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[MAIL] No fue posible enviar correo a ${to}: ${message}`);
    return false;
  }
}
