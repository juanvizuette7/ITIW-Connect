import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { signToken } from "../utils/jwt";
import { generateOtpCode } from "../utils/otp";
import { otpEmailTemplate, resetPasswordTemplate } from "../utils/emailTemplates";
import { sendEmail } from "../config/mailer";

type UserRole = "CLIENTE" | "PROFESIONAL";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  return /^\+?\d{10,15}$/.test(phone);
}

function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

function logOtpInDevelopment(email: string, otpCode: string) {
  if (env.nodeEnv !== "production") {
    console.log(`[DEV][OTP] ${email}: ${otpCode}`);
  }
}

export async function register(req: Request, res: Response) {
  const { name, email, phone, telefono, password, role } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    telefono?: string;
    password?: string;
    role?: UserRole;
  };

  const resolvedPhone = (phone || telefono || "").trim();

  if (!name || !email || !resolvedPhone || !password || !role) {
    return res.status(400).json({ message: "Debes completar nombre, correo, telefono, contrasena y rol." });
  }

  if (role !== "CLIENTE" && role !== "PROFESIONAL") {
    return res.status(400).json({ message: "El rol debe ser CLIENTE o PROFESIONAL." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = name.trim();

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ message: "El correo no tiene un formato valido." });
  }

  if (!isValidPhone(resolvedPhone)) {
    return res.status(400).json({ message: "El telefono debe tener entre 10 y 15 digitos." });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: "La contrasena debe tener minimo 8 caracteres." });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { phone: resolvedPhone }],
    },
  });

  if (existingUser) {
    return res.status(409).json({ message: "Ya existe una cuenta con ese correo o telefono." });
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const otpCode = generateOtpCode();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      phone: resolvedPhone,
      passwordHash,
      role,
      otpCode,
      otpExpiry,
      otpAttempts: 0,
      clientProfile:
        role === "CLIENTE"
          ? {
              create: {
                name: normalizedName,
              },
            }
          : undefined,
      professionalProfile:
        role === "PROFESIONAL"
          ? {
              create: {
                name: normalizedName,
                bio: "",
                specialties: [],
                hourlyRate: 25000,
                coverageRadiusKm: 5,
                avgRating: 0,
                totalJobs: 0,
                verifiedBadge: false,
              },
            }
          : undefined,
    },
    include: {
      clientProfile: true,
      professionalProfile: true,
    },
  });

  logOtpInDevelopment(user.email, otpCode);
  await sendEmail(user.email, "Codigo OTP de ITIW Connect", otpEmailTemplate(normalizedName, otpCode));

  const token = signToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  return res.status(201).json({
    message: "Cuenta creada correctamente.",
    token,
    user: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      name: user.clientProfile?.name || user.professionalProfile?.name || normalizedName,
    },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ message: "Debes enviar correo y contrasena." });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: {
      clientProfile: true,
      professionalProfile: true,
    },
  });

  if (!user) {
    return res.status(401).json({ message: "Correo o contrasena incorrectos." });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    return res.status(401).json({ message: "Correo o contrasena incorrectos." });
  }

  const token = signToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  return res.status(200).json({
    message: "Inicio de sesion exitoso.",
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.clientProfile?.name || user.professionalProfile?.name || "Usuario",
    },
  });
}

export async function verifyOtp(req: Request, res: Response) {
  const { email, otpCode, code } = req.body as { email?: string; otpCode?: string; code?: string };
  const resolvedCode = otpCode || code;

  if (!email || !resolvedCode) {
    return res.status(400).json({ message: "Debes enviar correo y codigo OTP." });
  }

  if (!/^\d{6}$/.test(resolvedCode)) {
    return res.status(400).json({ message: "El codigo OTP debe tener 6 digitos." });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!user) {
    return res.status(404).json({ message: "No encontramos una cuenta con ese correo." });
  }

  if (user.otpAttempts >= 3) {
    return res.status(423).json({ message: "Cuenta bloqueada por 3 intentos fallidos. Solicita un nuevo codigo." });
  }

  if (!user.otpCode || !user.otpExpiry || user.otpExpiry.getTime() < Date.now()) {
    return res.status(400).json({ message: "El codigo OTP vencio. Solicita uno nuevo." });
  }

  if (user.otpCode !== resolvedCode) {
    const attempts = user.otpAttempts + 1;

    await prisma.user.update({
      where: { id: user.id },
      data: { otpAttempts: attempts },
    });

    if (attempts >= 3) {
      return res.status(423).json({ message: "Cuenta bloqueada por 3 intentos fallidos. Solicita un nuevo codigo." });
    }

    return res.status(400).json({ message: `Codigo incorrecto. Intento ${attempts} de 3.` });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      otpCode: null,
      otpExpiry: null,
      otpAttempts: 0,
    },
  });

  return res.status(200).json({ message: "Correo verificado correctamente." });
}

export async function resendOtp(req: Request, res: Response) {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ message: "Debes enviar el correo electronico." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      clientProfile: true,
      professionalProfile: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "No encontramos una cuenta con ese correo." });
  }

  const otpCode = generateOtpCode();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      otpCode,
      otpExpiry: new Date(Date.now() + 5 * 60 * 1000),
      otpAttempts: 0,
    },
  });

  const name = user.clientProfile?.name || user.professionalProfile?.name || "Usuario";
  logOtpInDevelopment(user.email, otpCode);
  await sendEmail(user.email, "Nuevo codigo OTP de ITIW Connect", otpEmailTemplate(name, otpCode));

  return res.status(200).json({ message: "Nuevo codigo OTP enviado al correo." });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ message: "Debes enviar el correo electronico." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      clientProfile: true,
      professionalProfile: true,
    },
  });

  if (!user) {
    return res.status(200).json({
      message: "Si el correo existe, recibirás un enlace para recuperar tu contraseña.",
    });
  }

  const resetToken = uuidv4();
  const resetTokenExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry },
  });

  const resetUrl = `${env.frontendUrl}/auth/reset-password?token=${resetToken}`;
  const name = user.clientProfile?.name || user.professionalProfile?.name || "Usuario";

  await sendEmail(
    user.email,
    "Recuperar contraseña - ITIW Connect",
    resetPasswordTemplate(name, resetUrl),
  );

  return res.status(200).json({
    message: "Si el correo existe, recibirás un enlace para recuperar tu contraseña.",
  });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    return res.status(400).json({ message: "Debes enviar token y nueva contraseña." });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ message: "La nueva contraseña debe tener mínimo 8 caracteres." });
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: {
        gte: new Date(),
      },
    },
  });

  if (!user) {
    return res.status(400).json({ message: "El token es inválido o ya expiró." });
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  return res.status(200).json({ message: "Contraseña actualizada correctamente." });
}

