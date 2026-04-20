"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type JobDetail = {
  id: string;
  status: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "CANCELADO";
  paymentStatus: "PENDIENTE" | "RETENIDO" | "LIBERADO" | "REEMBOLSADO";
  escrowReleaseAt: string;
  amountCop: number;
  request: {
    id: string;
    description: string;
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
  if (status === "RETENIDO") return "bg-sky-500/20 border-sky-500/35 text-sky-300";
  if (status === "LIBERADO") return "bg-emerald-500/20 border-emerald-500/35 text-emerald-300";
  return "bg-slate-500/20 border-slate-500/35 text-slate-300";
}

function getRemainingEscrow(escrowReleaseAt: string) {
  const end = new Date(escrowReleaseAt).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return "Liberacion automatica en: 0h 0min";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `Liberacion automatica en: ${hours}h ${minutes}min`;
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

  useEffect(() => {
    if (!job || role !== "CLIENTE") return;

    if (job.status === "COMPLETADO" && job.paymentStatus === "LIBERADO" && !job.hasReviewedProfessional) {
      router.replace(`/dashboard/job/${job.id}/calificar`);
    }
  }, [job, role, router]);

  function onLogout() {
    clearSession();
    router.push("/auth/login");
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
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando job...</main>;
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
        </div>

        <p className="mt-4 text-brand-muted">{job.request.category.name}</p>
        <p className="mt-2 text-[#d5dded]">{job.request.description}</p>
        <p className="mt-4 font-[var(--font-heading)] text-2xl font-bold text-white">{formatCop(job.amountCop)}</p>

        {remainingEscrowText && <p className="mt-2 text-sm text-sky-300">{remainingEscrowText}</p>}

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
              {processing ? "Confirmando..." : "Confirmar trabajo completado"}
            </button>
          )}

          {showRateButton && (
            <Link href={`/dashboard/job/${job.id}/calificar`} className="rounded-xl bg-[#00C9A7] px-5 py-3 font-semibold text-[#06281f] transition hover:-translate-y-0.5 hover:bg-[#2fe0c2]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#30425a] bg-[#0A0F1A] p-5">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-white">Confirmar disputa</h2>
            <p className="mt-2 text-sm text-brand-muted">
              Abrir una disputa congelara el proceso normal de conciliacion hasta revision.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDisputeOpen(false)}
                className="premium-btn-secondary px-4 py-2 text-sm"
              >
                Volver
              </button>
              <Link
                href={`/dashboard/disputas/nueva/${job.id}`}
                className="rounded-lg border border-rose-400/45 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/25"
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
