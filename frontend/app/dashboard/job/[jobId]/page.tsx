"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { LoadingDots } from "@/components/LoadingDots";

type JobDetail = {
  id: string;
  status: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "CANCELADO";
  paymentStatus: "PENDIENTE" | "RETENIDO" | "LIBERADO" | "REEMBOLSADO";
  escrowReleaseAt: string;
  amountCop: number;
  request: {
    id: string;
    description: string;
    status: "ACTIVA" | "AGENDADA" | "COMPLETADA" | "CANCELADA";
    category: {
      name: string;
    };
  };
  professional: {
    id: string;
    name: string;
    badges: string[];
  };
  client: {
    id: string;
    name: string;
  };
  hasReviewedProfessional: boolean;
  hasReviewedClient: boolean;
  updatedAt: string;
};

type ProfileMeResponse = {
  name: string;
  role: UserRole;
};

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function statusClass(status: JobDetail["paymentStatus"]) {
  if (status === "PENDIENTE") return "bg-amber-500/20 border-amber-500/35 text-amber-300";
  if (status === "RETENIDO") return "bg-orange-500/20 border-orange-500/35 text-orange-200";
  if (status === "LIBERADO") return "bg-emerald-500/20 border-emerald-500/35 text-emerald-300";
  return "bg-slate-500/20 border-slate-500/35 text-slate-300";
}

function getRemainingEscrow(escrowReleaseAt: string) {
  const end = new Date(escrowReleaseAt).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return "Liberación automática en: 0h 0min";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `Liberación automática en: ${hours}h ${minutes}min`;
}

function readableJobStatus(job: JobDetail) {
  if (job.paymentStatus === "PENDIENTE") return "Pendiente de pago";
  if (job.paymentStatus === "RETENIDO") return "Pagado y listo para realizar";
  if (job.paymentStatus === "LIBERADO" && job.status === "COMPLETADO") return "Completado y pagado";
  if (job.paymentStatus === "REEMBOLSADO") return "Reembolsado";
  return job.status;
}

function flowMessage(job: JobDetail, role: UserRole | null) {
  if (job.paymentStatus === "PENDIENTE") {
    return role === "CLIENTE"
      ? "Aceptaste el presupuesto. El siguiente paso es pagar para que el profesional pueda iniciar con seguridad."
      : "El cliente aceptó tu presupuesto. Aún falta que realice el pago para iniciar el trabajo.";
  }

  if (job.paymentStatus === "RETENIDO") {
    return role === "CLIENTE"
      ? "Ya pagaste. El dinero está protegido en escrow y el profesional fue notificado para realizar el servicio."
      : "El cliente ya pagó. El dinero está retenido en escrow; puedes realizar el servicio y coordinar por chat.";
  }

  if (job.paymentStatus === "LIBERADO" && job.status === "COMPLETADO") {
    return role === "CLIENTE"
      ? "El trabajo quedó completado, la solicitud fue cerrada y el pago fue liberado al profesional."
      : "Trabajo completado. El pago fue liberado y ya puedes ver el movimiento en tu historial.";
  }

  return "Revisa el estado del trabajo y coordina cualquier detalle desde el chat.";
}

function FlowSteps({ job }: { job: JobDetail }) {
  const steps = [
    { key: "accepted", label: "Presupuesto aceptado", done: true },
    { key: "paid", label: "Pago en escrow", done: job.paymentStatus !== "PENDIENTE" },
    { key: "work", label: "Trabajo en curso", done: job.status === "EN_PROGRESO" || job.status === "COMPLETADO" },
    { key: "completed", label: "Completado y liberado", done: job.status === "COMPLETADO" && job.paymentStatus === "LIBERADO" },
  ];

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-4">
      {steps.map((step, index) => (
        <div
          key={step.key}
          className={`rounded-2xl border p-3 transition ${
            step.done
              ? "border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/12 text-white"
              : "border-white/10 bg-white/[0.03] text-[#8fa0b9]"
          }`}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-current text-xs font-bold">
            {step.done ? "✓" : index + 1}
          </span>
          <p className="mt-2 text-xs font-semibold">{step.label}</p>
        </div>
      ))}
    </div>
  );
}

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDisputeOpen, setConfirmDisputeOpen] = useState(false);
  const [tick, setTick] = useState(0);

  async function loadJob(authToken: string) {
    const detail = await apiRequest<JobDetail>(`/jobs/${params.jobId}`, {
      method: "GET",
      token: authToken,
    });
    setJob(detail);
  }

  useEffect(() => {
    async function init() {
      const authToken = getToken();
      if (!authToken) {
        router.replace("/auth/login");
        return;
      }

      setToken(authToken);

      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: authToken });
        setUserName(profile.name);
        setRole(profile.role);
        await loadJob(authToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el job.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [params.jobId, router]);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function onConfirmJob() {
    if (!token || !job) return;
    setProcessing(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<{ message: string }>(`/jobs/${job.id}/confirm`, {
        method: "POST",
        token,
      });
      setMessage(response.message);
      router.refresh();
      await loadJob(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible confirmar el trabajo.");
    } finally {
      setProcessing(false);
    }
  }

  const remainingEscrowText = useMemo(() => {
    if (!job || job.paymentStatus !== "RETENIDO") return "";
    return getRemainingEscrow(job.escrowReleaseAt);
  }, [job, tick]);

  if (loading) {
    return <ScreenSkeleton />;
  }

  if (!job) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">No encontramos el job.</main>;
  }

  const showPayButton = role === "CLIENTE" && job.paymentStatus === "PENDIENTE";
  const showConfirmButton = role === "CLIENTE" && job.status === "EN_PROGRESO" && job.paymentStatus === "RETENIDO";
  const showRateButton =
    role === "CLIENTE" && job.status === "COMPLETADO" && job.paymentStatus === "LIBERADO" && !job.hasReviewedProfessional;
  const disputeWindowOpen =
    job.paymentStatus === "LIBERADO" &&
    Date.now() - new Date(job.updatedAt).getTime() <= 72 * 60 * 60 * 1000;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Detalle del job</h1>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs ${statusClass(job.paymentStatus)}`}>{job.paymentStatus}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#c5d0e3]">{job.status}</span>
          <span className="rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/10 px-3 py-1 text-xs font-semibold text-[#ffd0bd]">
            {readableJobStatus(job)}
          </span>
        </div>

        <p className="mt-4 text-brand-muted">{job.request.category.name}</p>
        <p className="mt-2 text-[#d5dded]">{job.request.description}</p>
        <p className="mt-4 font-[var(--font-heading)] text-2xl font-bold text-white">{formatCop(job.amountCop)}</p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm font-semibold text-white">Estado del flujo</p>
          <p className="mt-1 text-sm leading-6 text-brand-muted">{flowMessage(job, role)}</p>
          <FlowSteps job={job} />
        </div>

        {remainingEscrowText && <p className="mt-2 text-sm text-orange-300">{remainingEscrowText}</p>}

        {error && <p className="premium-error mt-4">{error}</p>}
        {message && <p className="premium-success mt-4">{message}</p>}

        <div className="mt-6 flex flex-wrap gap-3">
          {showPayButton && (
            <Link href={`/dashboard/job/${job.id}/pagar`} className="premium-btn-primary">
              Pagar ahora
            </Link>
          )}

          {showConfirmButton && (
            <button onClick={onConfirmJob} disabled={processing} className="premium-btn-primary">
              {processing ? <LoadingDots label="Confirmando" /> : "Confirmar trabajo completado"}
            </button>
          )}

          {showRateButton && (
            <Link href={`/dashboard/job/${job.id}/calificar`} className="rounded-xl bg-[#e94560] px-5 py-3 font-semibold text-[#06281f] transition hover:-translate-y-0.5 hover:bg-[#2fe0c2]">
              Calificar servicio
            </Link>
          )}

          {disputeWindowOpen && (
            <button
              type="button"
              onClick={() => setConfirmDisputeOpen(true)}
              className="rounded-xl border border-[#f87171]/40 bg-[#f87171]/10 px-5 py-3 font-semibold text-[#fecaca] transition hover:-translate-y-0.5 hover:bg-[#f87171]/20"
            >
              Abrir disputa
            </button>
          )}

          <Link href={`/dashboard/job/${job.id}/chat`} className="premium-btn-secondary">
            Ir al chat
          </Link>
        </div>
      </section>

      {confirmDisputeOpen && (
        <div className="fixed inset-0 z-50 bg-black/65">
          <button type="button" aria-label="Cerrar" className="absolute inset-0" onClick={() => setConfirmDisputeOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-white/10 bg-[#0A0F1A] p-5 shadow-[0_-18px_40px_rgba(0,0,0,0.45)] md:left-1/2 md:max-w-md md:-translate-x-1/2 md:bottom-6 md:rounded-2xl">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-white">Confirmar disputa</h2>
            <p className="mt-2 text-sm text-brand-muted">
              Abrir una disputa congelara el proceso normal de conciliacion hasta revision.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDisputeOpen(false)}
                className="premium-btn-secondary w-full px-4 py-2 text-sm"
              >
                Volver
              </button>
              <Link
                href={`/dashboard/disputas/nueva/${job.id}`}
                className="w-full rounded-lg border border-rose-400/45 bg-rose-400/15 px-4 py-2 text-center text-sm font-semibold text-rose-200 transition hover:bg-rose-400/25"
              >
                Continuar
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

