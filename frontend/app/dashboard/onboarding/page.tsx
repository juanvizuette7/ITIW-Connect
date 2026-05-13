"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { LoadingDots } from "@/components/LoadingDots";

 type OnboardingStatusResponse = {
  onboardingCompleted: boolean;
  steps: {
    perfilCompleto: boolean;
    zonaConfigurada: boolean;
    identidadVerificada: boolean;
    fotoPortafolio: boolean;
  };
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  portfolioCount: number;
  allCompleted: boolean;
};

type ProfileMeResponse = {
  name: string;
  role: "CLIENTE" | "PROFESIONAL" | "ADMIN";
  professionalProfile?: {
    name: string | null;
    photoUrl?: string | null;
    specialties: string[];
    hourlyRate: number | null;
    coverageRadiusKm: number | null;
  } | null;
};

type StepItem = {
  key: keyof OnboardingStatusResponse["steps"];
  icon: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<OnboardingStatusResponse | null>(null);
  const [profile, setProfile] = useState<ProfileMeResponse["professionalProfile"]>(null);
  const autoCompleteTriggered = useRef(false);

  async function loadStatus(authToken: string) {
    const onboardingStatus = await apiRequest<OnboardingStatusResponse>("/onboarding/status", {
      method: "GET",
      token: authToken,
    });

    setStatus(onboardingStatus);
    if (onboardingStatus.onboardingCompleted) {
      setMessage("Perfil completo. Ya puedes recibir solicitudes.");
    }
  }

  useEffect(() => {
    const authToken = getToken();
    if (!authToken) {
      router.replace("/auth/login");
      return;
    }

    setToken(authToken);

    const init = async () => {
      try {
        const me = await apiRequest<ProfileMeResponse>("/profile/me", {
          method: "GET",
          token: authToken,
        });

        if (me.role !== "PROFESIONAL") {
          router.replace("/dashboard");
          return;
        }

        setUserName(me.name);
        setProfile(me.professionalProfile || null);
        await loadStatus(authToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el onboarding.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  const steps = useMemo<StepItem[]>(() => {
    if (!status) return [];

    const hasBasicInfo = Boolean(profile?.name?.trim());
    const hasServicesAndRate = Boolean(profile?.specialties?.length) && Number(profile?.hourlyRate || 0) > 0;
    const hasCoverage = Number(profile?.coverageRadiusKm || 0) > 0;

    return [
      {
        key: "perfilCompleto",
        icon: "persona",
        title: "Completa tu informacion basica",
        description: "Agrega tu nombre completo y una foto profesional para que los clientes te reconozcan.",
        done: hasBasicInfo,
        href: "/dashboard/profile",
      },
      {
        key: "identidadVerificada",
        icon: "herramienta",
        title: "Define tus servicios y tarifa",
        description: "Selecciona hasta 5 especialidades y define tu tarifa por hora para aparecer en busquedas relevantes.",
        done: hasServicesAndRate,
        href: "/dashboard/profile",
      },
      {
        key: "zonaConfigurada",
        icon: "pin",
        title: "Configura tu zona de trabajo",
        description: "Define el radio en kilometros donde atiendes solicitudes. Solo recibiras solicitudes dentro de esa area.",
        done: hasCoverage,
        href: "/dashboard/profile",
      },
      {
        key: "fotoPortafolio",
        icon: "foto",
        title: "Sube fotos de trabajos anteriores",
        description: "Los profesionales con portafolio reciben 3 veces mas solicitudes. Sube al menos una foto para empezar.",
        done: status.steps.fotoPortafolio,
        href: "/dashboard/profile",
      },
    ];
  }, [profile, status]);

  const completedSteps = steps.filter((step) => step.done).length;
  const totalSteps = steps.length || 4;
  const progressPercentage = Math.round((completedSteps / totalSteps) * 100);

  async function onCompleteOnboarding() {
    if (!token) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<{ message: string }>("/onboarding/complete", {
        method: "PUT",
        token,
      });
      setMessage(response.message || "Perfil completo. Ya puedes recibir solicitudes.");
      await loadStatus(token);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible completar el onboarding.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!token || !status) return;
    if (autoCompleteTriggered.current) return;

    if (status.allCompleted && !status.onboardingCompleted) {
      autoCompleteTriggered.current = true;
      void onCompleteOnboarding();
    }
  }, [status, token]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  if (loading) {
    return <ScreenSkeleton variant="profile" />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel-strong relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--brand-accent)]/16 blur-3xl" />
        <div className="relative z-10">
          <span className="inline-flex rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#ffd0bd]">
            Onboarding profesional
          </span>
          <h1 className="mt-4 font-[var(--font-heading)] text-3xl font-extrabold text-white md:text-5xl">
            Prepara tu perfil para recibir mejores solicitudes
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-muted md:text-base">
            Completa estos cuatro puntos para que los clientes entiendan que haces, cuanto cobras, donde atiendes y que trabajos puedes demostrar.
          </p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-[#0D1117] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Progreso real del perfil</p>
                <p className="text-xs text-brand-muted">{completedSteps} de {totalSteps} pasos completados</p>
              </div>
              <span className="font-[var(--font-heading)] text-3xl font-extrabold text-[var(--brand-accent)]">{progressPercentage}%</span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-[var(--brand-accent)] shadow-[0_0_24px_rgba(255,107,44,0.35)] transition-all duration-700 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {error && <p className="premium-error mt-4">{error}</p>}
          {message && <p className="premium-success mt-4">{message}</p>}

          <div className="relative mt-8 space-y-4">
            <div className="absolute bottom-8 left-7 top-8 hidden w-px bg-white/10 md:block" />
            {steps.map((step, index) => (
              <article
                key={step.key}
                className="relative rounded-2xl border border-white/[0.06] bg-[#0D1117] p-5 opacity-0 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/35 hover:shadow-[0_0_20px_rgba(255,107,44,0.15)]"
                style={{ animation: "onboarding-step-in 420ms ease forwards", animationDelay: `${index * 90}ms` }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex gap-4">
                    <div className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border font-[var(--font-heading)] text-lg font-extrabold transition duration-300 ${step.done ? "border-emerald-400/50 bg-emerald-400/16 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.2)] animate-check-scale" : "border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/12 text-[#ffd0bd]"}`}>
                      {step.done ? "✓" : index + 1}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-[var(--font-heading)] text-xl font-bold text-white">{step.title}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${step.done ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200" : "border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/10 text-[#ffd0bd]"}`}>
                          {step.done ? "Completado" : "Pendiente"}
                        </span>
                      </div>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">{step.description}</p>
                    </div>
                  </div>

                  {step.done ? (
                    <span className="inline-flex items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-400/12 px-4 py-2 text-sm font-semibold text-emerald-200">
                      Listo
                    </span>
                  ) : (
                    <Link href={step.href} className="premium-btn-primary text-center text-sm">
                      Completar
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>

          {status?.allCompleted ? (
            <div className="relative mt-7 overflow-hidden rounded-2xl border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/10 p-5">
              <p className="font-[var(--font-heading)] text-2xl font-bold text-white">Perfil completo. Ya puedes recibir solicitudes.</p>
              <p className="mt-2 text-sm text-brand-muted">Tu perfil tiene la informacion clave para que el sistema te recomiende en solicitudes relevantes.</p>
              <Link href="/dashboard" className="premium-btn-primary mt-4 inline-flex">Ir al dashboard</Link>
              <div className="pointer-events-none absolute inset-0">
                {Array.from({ length: 14 }).map((_, index) => (
                  <span
                    key={index}
                    className="absolute h-2 w-2 rounded-full bg-[var(--brand-accent)] confetti-dot"
                    style={{ left: `${8 + index * 6}%`, top: `${18 + (index % 4) * 16}%`, animationDelay: `${index * 70}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onCompleteOnboarding}
                disabled={saving || !status?.allCompleted}
                className="premium-btn-primary min-w-48 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <LoadingDots label="Actualizando" /> : "Finalizar onboarding"}
              </button>
              <Link href="/dashboard" className="premium-btn-secondary px-5 py-3">Ir al dashboard</Link>
            </div>
          )}
        </div>
      </section>

      <style jsx global>{`
        @keyframes onboarding-step-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes check-scale {
          0% { transform: scale(0.75); }
          65% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        @keyframes confetti-pop {
          0% { opacity: 0; transform: translateY(18px) scale(0.7) rotate(0deg); }
          45% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-60px) scale(1.1) rotate(160deg); }
        }
        .animate-check-scale { animation: check-scale 360ms ease both; }
        .confetti-dot { animation: confetti-pop 1.4s ease-in-out infinite; }
      `}</style>
    </main>
  );
}
