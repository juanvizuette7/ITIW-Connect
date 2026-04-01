import { JobPaymentStatus, JobStatus, NotificationType, PaymentStatus } from "@prisma/client";
import cron from "node-cron";
import { env } from "../config/env";
import { sendEmail } from "../config/mailer";
import { capturePaymentIntent } from "../config/stripe";
import { prisma } from "../config/prisma";
import {
  badgeAwardedTemplate,
  paymentReleasedTemplate,
  rateExperienceTemplate,
} from "../utils/emailTemplates";
import { notifyManyUsers, notifyUser } from "./notification.service";
import { assignProfessionalBadges } from "./reviewBadge.service";

let running = false;

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

      await sendEmail(
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

      await sendEmail(
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
        await sendEmail(
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

export function startEscrowReleaseScheduler() {
  cron.schedule("0 * * * *", () => {
    void releaseEscrowJobs();
  });
}
