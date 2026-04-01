import { BadgeType } from "@prisma/client";
import { prisma } from "../config/prisma";

export type SubcategoryRatingsInput = {
  puntualidad: number;
  calidad: number;
  comunicacion: number;
  limpieza: number;
};

const BADGE_ORDER: BadgeType[] = ["VERIFICADO", "NUEVO_TALENTO", "TOP_RATED", "EXPERTO"];

function isValidRatingValue(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

export function parseSubcategoryRatings(value: unknown): SubcategoryRatingsInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  const parsed: SubcategoryRatingsInput = {
    puntualidad: Number(candidate.puntualidad),
    calidad: Number(candidate.calidad),
    comunicacion: Number(candidate.comunicacion),
    limpieza: Number(candidate.limpieza),
  };

  const allValid =
    isValidRatingValue(parsed.puntualidad) &&
    isValidRatingValue(parsed.calidad) &&
    isValidRatingValue(parsed.comunicacion) &&
    isValidRatingValue(parsed.limpieza);

  return allValid ? parsed : null;
}

export async function recalculateProfessionalMetrics(
  professionalId: string,
  tx: any = prisma,
) {
  const reviews = await tx.review.findMany({
    where: {
      reviewedId: professionalId,
    },
    select: {
      rating: true,
      createdAt: true,
    },
  });

  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

  let weightedTotal = 0;
  let weights = 0;

  for (const review of reviews) {
    const weight = review.createdAt.getTime() >= ninetyDaysAgo ? 1.5 : 1;
    weightedTotal += review.rating * weight;
    weights += weight;
  }

  const avgRating = weights > 0 ? Number((weightedTotal / weights).toFixed(2)) : 0;
  const reviewCount = reviews.length;

  await tx.professionalProfile.update({
    where: { userId: professionalId },
    data: {
      avgRating,
      reviewCount,
    },
  });

  return { avgRating, reviewCount };
}

export async function assignProfessionalBadges(
  professionalId: string,
  tx: any = prisma,
) {
  const user = await tx.user.findUnique({
    where: { id: professionalId },
    include: {
      professionalProfile: true,
      badges: true,
    },
  });

  if (!user || !user.professionalProfile) {
    return [] as BadgeType[];
  }

  const candidates: BadgeType[] = [];

  if (user.isIdentityVerified) {
    candidates.push("VERIFICADO");
  }

  if (user.professionalProfile.totalJobs >= 1 && user.professionalProfile.totalJobs <= 5) {
    candidates.push("NUEVO_TALENTO");
  }

  if (Number(user.professionalProfile.avgRating) >= 4.8 && user.professionalProfile.reviewCount >= 10) {
    candidates.push("TOP_RATED");
  }

  if (user.professionalProfile.totalJobs >= 50) {
    candidates.push("EXPERTO");
  }

  const existing = new Set(user.badges.map((badge: { type: BadgeType }) => badge.type));
  const toCreate = candidates.filter((badge) => !existing.has(badge));

  if (toCreate.length > 0) {
    await tx.badge.createMany({
      data: toCreate.map((badgeType) => ({
        userId: professionalId,
        type: badgeType,
      })),
      skipDuplicates: true,
    });
  }

  const merged = new Set<BadgeType>([
    ...user.professionalProfile.badges.map((badge: string) => badge as BadgeType),
    ...user.badges.map((badge: { type: BadgeType }) => badge.type),
    ...toCreate,
  ]);

  const orderedBadges = BADGE_ORDER.filter((badge) => merged.has(badge));

  await tx.professionalProfile.update({
    where: { userId: professionalId },
    data: {
      badges: orderedBadges,
      verifiedBadge: orderedBadges.includes("VERIFICADO"),
    },
  });

  return toCreate;
}
