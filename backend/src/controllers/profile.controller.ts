import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function getMyProfile(req: Request, res: Response) {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      clientProfile: true,
      professionalProfile: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "No encontramos tu usuario." });
  }

  const profileName = user.clientProfile?.name || user.professionalProfile?.name || "Usuario";

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

export async function updateClientProfile(req: Request, res: Response) {
  const userId = req.user!.userId;
  const { name, photoUrl } = req.body as {
    name?: string;
    photoUrl?: string;
  };

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }

  const updatedProfile = await prisma.clientProfile.update({
    where: { userId },
    data: {
      name: name.trim(),
      photoUrl: photoUrl?.trim() || null,
    },
  });

  return res.status(200).json({
    message: "Perfil de cliente actualizado correctamente.",
    profile: updatedProfile,
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
