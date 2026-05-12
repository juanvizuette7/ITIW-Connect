import { Request, Response } from "express";
import { prisma } from "../config/prisma";

type OnboardingSteps = {
  perfilCompleto: boolean;
  zonaConfigurada: boolean;
  identidadVerificada: boolean;
  fotoPortafolio: boolean;
};

function calculateProgress(steps: OnboardingSteps) {
  const values = Object.values(steps);
  const completed = values.filter(Boolean).length;
  return {
    completed,
    total: values.length,
    percentage: Math.round((completed / values.length) * 100),
  };
}

async function getOnboardingData(userId: string) {
  const [user, portfolioCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        isIdentityVerified: true,
        professionalProfile: {
          select: {
            name: true,
            bio: true,
            specialties: true,
            coverageRadiusKm: true,
            onboardingCompleted: true,
            onboardingSteps: true,
          },
        },
      },
    }),
    prisma.portfolioPhoto.count({
      where: {
        professionalId: userId,
      },
    }),
  ]);

  if (!user || user.role !== "PROFESIONAL" || !user.professionalProfile) {
    return null;
  }

  const profile = user.professionalProfile;

  const steps: OnboardingSteps = {
    perfilCompleto:
      Boolean(profile.name?.trim()) &&
      Boolean(profile.bio?.trim()) &&
      Array.isArray(profile.specialties) &&
      profile.specialties.length > 0,
    zonaConfigurada: Number(profile.coverageRadiusKm) > 0,
    identidadVerificada: Boolean(user.isIdentityVerified),
    fotoPortafolio: portfolioCount > 0,
  };

  const progress = calculateProgress(steps);

  return {
    profile,
    steps,
    progress,
    portfolioCount,
    allCompleted: progress.completed === progress.total,
  };
}

export async function getOnboardingStatus(req: Request, res: Response) {
  const userId = req.user!.userId;

  const onboardingData = await getOnboardingData(userId);

  if (!onboardingData) {
    return res.status(403).json({ message: "Solo profesionales pueden acceder al onboarding." });
  }

  return res.status(200).json({
    onboardingCompleted: onboardingData.profile.onboardingCompleted,
    steps: onboardingData.steps,
    progress: onboardingData.progress,
    portfolioCount: onboardingData.portfolioCount,
    allCompleted: onboardingData.allCompleted,
  });
}

export async function completeOnboarding(req: Request, res: Response) {
  const userId = req.user!.userId;

  const onboardingData = await getOnboardingData(userId);

  if (!onboardingData) {
    return res.status(403).json({ message: "Solo profesionales pueden completar onboarding." });
  }

  if (!onboardingData.allCompleted) {
    return res.status(400).json({
      message: "Aun faltan pasos por completar en tu onboarding.",
      steps: onboardingData.steps,
    });
  }

  const updated = await prisma.professionalProfile.update({
    where: { userId },
    data: {
      onboardingCompleted: true,
      onboardingSteps: onboardingData.steps,
    },
    select: {
      onboardingCompleted: true,
      onboardingSteps: true,
    },
  });

  return res.status(200).json({
    message: "Onboarding completado correctamente.",
    onboardingCompleted: updated.onboardingCompleted,
    steps: updated.onboardingSteps,
  });
}
