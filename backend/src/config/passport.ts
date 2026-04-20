import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import passport from "passport";
import { Profile, Strategy as GoogleStrategy } from "passport-google-oauth20";
import { v4 as uuidv4 } from "uuid";
import { env } from "./env";
import { prisma } from "./prisma";
import { JwtPayload, signToken } from "../utils/jwt";

type OauthSessionUser = JwtPayload & {
  token: string;
};

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

async function findOrCreateOauthUser(profile: Profile) {
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

    if (existingUser.role === Role.CLIENTE && !existingUser.clientProfile) {
      await prisma.clientProfile.create({
        data: {
          userId: existingUser.id,
          name: displayName,
        },
      });
    }

    if (existingUser.role === Role.PROFESIONAL && !existingUser.professionalProfile) {
      await prisma.professionalProfile.create({
        data: {
          userId: existingUser.id,
          name: displayName,
          specialties: [],
          hourlyRate: 25000,
          coverageRadiusKm: 5,
        },
      });
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        isEmailVerified: true,
      },
    });

    return existingUser;
  }

  const generatedPhone = await generateUniquePhone();
  const passwordHash = await bcrypt.hash(uuidv4(), env.bcryptRounds);

  const created = await prisma.user.create({
    data: {
      email,
      phone: generatedPhone,
      passwordHash,
      role: Role.CLIENTE,
      isEmailVerified: true,
      clientProfile: {
        create: {
          name: displayName,
        },
      },
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

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.googleClientId,
        clientSecret: env.googleClientSecret,
        callbackURL: `http://localhost:${env.port}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOauthUser(profile);
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

export function getPassportGoogleAuthMiddleware() {
  return passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    prompt: "select_account",
  });
}

export function getPassportGoogleCallbackMiddleware() {
  return passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.frontendUrl}/auth/login?oauthError=google_failed`,
  });
}
