import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import passport from "passport";
import { Profile, Strategy as GoogleStrategy } from "passport-google-oauth20";
import { v4 as uuidv4 } from "uuid";
import { env } from "./env";
import { prisma } from "./prisma";
import { JwtPayload, signToken } from "../utils/jwt";

type OauthSessionUser = JwtPayload & {
  token: string;
};

type RequestedOauthRole = "CLIENTE" | "PROFESIONAL";

function isPlaceholder(value: string) {
  return value.trim().toLowerCase().includes("placeholder");
}

export function isGoogleOauthConfigured(): boolean {
  if (!env.googleClientId || !env.googleClientSecret) {
    return false;
  }

  return !isPlaceholder(env.googleClientId) && !isPlaceholder(env.googleClientSecret);
}

async function generateUniquePhone(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `3${Math.floor(100_000_000 + Math.random() * 900_000_000)}`;
    const existing = await prisma.user.findUnique({
      where: { phone: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  return `3${Date.now().toString().slice(-9)}`;
}

function resolveRequestedRole(value: unknown): RequestedOauthRole {
  return value === Role.PROFESIONAL ? Role.PROFESIONAL : Role.CLIENTE;
}

async function userHasRoleActivity(userId: string) {
  const [requestsAsClient, jobsAsClient, jobsAsProfessional, quotesAsProfessional] = await Promise.all([
    prisma.serviceRequest.count({ where: { clientId: userId } }),
    prisma.job.count({ where: { clientId: userId } }),
    prisma.job.count({ where: { professionalId: userId } }),
    prisma.quote.count({ where: { professionalId: userId } }),
  ]);

  return requestsAsClient + jobsAsClient + jobsAsProfessional + quotesAsProfessional > 0;
}

async function ensureProfileForRole(userId: string, role: RequestedOauthRole, name: string) {
  if (role === Role.CLIENTE) {
    await prisma.clientProfile.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        name,
      },
    });
    return;
  }

  await prisma.professionalProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      name,
      specialties: [],
      hourlyRate: 25000,
      coverageRadiusKm: 5,
    },
  });
}

async function findOrCreateOauthUser(profile: Profile, requestedRole: RequestedOauthRole) {
  const email = profile.emails?.[0]?.value?.trim().toLowerCase();
  if (!email) {
    throw new Error("Google no envio un correo valido para autenticar la cuenta.");
  }

  const displayName = profile.displayName?.trim() || "Usuario Google";

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      clientProfile: {
        select: { id: true, name: true },
      },
      professionalProfile: {
        select: { id: true, name: true },
      },
    },
  });

  if (existingUser) {
    if (!existingUser.isActive) {
      throw new Error("Tu cuenta esta desactivada temporalmente. Contacta soporte.");
    }

    let resolvedRole = existingUser.role;
    if (existingUser.role !== requestedRole) {
      const hasActivity = await userHasRoleActivity(existingUser.id);
      if (hasActivity) {
        throw new Error(
          existingUser.role === Role.CLIENTE
            ? "Este correo ya esta registrado como cliente. Usa otro correo para crear perfil profesional."
            : "Este correo ya esta registrado como profesional. Usa otro correo para crear perfil cliente.",
        );
      }

      const switchedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: requestedRole },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          clientProfile: {
            select: { id: true, name: true },
          },
          professionalProfile: {
            select: { id: true, name: true },
          },
        },
      });
      resolvedRole = switchedUser.role;
    }

    await ensureProfileForRole(existingUser.id, resolvedRole as RequestedOauthRole, displayName);

    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        isEmailVerified: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    return updatedUser;
  }

  const generatedPhone = await generateUniquePhone();
  const passwordHash = await bcrypt.hash(uuidv4(), env.bcryptRounds);

  const created = await prisma.user.create({
    data: {
      email,
      phone: generatedPhone,
      passwordHash,
      role: requestedRole,
      isEmailVerified: true,
      clientProfile:
        requestedRole === Role.CLIENTE
          ? {
              create: {
                name: displayName,
              },
            }
          : undefined,
      professionalProfile:
        requestedRole === Role.PROFESIONAL
          ? {
              create: {
                name: displayName,
                specialties: [],
                hourlyRate: 25000,
                coverageRadiusKm: 5,
              },
            }
          : undefined,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  });

  return created;
}

export function configurePassport() {
  if (!isGoogleOauthConfigured()) {
    return;
  }

  const passportInternal = passport as unknown as { _strategy?: (name: string) => unknown };
  if (passportInternal._strategy?.("google")) {
    return;
  }

  const explicitCallbackUrl = process.env.GOOGLE_CALLBACK_URL?.trim();
  const renderExternalUrl = process.env.RENDER_EXTERNAL_URL?.trim();
  const callbackURL = explicitCallbackUrl
    || (renderExternalUrl ? `${renderExternalUrl.replace(/\/$/, "")}/api/auth/google/callback` : "")
    || `http://localhost:${env.port}/api/auth/google/callback`;

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL,
        passReqToCallback: true,
      },
      async (req: Request, _accessToken, _refreshToken, profile, done) => {
        try {
          const requestedRole = resolveRequestedRole(req.query.state);
          const user = await findOrCreateOauthUser(profile, requestedRole);
          const token = signToken({
            userId: user.id,
            role: user.role,
            email: user.email,
          });

          done(
            null,
            {
              userId: user.id,
              role: user.role,
              email: user.email,
              token,
            } as OauthSessionUser,
          );
        } catch (error) {
          done(error as Error);
        }
      },
    ),
  );
}

export function getPassportGoogleAuthMiddleware(role?: string) {
  const requestedRole = resolveRequestedRole(role);

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    prompt: "select_account",
    state: requestedRole,
  });
}

export function getPassportGoogleCallbackMiddleware() {
  return passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.frontendUrl}/auth/login?oauthError=google_failed`,
  });
}

export function runGoogleAuthCallback(req: Request, res: Response, next: NextFunction) {
  const providerError = typeof req.query.error === "string" ? req.query.error : "";
  const providerErrorDescription =
    typeof req.query.error_description === "string" ? req.query.error_description : "";

  if (providerError || providerErrorDescription) {
    const reason = providerErrorDescription || providerError;
    return res.redirect(
      `${env.frontendUrl}/auth/login?oauthError=${encodeURIComponent(reason)}`,
    );
  }

  return passport.authenticate(
    "google",
    { session: false },
    (error: Error | null, user?: OauthSessionUser) => {
      if (error) {
        return res.redirect(
          `${env.frontendUrl}/auth/login?oauthError=${encodeURIComponent(error.message || "google_failed")}`,
        );
      }

      if (!user?.token) {
        return res.redirect(
          `${env.frontendUrl}/auth/login?oauthError=${encodeURIComponent("No se pudo validar la cuenta de Google.")}`,
        );
      }

      return res.redirect(
        `${env.frontendUrl}/auth/oauth-success?token=${encodeURIComponent(user.token)}`,
      );
    },
  )(req, res, next);
}
