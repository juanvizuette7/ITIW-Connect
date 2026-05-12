import bcrypt from "bcrypt";
import {
  BadgeType,
  JobPaymentStatus,
  JobStatus,
  PaymentStatus,
  PrismaClient,
  QuoteStatus,
  Role,
  ServiceRequestStatus,
} from "@prisma/client";
import { CANONICAL_CATEGORY_NAMES } from "../src/constants/categories";

const prisma = new PrismaClient();
const TEST_PASSWORD = "Test1234!";

function portfolioSvg(title: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="0 0 900 650"><rect width="900" height="650" rx="42" fill="#0A0F1A"/><circle cx="740" cy="120" r="150" fill="${color}" opacity="0.22"/><rect x="80" y="90" width="740" height="470" rx="36" fill="#111827" stroke="${color}" stroke-width="4"/><text x="110" y="170" fill="#ffffff" font-family="Arial" font-size="46" font-weight="700">${title}</text><text x="110" y="240" fill="#aab8cf" font-family="Arial" font-size="26">Trabajo verificado ITIW Connect</text><path d="M130 430h210l62-95 72 125 52-72 95 42h145" stroke="${color}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function seedCategories() {
  for (const name of CANONICAL_CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: { iconUrl: null },
      create: { name, iconUrl: null },
    });
  }

  await prisma.category.deleteMany({
    where: {
      name: { notIn: [...CANONICAL_CATEGORY_NAMES] },
      serviceRequests: { none: {} },
    },
  });
}

async function deleteDemoUsers() {
  const users = await prisma.user.findMany({
    where: {
      email: { in: ["carlos.mendoza@example.com", "andres.ramirez@example.com"] },
    },
    select: { id: true },
  });

  if (users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  }
}

async function main() {
  await seedCategories();
  await deleteDemoUsers();

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const electricidad = await prisma.category.findUniqueOrThrow({ where: { name: "Electricidad" } });
  const plomeria = await prisma.category.findUniqueOrThrow({ where: { name: "Plomería" } });
  const pintura = await prisma.category.findUniqueOrThrow({ where: { name: "Pintura" } });

  const carlos = await prisma.user.create({
    data: {
      email: "carlos.mendoza@example.com",
      phone: "3001112233",
      passwordHash,
      role: Role.CLIENTE,
      isEmailVerified: true,
      clientProfile: {
        create: {
          name: "Carlos Mendoza",
          photoUrl: null,
        },
      },
    },
  });

  const andres = await prisma.user.create({
    data: {
      email: "andres.ramirez@example.com",
      phone: "3004445566",
      passwordHash,
      role: Role.PROFESIONAL,
      isEmailVerified: true,
      isIdentityVerified: true,
      professionalProfile: {
        create: {
          name: "Andrés Ramírez",
          bio: "Electricista certificado con 10 años de experiencia en instalaciones residenciales, tableros, tomas, luminarias, alarmas y CCTV en Bogotá. Trabajo garantizado y ordenado.",
          specialties: ["Electricidad", "Alarmas y CCTV"],
          hourlyRate: 75000,
          coverageRadiusKm: 15,
          avgRating: 4.8,
          aiScore: 92,
          reviewCount: 18,
          badges: ["VERIFICADO", "TOP_RATED"],
          totalJobs: 23,
          verifiedBadge: true,
          verificationStatus: "APROBADO",
          onboardingCompleted: true,
          onboardingSteps: {
            perfilCompleto: true,
            zonaConfigurada: true,
            identidadVerificada: true,
            especialidades: true,
            portafolio: true,
          },
        },
      },
      portfolioPhotos: {
        create: [
          { photoUrl: portfolioSvg("Tablero electrico", "#FF6B2C"), description: "Revision y organizacion de tablero electrico residencial." },
          { photoUrl: portfolioSvg("Instalacion CCTV", "#e94560"), description: "Instalacion de camaras y cableado estructurado." },
          { photoUrl: portfolioSvg("Tomas nuevas", "#f0a500"), description: "Instalacion segura de tomas electricas." },
        ],
      },
    },
  });

  await prisma.badge.upsert({
    where: { userId_type: { userId: andres.id, type: BadgeType.VERIFICADO } },
    update: {},
    create: { userId: andres.id, type: BadgeType.VERIFICADO },
  });

  const solicitudElectricidad = await prisma.serviceRequest.create({
    data: {
      clientId: carlos.id,
      categoryId: electricidad.id,
      description: "Necesito instalar 3 tomas eléctricas nuevas en la sala y revisar el tablero eléctrico que presenta fallas intermitentes desde hace una semana.",
      status: ServiceRequestStatus.ACTIVA,
      preferredSchedule: "TARDE",
      preferredDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      locationLabel: "Bogotá, Chapinero",
      locationLat: 4.6486,
      locationLng: -74.0631,
      locationAccuracy: 40,
    },
  });

  const solicitudPlomeria = await prisma.serviceRequest.create({
    data: {
      clientId: carlos.id,
      categoryId: plomeria.id,
      description: "Hay una fuga de agua debajo del lavamanos del baño principal. El goteo es constante y está dañando el mueble de madera.",
      status: ServiceRequestStatus.AGENDADA,
      preferredSchedule: "MANANA",
      preferredDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      locationLabel: "Bogotá, Usaquén",
      locationLat: 4.7109,
      locationLng: -74.0305,
      locationAccuracy: 45,
    },
  });

  const solicitudPintura = await prisma.serviceRequest.create({
    data: {
      clientId: carlos.id,
      categoryId: pintura.id,
      description: "Pintar sala y comedor, aproximadamente 40 metros cuadrados. Color actual blanco, quiero gris claro.",
      status: ServiceRequestStatus.COMPLETADA,
      preferredSchedule: "TARDE",
      preferredDateTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      locationLabel: "Bogotá, Teusaquillo",
      locationLat: 4.6351,
      locationLng: -74.0721,
      locationAccuracy: 50,
    },
  });

  const quoteElectricidad = await prisma.quote.create({
    data: {
      requestId: solicitudElectricidad.id,
      professionalId: andres.id,
      amountCop: 180000,
      estimatedHours: 2,
      message: "Buenos días Carlos. Puedo instalar las 3 tomas con canaleta limpia, revisar el tablero y entregar recomendaciones de seguridad. Llevo materiales básicos y confirmo antes cualquier repuesto adicional.",
      status: QuoteStatus.PENDIENTE,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  await prisma.message.create({
    data: {
      requestId: solicitudElectricidad.id,
      senderId: andres.id,
      content: "Buenos días Carlos, estoy disponible esta semana para atender su solicitud. ¿Qué horario le queda mejor?",
    },
  });

  const quotePlomeria = await prisma.quote.create({
    data: {
      requestId: solicitudPlomeria.id,
      professionalId: andres.id,
      amountCop: 140000,
      estimatedHours: 2.5,
      message: "Reviso fuga, sifon y conexiones. Si requiere repuesto se confirma antes de instalar.",
      status: QuoteStatus.ACEPTADA,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  await prisma.job.create({
    data: {
      quoteId: quotePlomeria.id,
      clientId: carlos.id,
      professionalId: andres.id,
      status: JobStatus.EN_PROGRESO,
      paymentStatus: JobPaymentStatus.RETENIDO,
      escrowReleaseAt: new Date(Date.now() + 70 * 60 * 60 * 1000),
      payment: {
        create: {
          stripePaymentIntentId: "pi_demo_plomeria_itiw",
          amountCop: 140000,
          commissionCop: 14000,
          netProfessionalCop: 126000,
          status: PaymentStatus.COMPLETADO,
        },
      },
    },
  });

  const quotePintura = await prisma.quote.create({
    data: {
      requestId: solicitudPintura.id,
      professionalId: andres.id,
      amountCop: 520000,
      estimatedHours: 8,
      message: "Incluye preparacion de superficie, dos manos de pintura y limpieza final del area.",
      status: QuoteStatus.ACEPTADA,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  const jobPintura = await prisma.job.create({
    data: {
      quoteId: quotePintura.id,
      clientId: carlos.id,
      professionalId: andres.id,
      status: JobStatus.COMPLETADO,
      paymentStatus: JobPaymentStatus.LIBERADO,
      escrowReleaseAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      clientConfirmed: true,
      payment: {
        create: {
          stripePaymentIntentId: "pi_demo_pintura_itiw",
          amountCop: 520000,
          commissionCop: 52000,
          netProfessionalCop: 468000,
          status: PaymentStatus.COMPLETADO,
        },
      },
    },
  });

  await prisma.review.create({
    data: {
      jobId: jobPintura.id,
      reviewerId: carlos.id,
      reviewedId: andres.id,
      rating: 5,
      subcategoryRatings: {
        puntualidad: 5,
        calidad: 5,
        comunicacion: 5,
        limpieza: 5,
      },
      comment: "Andrés fue puntual, explicó cada paso y dejó el apartamento limpio. Muy recomendado.",
    },
  });

  console.log("Seed ejecutado correctamente.");
  console.log("Cliente: carlos.mendoza@example.com / Test1234!");
  console.log("Profesional: andres.ramirez@example.com / Test1234!");
  console.log(`Solicitud activa con presupuesto: ${quoteElectricidad.id}`);
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
