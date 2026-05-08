"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";

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
  const autoCompleteTriggered = useRef(false);

  async function loadStatus(authToken: string) {
    const onboardingStatus = await apiRequest<OnboardingStatusResponse>("/onboarding/status", {
      method: "GET",
      token: authToken,
    });

    setStatus(onboardingStatus);
    if (onboardingStatus.onboardingCompleted) {
      setMessage("Tu onboarding ya esta completo. Excelente trabajo.");
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
        await loadStatus(authToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el onboarding.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  const steps = useMemo(() => {
    if (!status) return [];

    return [
      {
        key: "perfilCompleto",
        title: "Completa tu perfil",
        detail: "Nombre, bio y especialidades.",
        done: status.steps.perfilCompleto,
        href: "/dashboard/profile",
      },
      {
        key: "zonaConfigurada",
        title: "Configura tu zona de cobertura",
        detail: "Define kilometros de cobertura.",
        done: status.steps.zonaConfigurada,
        href: "/dashboard/profile",
      },
      {
        key: "identidadVerificada",
        title: "Verifica tu identidad",
        detail: "La verificacion es gestionada por administracion.",
        done: status.steps.identidadVerificada,
        href: "/dashboard/profile",
      },
      {
        key: "fotoPortafolio",
        title: "Agrega al menos una foto al portafolio",
        detail: "Muestra evidencia visual de tus trabajos.",
        done: status.steps.fotoPortafolio,
        href: "/dashboard/profile",
      },
    ];
  }, [status]);

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
      setMessage(response.message);
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
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando onboarding...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Onboarding profesional</h1>
        <p className="mt-2 text-sm text-brand-muted">Completa estos pasos para recibir solicitudes relevantes.</p>

        {status && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-[#9db2cf]">
              <span>Progreso</span>
              <span>{status.progress.percentage}%</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#0A0F1A]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#e94560] to-[#5df2db] transition-all duration-700"
                style={{ width: `${status.progress.percentage}%` }}
              />
            </div>
          </div>
        )}

        {error && <p className="premium-error mt-4">{error}</p>}
        {message && <p className="premium-success mt-4">{message}</p>}

        <div className="mt-6 space-y-3">
          {steps.map((step, index) => (
            <article
              key={step.key}
              className="rounded-xl border border-[#263245] bg-[#0A0F1A] p-4 opacity-0"
              style={{
                animation: "onboarding-step-in 420ms ease forwards",
                animationDelay: `${index * 90}ms`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="mt-1 text-xs text-brand-muted">{step.detail}</p>
                </div>

                {step.done ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-300 text-[10px] text-[#093025]">?</span>
                    Completado
                  </span>
                ) : (
                  <Link href={step.href} className="rounded-lg border border-[#e94560]/35 bg-[#e94560]/12 px-3 py-2 text-xs font-semibold text-[#83fce5] transition hover:bg-[#e94560]/20">
                    Ir a completar
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCompleteOnboarding}
            disabled={saving || !status?.allCompleted}
            className="rounded-xl bg-[#e94560] px-5 py-3 font-semibold text-[#03261d] transition hover:-translate-y-0.5 hover:bg-[#35e0c3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Finalizar onboarding"}
          </button>

          <Link href="/dashboard" className="premium-btn-secondary px-5 py-3">
            Ir al dashboard
          </Link>
        </div>

        {status?.allCompleted && (
          <div className="relative mt-6 overflow-hidden rounded-xl border border-[#e94560]/35 bg-[#e94560]/10 p-4">
            <p className="text-sm font-semibold text-[#9cffec]">Celebracion: onboarding completado.</p>
            <div className="pointer-events-none absolute inset-0">
              <span className="absolute left-[12%] top-2 h-2 w-2 animate-ping rounded-full bg-[#e94560]" />
              <span className="absolute left-[35%] top-3 h-2 w-2 animate-ping rounded-full bg-[#7efbe7] [animation-delay:120ms]" />
              <span className="absolute left-[58%] top-2 h-2 w-2 animate-ping rounded-full bg-[#e94560] [animation-delay:260ms]" />
              <span className="absolute left-[81%] top-3 h-2 w-2 animate-ping rounded-full bg-[#7efbe7] [animation-delay:380ms]" />
            </div>
          </div>
        )}
      </section>

      <style jsx global>{`
        @keyframes onboarding-step-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}


