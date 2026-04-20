import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { CANONICAL_CATEGORY_NAMES } from "../constants/categories";
import { getCachedCategories, setCachedCategories } from "../services/cache.service";

export async function listCategories(_req: Request, res: Response) {
  const cached = getCachedCategories<Awaited<ReturnType<typeof prisma.category.findMany>>>();
  if (cached) {
    return res.status(200).json(cached);
  }

  const categories = await prisma.category.findMany({
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

  const ordered = categories.sort((a, b) => {
    const aIndex = CANONICAL_CATEGORY_NAMES.findIndex((name) => name === a.name);
    const bIndex = CANONICAL_CATEGORY_NAMES.findIndex((name) => name === b.name);
    return aIndex - bIndex;
  });

  setCachedCategories(ordered);

  return res.status(200).json(ordered);
}
