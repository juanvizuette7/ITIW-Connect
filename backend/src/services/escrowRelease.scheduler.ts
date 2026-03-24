import { JobPaymentStatus, JobStatus, PaymentStatus } from "@prisma/client";
import cron from "node-cron";
import { env } from "../config/env";
import { sendEmail } from "../config/mailer";
import { capturePaymentIntent } from "../config/stripe";
import { prisma } from "../config/prisma";
import { paymentReleasedTemplate } from "../utils/emailTemplates";

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

      await prisma.$transaction([
        prisma.payment.update({
          where: { jobId: job.id },
          data: {
            status: PaymentStatus.COMPLETADO,
          },
        }),
        prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.COMPLETADO,
            paymentStatus: JobPaymentStatus.LIBERADO,
          },
        }),
      ]);

      await sendEmail(
        env.emailUser,
        "Pago liberado automaticamente - ITIW Connect",
        paymentReleasedTemplate(job.quote.amountCop, job.quote.request.description, true),
      );
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
