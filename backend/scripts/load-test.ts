import { JobPaymentStatus, JobStatus, QuoteStatus, Role, ServiceRequestStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/config/prisma";

const TARGET_PROS = 50;
const TARGET_REQUESTS = 200;
const TARGET_QUOTES = 500;
const TARGET_REVIEWS = 300;

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

async function ensureClientUsers(minimum: number) {
  const existingClients = await prisma.user.findMany({
    where: { role: Role.CLIENTE },
    select: { id: true },
    take: minimum,
  });

  if (existingClients.length >= minimum) {
    return existingClients.map((item) => item.id);
  }

  const missing = minimum - existingClients.length;
  for (let index = 0; index < missing; index += 1) {
    const suffix = `${Date.now()}${index}`;
    const passwordHash = await bcrypt.hash(randomUUID(), 12);
    const phone = `31${suffix.slice(-8)}`.padEnd(10, "9");
    const email = `load.client.${suffix}@itiwconnect.com`;

    await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: Role.CLIENTE,
        isEmailVerified: true,
        clientProfile: {
          create: {
            name: `Cliente ${suffix.slice(-4)}`,
          },
        },
      },
    });
  }

  const clients = await prisma.user.findMany({
    where: { role: Role.CLIENTE },
    select: { id: true },
    take: minimum,
  });

  return clients.map((item) => item.id);
}

async function createProfessionalUsers(count: number) {
  const categories = await prisma.category.findMany({
    select: { name: true },
  });
  const categoryNames = categories.map((item) => item.name);

  const professionalIds: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const suffix = `${Date.now()}${index}`;
    const passwordHash = await bcrypt.hash(randomUUID(), 12);
    const phone = `32${suffix.slice(-8)}`.padEnd(10, "8");
    const email = `load.pro.${suffix}@itiwconnect.com`;
    const specialties = [
      pickOne(categoryNames),
      pickOne(categoryNames),
      pickOne(categoryNames),
    ].filter((value, position, all) => all.indexOf(value) === position);

    const created = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: Role.PROFESIONAL,
        isEmailVerified: true,
        isIdentityVerified: randomInt(0, 1) === 1,
        professionalProfile: {
          create: {
            name: `Profesional ${suffix.slice(-4)}`,
            bio: `Profesional con experiencia en ${specialties.join(", ")}.`,
            specialties,
            hourlyRate: randomInt(30000, 120000),
            coverageRadiusKm: randomInt(3, 25),
            avgRating: randomInt(35, 50) / 10,
            totalJobs: randomInt(1, 120),
            verifiedBadge: randomInt(0, 1) === 1,
            aiScore: randomInt(30, 95),
            reviewCount: randomInt(1, 220),
          },
        },
      },
      select: { id: true },
    });

    professionalIds.push(created.id);
  }

  return professionalIds;
}

async function run() {
  const startedAt = Date.now();
  await prisma.$connect();

  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
  });

  if (categories.length === 0) {
    throw new Error("No hay categorias en la base de datos. Ejecuta el seed antes del load test.");
  }

  const clientIds = await ensureClientUsers(30);
  const professionalIds = await createProfessionalUsers(TARGET_PROS);

  const requestIds: string[] = [];
  for (let index = 0; index < TARGET_REQUESTS; index += 1) {
    const category = pickOne(categories);
    const clientId = pickOne(clientIds);
    const created = await prisma.serviceRequest.create({
      data: {
        clientId,
        categoryId: category.id,
        description: `Solicitud de prueba #${index + 1} para ${category.name}.`,
        status: pickOne([
          ServiceRequestStatus.ACTIVA,
          ServiceRequestStatus.AGENDADA,
          ServiceRequestStatus.COMPLETADA,
          ServiceRequestStatus.CANCELADA,
        ]),
      },
      select: { id: true },
    });
    requestIds.push(created.id);
  }

  const quoteIds: string[] = [];
  for (let index = 0; index < TARGET_QUOTES; index += 1) {
    const requestId = pickOne(requestIds);
    const professionalId = pickOne(professionalIds);
    const amountCop = randomInt(80000, 550000);

    const created = await prisma.quote.create({
      data: {
        requestId,
        professionalId,
        amountCop,
        estimatedHours: randomInt(1, 12),
        message: `Cotizacion de prueba #${index + 1}.`,
        status: pickOne([QuoteStatus.PENDIENTE, QuoteStatus.ACEPTADA, QuoteStatus.RECHAZADA]),
        expiresAt: new Date(Date.now() + randomInt(12, 72) * 60 * 60 * 1000),
      },
      select: { id: true, requestId: true, professionalId: true },
    });

    quoteIds.push(created.id);
  }

  const acceptedQuotes = await prisma.quote.findMany({
    where: { id: { in: quoteIds }, status: QuoteStatus.ACEPTADA },
    select: {
      id: true,
      professionalId: true,
      request: {
        select: {
          clientId: true,
        },
      },
    },
    take: 220,
  });

  const jobIds: string[] = [];
  for (const quote of acceptedQuotes) {
    const status = pickOne([JobStatus.EN_PROGRESO, JobStatus.COMPLETADO, JobStatus.PENDIENTE]);
    const paymentStatus =
      status === JobStatus.COMPLETADO
        ? pickOne([JobPaymentStatus.LIBERADO, JobPaymentStatus.RETENIDO])
        : pickOne([JobPaymentStatus.PENDIENTE, JobPaymentStatus.RETENIDO]);

    const job = await prisma.job.upsert({
      where: { quoteId: quote.id },
      update: {},
      create: {
        quoteId: quote.id,
        clientId: quote.request.clientId,
        professionalId: quote.professionalId,
        status,
        paymentStatus,
        escrowReleaseAt: new Date(Date.now() + randomInt(12, 72) * 60 * 60 * 1000),
      },
      select: { id: true },
    });

    jobIds.push(job.id);
  }

  const reviewCandidates = await prisma.job.findMany({
    where: {
      id: { in: jobIds },
      status: JobStatus.COMPLETADO,
      paymentStatus: JobPaymentStatus.LIBERADO,
    },
    select: {
      id: true,
      clientId: true,
      professionalId: true,
    },
  });

  let createdReviews = 0;
  for (const candidate of reviewCandidates) {
    if (createdReviews >= TARGET_REVIEWS) break;

    const reviewerId = randomInt(0, 1) === 0 ? candidate.clientId : candidate.professionalId;
    const reviewedId = reviewerId === candidate.clientId ? candidate.professionalId : candidate.clientId;

    const exists = await prisma.review.findUnique({
      where: {
        jobId_reviewerId: {
          jobId: candidate.id,
          reviewerId,
        },
      },
      select: { id: true },
    });

    if (exists) continue;

    await prisma.review.create({
      data: {
        jobId: candidate.id,
        reviewerId,
        reviewedId,
        rating: randomInt(3, 5),
        subcategoryRatings: {
          puntualidad: randomInt(3, 5),
          calidad: randomInt(3, 5),
          comunicacion: randomInt(3, 5),
          limpieza: randomInt(3, 5),
        },
        comment: "Resena generada automaticamente para prueba de carga.",
      },
    });
    createdReviews += 1;
  }

  const sampleProfessional = pickOne(professionalIds);

  const requestAvailableStart = performance.now();
  await prisma.serviceRequest.findMany({
    where: {
      status: ServiceRequestStatus.ACTIVA,
      quotes: {
        none: {
          professionalId: sampleProfessional,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const requestAvailableMs = performance.now() - requestAvailableStart;

  const buscarStart = performance.now();
  await prisma.professionalProfile.findMany({
    where: {
      user: {
        role: Role.PROFESIONAL,
        isActive: true,
      },
      avgRating: { gte: 4 },
      coverageRadiusKm: { gte: 5 },
    },
    orderBy: [{ avgRating: "desc" }, { totalJobs: "desc" }],
    take: 30,
  });
  const buscarMs = performance.now() - buscarStart;

  const totalMs = Date.now() - startedAt;

  console.log("=== ITIW CONNECT LOAD TEST ===");
  console.log(`Profesionales creados: ${professionalIds.length}`);
  console.log(`Solicitudes creadas: ${TARGET_REQUESTS}`);
  console.log(`Cotizaciones creadas: ${TARGET_QUOTES}`);
  console.log(`Resenas creadas: ${createdReviews}`);
  console.log(`Tiempo consulta equivalente GET /api/requests/available: ${requestAvailableMs.toFixed(2)} ms`);
  console.log(`Tiempo consulta equivalente GET /api/buscar: ${buscarMs.toFixed(2)} ms`);
  console.log(`Tiempo total script: ${totalMs} ms`);

  if (requestAvailableMs > 500) {
    console.warn("[WARN] /api/requests/available equivalente supero 500ms.");
  }
  if (buscarMs > 300) {
    console.warn("[WARN] /api/buscar equivalente supero 300ms.");
  }
}

run()
  .catch((error) => {
    console.error("Error en load test:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

