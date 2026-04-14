import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export async function uploadPortfolioPhoto(req: Request, res: Response) {
  const professionalId = req.user!.userId;
  const { photoUrl, description } = req.body as {
    photoUrl?: string;
    description?: string;
  };

  const professional = await prisma.user.findUnique({
    where: { id: professionalId },
    select: { role: true },
  });

  if (!professional || professional.role !== Role.PROFESIONAL) {
    return res.status(403).json({ message: "Solo profesionales pueden gestionar portafolio." });
  }

  if (!photoUrl || !photoUrl.trim()) {
    return res.status(400).json({ message: "Debes enviar la foto en base64." });
  }

  const normalizedPhoto = photoUrl.trim();

  if (!normalizedPhoto.startsWith("data:image/")) {
    return res.status(400).json({ message: "La foto debe enviarse en formato base64 de imagen valida." });
  }

  if (normalizedPhoto.length > 5_000_000) {
    return res.status(400).json({ message: "La imagen es demasiado grande para el MVP. Reduce su tamano." });
  }

  const count = await prisma.portfolioPhoto.count({
    where: {
      professionalId,
    },
  });

  if (count >= 10) {
    return res.status(400).json({ message: "Maximo 10 fotos en el portafolio profesional." });
  }

  const created = await prisma.portfolioPhoto.create({
    data: {
      professionalId,
      photoUrl: normalizedPhoto,
      description: description?.trim() || null,
    },
  });

  return res.status(201).json({
    message: "Foto agregada al portafolio correctamente.",
    photo: created,
  });
}

export async function listPortfolioPhotos(req: Request, res: Response) {
  const { professionalId } = req.params;

  const user = await prisma.user.findUnique({
    where: { id: professionalId },
    select: {
      id: true,
      role: true,
      professionalProfile: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!user || user.role !== Role.PROFESIONAL || !user.professionalProfile) {
    return res.status(404).json({ message: "No encontramos el profesional solicitado." });
  }

  const photos = await prisma.portfolioPhoto.findMany({
    where: {
      professionalId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return res.status(200).json({
    professional: {
      id: user.id,
      name: user.professionalProfile.name,
    },
    total: photos.length,
    photos,
  });
}

export async function deletePortfolioPhoto(req: Request, res: Response) {
  const professionalId = req.user!.userId;
  const { photoId } = req.params;

  const photo = await prisma.portfolioPhoto.findUnique({
    where: { id: photoId },
  });

  if (!photo) {
    return res.status(404).json({ message: "No encontramos la foto indicada." });
  }

  if (photo.professionalId !== professionalId) {
    return res.status(403).json({ message: "Solo puedes eliminar fotos de tu propio portafolio." });
  }

  await prisma.portfolioPhoto.delete({
    where: {
      id: photoId,
    },
  });

  return res.status(200).json({
    message: "Foto eliminada del portafolio correctamente.",
  });
}
