import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { paginatedResponse, resolvePagination } from "../utils/pagination";

type SearchQuery = {
  q?: string;
  categoryId?: string;
  ratingMin?: string;
  coverageKm?: string;
  page?: string;
  limit?: string;
};

function normalize(text: string) {
  return text.trim().toLowerCase();
}

export async function searchProfessionals(req: Request, res: Response) {
  const query = req.query as SearchQuery;
  const { page, limit, skip, take } = resolvePagination(query);
  const text = normalize(query.q || "");
  const ratingMin = query.ratingMin ? Number(query.ratingMin) : null;
  const coverageKm = query.coverageKm ? Number(query.coverageKm) : null;

  if (query.ratingMin && (ratingMin === null || !Number.isFinite(ratingMin) || ratingMin < 1 || ratingMin > 5)) {
    return res.status(400).json({ message: "La calificacion minima debe estar entre 1 y 5." });
  }

  if (query.coverageKm && (coverageKm === null || !Number.isFinite(coverageKm) || coverageKm < 1)) {
    return res.status(400).json({ message: "El radio de cobertura debe ser mayor a 0." });
  }

  let categoryName = "";
  if (query.categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: query.categoryId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!category) {
      return res.status(404).json({ message: "La categoria seleccionada no existe." });
    }

    categoryName = category.name;
  }

  const textFilter = text
    ? {
        OR: [
          {
            name: {
              contains: text,
              mode: "insensitive" as const,
            },
          },
          {
            bio: {
              contains: text,
              mode: "insensitive" as const,
            },
          },
          {
            specialties: {
              has: text,
            },
          },
        ],
      }
    : {};

  const where = {
    user: {
      role: Role.PROFESIONAL,
      isActive: true,
    },
    ...(categoryName
      ? {
          specialties: {
            has: categoryName,
          },
        }
      : {}),
    ...(ratingMin !== null
      ? {
          avgRating: {
            gte: ratingMin,
          },
        }
      : {}),
    ...(coverageKm !== null
      ? {
          coverageRadiusKm: {
            gte: coverageKm,
          },
        }
      : {}),
    ...textFilter,
  };

  const [total, professionals] = await Promise.all([
    prisma.professionalProfile.count({ where }),
    prisma.professionalProfile.findMany({
      where,
      select: {
        userId: true,
        name: true,
        bio: true,
        specialties: true,
        hourlyRate: true,
        coverageRadiusKm: true,
        avgRating: true,
        reviewCount: true,
        totalJobs: true,
        verifiedBadge: true,
        badges: true,
        user: {
          select: {
            isIdentityVerified: true,
          },
        },
      },
      orderBy: [{ verifiedBadge: "desc" }, { avgRating: "desc" }, { totalJobs: "desc" }],
      skip,
      take,
    }),
  ]);

  return res.status(200).json(
    paginatedResponse({
      data: professionals.map((professional) => ({
        id: professional.userId,
        name: professional.name,
        bio: professional.bio,
        specialties: professional.specialties,
        hourlyRate: Number(professional.hourlyRate),
        coverageRadiusKm: professional.coverageRadiusKm,
        avgRating: Number(professional.avgRating),
        reviewCount: professional.reviewCount,
        totalJobs: professional.totalJobs,
        verifiedBadge: professional.verifiedBadge || professional.user.isIdentityVerified,
        badges: professional.badges,
      })),
      total,
      page,
      limit,
    }),
  );
}
