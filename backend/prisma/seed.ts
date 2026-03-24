import { PrismaClient } from "@prisma/client";
import { CANONICAL_CATEGORY_NAMES } from "../src/constants/categories";

const prisma = new PrismaClient();

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

async function main() {
  await Promise.all(
    CANONICAL_CATEGORY_NAMES.map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {
          iconUrl: `https://cdn.itiwconnect.com/icons/${slugify(name)}.png`,
        },
        create: {
          name,
          iconUrl: `https://cdn.itiwconnect.com/icons/${slugify(name)}.png`,
        },
      }),
    ),
  );

  // Limpia categorias legacy que no sean parte del set canonico
  // y que no tengan solicitudes asociadas para evitar romper historial.
  await prisma.category.deleteMany({
    where: {
      name: {
        notIn: [...CANONICAL_CATEGORY_NAMES],
      },
      serviceRequests: {
        none: {},
      },
    },
  });

  console.log("Seed ejecutado: categorias canonicas de Sprint 2 creadas/actualizadas.");
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
