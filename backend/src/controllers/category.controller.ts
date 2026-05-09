import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { CANONICAL_CATEGORY_NAMES } from "../constants/categories";
import { getCachedCategories, setCachedCategories } from "../services/cache.service";

type CategoryListItem = {
  id: string;
  name: string;
  iconUrl: string | null;
};

function orderCategories(categories: CategoryListItem[]) {
  return categories.sort((a, b) => {
    const aIndex = CANONICAL_CATEGORY_NAMES.findIndex((name) => name === a.name);
    const bIndex = CANONICAL_CATEGORY_NAMES.findIndex((name) => name === b.name);
    return aIndex - bIndex;
  });
}

async function findCanonicalCategories() {
  return prisma.category.findMany({
    where: {
      name: {
        in: [...CANONICAL_CATEGORY_NAMES],
      },
    },
    select: {
      id: true,
      name: true,
      iconUrl: true,
    },
  });
}

async function ensureCanonicalCategories() {
  await Promise.all(
    CANONICAL_CATEGORY_NAMES.map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {
          iconUrl: null,
        },
        create: {
          name,
          iconUrl: null,
        },
      }),
    ),
  );
}

export async function listCategories(_req: Request, res: Response) {
  const cached = getCachedCategories<CategoryListItem[]>();
  if (cached && cached.length > 0) {
    return res.status(200).json(cached);
  }

  let categories = await findCanonicalCategories();

  if (categories.length < CANONICAL_CATEGORY_NAMES.length) {
    await ensureCanonicalCategories();
    categories = await findCanonicalCategories();
  }

  const ordered = orderCategories(categories);
  setCachedCategories(ordered);

  return res.status(200).json(ordered);
}
