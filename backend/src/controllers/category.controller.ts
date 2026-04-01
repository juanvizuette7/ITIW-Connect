import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { CANONICAL_CATEGORY_NAMES } from "../constants/categories";

export async function listCategories(_req: Request, res: Response) {
  const categories = await prisma.category.findMany({
    where: {
      name: {
        in: [...CANONICAL_CATEGORY_NAMES],
      },
    },
  });

  const ordered = categories.sort((a, b) => {
    const aIndex = CANONICAL_CATEGORY_NAMES.findIndex((name) => name === a.name);
    const bIndex = CANONICAL_CATEGORY_NAMES.findIndex((name) => name === b.name);
    return aIndex - bIndex;
  });

  return res.status(200).json(ordered);
}
