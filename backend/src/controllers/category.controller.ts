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
    orderBy: {
      name: "asc",
    },
  });

  return res.status(200).json(categories);
}
