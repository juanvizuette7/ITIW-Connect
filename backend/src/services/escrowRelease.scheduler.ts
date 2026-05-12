import { JobPaymentStatus, JobStatus, NotificationType, PaymentStatus } from "@prisma/client";
import cron from "node-cron";
import { env } from "../config/env";
import { sendEmailSafe } from "../config/mailer";
import { capturePaymentIntent } from "../config/stripe";
import { prisma } from "../config/prisma";
import {
  aiRetrainCompletedTemplate,
  badgeAwardedTemplate,
  npsSurveyTemplate,
  paymentReleasedTemplate,
  rateExperienceTemplate,
} from "../utils/emailTemplates";
import { notifyManyUsers, notifyUser } from "./notification.service";
import { assignProfessionalBadges } from "./reviewBadge.service";
import { retrainProfessionalAiScores } from "./aiTraining.service";

let running = false;
let runningNpsReminder = false;
let runningAiRetrain = false;

async function releaseEscrowJobs() {
  if (running) {
    return;
  }

  running = true;

  try {
    const pendingReleaseJobs = await prisma.job.findMany({
      where: {
        paymentStatus: JobPaymentStatus.RETENIDO,
        clientConfirmed: false,
        escrowReleaseAt: {
          lte: new Date(),
        },
      },
      include: {
        payment: true,
        professional: {
          select: {
            role: true,
            professionalProfile: {
              select: {
                name: true,
              },
            },
            clientProfile: {
              select: {
                name: true,
              },
            },
          },
        },
        quote: {
          include: {
            request: {
              select: {
                description: true,
              },
            },
          },
        },
      },
    });

    for (const job of pendingReleaseJobs) {
      if (!job.payment) {
        continue;
      }

      await capturePaymentIntent(job.payment.stripePaymentIntentId);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { jobId: job.id },
          data: {
            status: PaymentStatus.COMPLETADO,
          },
        });

        const completedJob = await tx.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.COMPLETADO,
            paymentStatus: JobPaymentStatus.LIBERADO,
          },
          include: {
            professional: {
              select: {
                role: true,
                professionalProfile: {
                  select: {
                    name: true,
                  },
                },
                clientProfile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            quote: {
              include: {
                request: {
                  select: {
                    description: true,
                  },
                },
              },
            },
          },
        });

        await tx.professionalProfile.update({
          where: { userId: completedJob.professionalId },
          data: {
            totalJobs: {
              increment: 1,
            },
          },
        });

        const assignedBadges = await assignProfessionalBadges(completedJob.professionalId, tx);

        return {
          completedJob,
          assignedBadges,
        };
      });

      void sendEmailSafe(
        env.emailUser,
        "Pago liberado automaticamente - ITIW Connect",
        paymentReleasedTemplate(updated.completedJob.quote.amountCop, updated.completedJob.quote.request.description, true),
      );

      await notifyManyUsers(
        {
          userIds: [job.clientId, job.professionalId],
          title: "Pago liberado automaticamente",
          body: `El pago del trabajo "${updated.completedJob.quote.request.description}" se libero al cumplir 72 horas.`,
          type: NotificationType.PAGO,
        },
        {
          emailSubject: "Pago liberado automaticamente - ITIW Connect",
        },
      );

      void sendEmailSafe(
        env.emailUser,
        "Califica tu experiencia! - ITIW Connect",
        rateExperienceTemplate(
          updated.completedJob.quote.request.description,
          `${env.frontendUrl}/dashboard/job/${updated.completedJob.id}/calificar`,
        ),
      );

      const professionalName =
        updated.completedJob.professional.professionalProfile?.name ||
        updated.completedJob.professional.clientProfile?.name ||
        "Profesional";

      for (const badgeType of updated.assignedBadges) {
        void sendEmailSafe(
          env.emailUser,
          "Obtuviste un nuevo badge! - ITIW Connect",
          badgeAwardedTemplate(professionalName, badgeType),
        );

        await notifyUser(
          {
            userId: job.professionalId,
            title: "Nuevo badge obtenido",
            body: `Obtuviste el badge ${badgeType}.`,
            type: NotificationType.BADGE,
          },
          {
            emailSubject: "Obtuviste un nuevo badge! - ITIW Connect",
          },
        );
      }
    }
  } catch (error) {
    console.error("[SCHEDULER] Error liberando pagos en escrow:", error);
  } finally {
    running = false;
  }
}

async function sendNpsReminders() {
  if (runningNpsReminder) {
    return;
  }

  runningNpsReminder = true;

  try {
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const jobs = await prisma.job.findMany({
      where: {
        status: JobStatus.COMPLETADO,
        paymentStatus: JobPaymentStatus.LIBERADO,
        npsReminderSent: false,
        updatedAt: {
          lte: threshold,
        },
      },
      include: {
        quote: {
          include: {
            request: {
              select: {
                description: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
    });

    for (const job of jobs) {
      const surveyUrl = `${env.frontendUrl}/dashboard/nps/${job.id}`;

      void sendEmailSafe(
        env.emailUser,
        "Como fue tu experiencia? - ITIW Connect",
        npsSurveyTemplate(job.quote.request.description, surveyUrl),
      );

      await notifyManyUsers(
        {
          userIds: [job.clientId, job.professionalId],
          title: "Encuesta NPS disponible",
          body: "Tu trabajo ya cumple 24 horas completado. Comparte tu feedback en la encuesta NPS.",
          type: NotificationType.SISTEMA,
        },
        {
          emailSubject: "Como fue tu experiencia? - ITIW Connect",
          sendMirrorEmail: false,
        },
      );

      await prisma.job.update({
        where: { id: job.id },
        data: {
          npsReminderSent: true,
        },
      });
    }
  } catch (error) {
    console.error("[SCHEDULER] Error enviando recordatorios NPS:", error);
  } finally {
    runningNpsReminder = false;
  }
}

async function runAiRetrainCycle() {
  if (runningAiRetrain) {
    return;
  }

  runningAiRetrain = true;

  try {
    const results = await retrainProfessionalAiScores(72);

    void sendEmailSafe(
      env.emailUser,
      "Motor IA reentrenado - ITIW Connect",
      aiRetrainCompletedTemplate(results.length),
    );
  } catch (error) {
    console.error("[SCHEDULER] Error reentrenando motor IA:", error);
  } finally {
    runningAiRetrain = false;
  }
}

export function startEscrowReleaseScheduler() {
  cron.schedule("0 * * * *", () => {
    void releaseEscrowJobs();
    void sendNpsReminders();
  });

  cron.schedule("0 3 */3 * *", () => {
    void runAiRetrainCycle();
  });
}
