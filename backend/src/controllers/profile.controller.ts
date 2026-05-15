import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { recalculateProfessionalMetrics } from "../services/reviewBadge.service";

async function resolveProfessionalUserId(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      professionalProfile: {
        select: {
          id: true,
        },
      },
    },
  });

  if (user?.role === "PROFESIONAL" && user.professionalProfile) {
    return user.id;
  }

  const profile = await prisma.professionalProfile.findUnique({
    where: { id },
    select: {
      userId: true,
    },
  });

  return profile?.userId || null;
}

export async function getMyProfile(req: Request, res: Response) {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      isEmailVerified: true,
      clientProfile: {
        select: {
          id: true,
          userId: true,
          name: true,
          photoUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      professionalProfile: {
        select: {
          id: true,
          userId: true,
          name: true,
          bio: true,
          specialties: true,
          hourlyRate: true,
          coverageRadiusKm: true,
          avgRating: true,
          aiScore: true,
          reviewCount: true,
          badges: true,
          totalJobs: true,
          verifiedBadge: true,
          verificationStatus: true,
          verificationNotes: true,
          onboardingCompleted: true,
          onboardingSteps: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ message: "No encontramos tu usuario." });
  }

  const profileName =
    user.role === "PROFESIONAL"
      ? user.professionalProfile?.name || user.clientProfile?.name || "Usuario"
      : user.clientProfile?.name || user.professionalProfile?.name || "Usuario";

  return res.status(200).json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    name: profileName,
    clientProfile: user.clientProfile,
    professionalProfile: user.professionalProfile,
  });
}

export async function getPublicProfessionalProfile(req: Request, res: Response) {
  const { id } = req.params;
  const professionalUserId = await resolveProfessionalUserId(id);

  if (!professionalUserId) {
    return res.status(404).json({ message: "No encontramos el perfil profesional solicitado." });
  }

  await recalculateProfessionalMetrics(professionalUserId);

  const professional = await prisma.user.findUnique({
    where: { id: professionalUserId },
    select: {
      id: true,
      role: true,
      isIdentityVerified: true,
      professionalProfile: true,
    },
  });

  if (!professional || professional.role !== "PROFESIONAL" || !professional.professionalProfile) {
    return res.status(404).json({ message: "No encontramos el perfil profesional solicitado." });
  }

  return res.status(200).json({
    id: professional.id,
    isIdentityVerified: professional.isIdentityVerified,
    professionalProfile: professional.professionalProfile,
  });
}

export async function updateClientProfile(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { name, photoUrl, email, phone } = req.body as {
    name?: string;
    photoUrl?: string;
    email?: string;
    phone?: string;
  };

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }

  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedPhone = phone?.trim();

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: "Ingresa un correo válido." });
  }

  if (!normalizedPhone || normalizedPhone.length < 7 || normalizedPhone.length > 20) {
    return res.status(400).json({ message: "Ingresa un teléfono válido." });
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true },
  });

  if (!currentUser) {
    return res.status(404).json({ message: "No encontramos tu usuario." });
  }

  const duplicatedUser = await prisma.user.findFirst({
    where: {
      id: { not: userId },
      OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    },
    select: { email: true, phone: true },
  });

  if (duplicatedUser?.email === normalizedEmail) {
    return res.status(409).json({ message: "Ese correo ya está registrado en otra cuenta." });
  }

  if (duplicatedUser?.phone === normalizedPhone) {
    return res.status(409).json({ message: "Ese teléfono ya está registrado en otra cuenta." });
  }

  const [updatedUser, updatedProfile] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        email: normalizedEmail,
        phone: normalizedPhone,
        isEmailVerified: normalizedEmail === currentUser.email ? undefined : false,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
      },
    }),
    prisma.clientProfile.upsert({
      where: { userId },
      create: {
        userId,
        name: name.trim(),
        photoUrl: photoUrl?.trim() || null,
      },
      update: {
        name: name.trim(),
        photoUrl: photoUrl?.trim() || null,
      },
    }),
  ]);

  return res.status(200).json({
    message: "Perfil de cliente actualizado correctamente.",
    profile: updatedProfile,
    user: updatedUser,
  });
}

export async function updateProfessionalProfile(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { name, bio, specialties, hourlyRate, coverageRadiusKm } = req.body as {
    name?: string;
    bio?: string;
    specialties?: string[];
    hourlyRate?: number;
    coverageRadiusKm?: number;
  };

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }

  if (bio !== undefined && bio.length > 300) {
    return res.status(400).json({ message: "La bio no puede superar 300 caracteres." });
  }

  if (specialties !== undefined) {
    if (!Array.isArray(specialties)) {
      return res.status(400).json({ message: "Las especialidades deben enviarse como lista." });
    }

    if (specialties.length > 5) {
      return res.status(400).json({ message: "Solo se permiten hasta 5 especialidades." });
    }
  }

  if (hourlyRate !== undefined && Number(hourlyRate) < 0) {
    return res.status(400).json({ message: "La tarifa por hora no puede ser negativa." });
  }

  if (coverageRadiusKm !== undefined && Number(coverageRadiusKm) <= 0) {
    return res.status(400).json({ message: "La zona de cobertura debe ser mayor a 0." });
  }

  const updatedProfile = await prisma.professionalProfile.update({
    where: { userId },
    data: {
      name: name.trim(),
      bio: bio?.trim() || null,
      specialties: specialties?.map((specialty) => specialty.trim()).filter(Boolean) ?? undefined,
      hourlyRate: hourlyRate !== undefined ? Number(hourlyRate) : undefined,
      coverageRadiusKm: coverageRadiusKm !== undefined ? Number(coverageRadiusKm) : undefined,
    },
  });

  return res.status(200).json({
    message: "Perfil profesional actualizado correctamente.",
    profile: updatedProfile,
  });
}
