"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";
import { apiRequest } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

interface LoginResponse {
  message: string;
  token: string;
  user?: {
    role: "CLIENTE" | "PROFESIONAL" | "ADMIN";
  };
  role?: "CLIENTE" | "PROFESIONAL" | "ADMIN";
}

type OnboardingStatusResponse = {
  onboardingCompleted: boolean;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const role = data.role || data.user?.role;
      saveSession(data.token, role);

      if (role === "ADMIN") {
        router.push("/admin/dashboard");
        return;
      }

      if (role === "PROFESIONAL") {
        try {
          const onboardingStatus = await apiRequest<OnboardingStatusResponse>("/onboarding/status", {
            method: "GET",
            token: data.token,
          });

          if (!onboardingStatus.onboardingCompleted) {
            router.push("/dashboard/onboarding");
            return;
          }
        } catch {
          router.push("/dashboard");
          return;
        }
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      leftTitle="Bienvenido de vuelta"
      leftDescription="Inicia sesion para administrar tus solicitudes o tu perfil profesional en segundos."
      benefits={[
        "Historial completo de solicitudes y cotizaciones.",
        "Respuestas rapidas desde una sola bandeja.",
        "Perfil y reputacion centralizada en la plataforma.",
      ]}
    >
      <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Iniciar sesion</h1>
      <p className="mt-2 text-sm text-brand-muted">Accede con tu correo y contrasena.</p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1.5 block text-sm text-[#d5dded]">Correo</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="premium-input"
            placeholder="nombre@correo.com"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[#d5dded]">Contrasena</label>
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="premium-input"
            placeholder="Tu contrasena"
          />
        </div>

        <div className="text-right">
          <Link href="/auth/forgot-password" className="text-sm text-brand-accent hover:underline">
            Olvidaste tu contrasena?
          </Link>
        </div>

        <GoogleAuthButton onError={setError} />

        {error && (
          <p className="premium-error">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#ff9bac]/60 text-xs">
                !
              </span>
              <span>{error}</span>
            </span>
          </p>
        )}

        <button disabled={loading} className="premium-btn-primary w-full">
          {loading ? "Ingresando..." : "Iniciar sesion ?"}
        </button>
      </form>

      <p className="mt-5 text-sm text-brand-muted">
        Aun no tienes cuenta?{" "}
        <Link href="/auth/register" className="font-medium text-brand-accent hover:underline">
          Registrate
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
