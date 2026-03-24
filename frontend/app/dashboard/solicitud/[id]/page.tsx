"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type QuoteItem = {
  id: string;
  amountCop: number;
  estimatedHours: number;
  message: string;
  status: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
  score: number;
  jobId: string | null;
  professional: {
    id: string;
    name: string;
    avgRating: number;
    totalJobs: number;
    verifiedBadge: boolean;
  };
};

type RequestDetail = {
  id: string;
  status: "ACTIVA" | "AGENDADA" | "COMPLETADA" | "CANCELADA";
  description: string;
  category: {
    name: string;
  };
  client: {
    name: string;
  };
  quotes: QuoteItem[];
};

type ProfileMeResponse = {
  name: string;
  role: "CLIENTE" | "PROFESIONAL";
};

type AcceptQuoteResponse = {
  message: string;
  job: {
    id: string;
  };
};

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function stars(rating: number): string {
  const amount = Math.max(1, Math.min(5, Math.round(rating)));
  return "★".repeat(amount);
}

export default function SolicitudDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<"CLIENTE" | "PROFESIONAL" | null>(null);
  const [requestDetail, setRequestDetail] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadDetail(authToken: string) {
    const data = await apiRequest<RequestDetail>(`/requests/${params.id}`, {
      method: "GET",
      token: authToken,
    });
    setRequestDetail(data);
  }

  useEffect(() => {
    async function init() {
      const savedToken = getToken();
      const savedRole = getRole();

      if (!savedToken || !savedRole) {
        router.replace("/auth/login");
        return;
      }

      setToken(savedToken);

      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", {
          method: "GET",
          token: savedToken,
        });
        setUserName(profile.name);
        setRole(profile.role);
        await loadDetail(savedToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el detalle.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [params.id, router]);

  function onLogout() {
    clearSession();
    router.push("/auth/login");
  }

  async function onAcceptQuote(quoteId: string) {
    if (!token) return;

    setAcceptingQuoteId(quoteId);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<AcceptQuoteResponse>(`/requests/${params.id}/quotes/${quoteId}/accept`, {
        method: "PUT",
        token,
      });

      setMessage(response.message);
      if (response.job?.id) {
        router.push(`/dashboard/job/${response.job.id}/pagar`);
        return;
      }

      await loadDetail(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible aceptar el presupuesto.");
    } finally {
      setAcceptingQuoteId(null);
    }
  }

  const canAccept = useMemo(() => role === "CLIENTE" && requestDetail?.status === "ACTIVA", [role, requestDetail]);

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando detalle...</main>;
  }

  if (!requestDetail) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">No encontramos la solicitud.</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Detalle de solicitud</h1>
        <p className="mt-2 text-brand-muted">
          {requestDetail.category.name} · Estado actual: <span className="text-white">{requestDetail.status}</span>
        </p>
        <p className="mt-4 text-[#d5dded]">{requestDetail.description}</p>

        {error && <p className="premium-error mt-4">{error}</p>}
        {message && <p className="premium-success mt-4">{message}</p>}

        <div className="mt-7 space-y-4">
          {requestDetail.quotes.length === 0 ? (
            <div className="premium-panel p-5 text-center">
              <p className="text-brand-muted">Aun no hay presupuestos para esta solicitud. Te notificaremos cuando llegue uno nuevo.</p>
              <Link href="/dashboard/mis-solicitudes" className="premium-btn-secondary mt-4 inline-block">
                Volver a mis solicitudes
              </Link>
            </div>
          ) : (
            requestDetail.quotes.map((quote) => (
              <article key={quote.id} className="premium-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{quote.professional.name}</p>
                    <p className="text-sm text-brand-gold">
                      {stars(quote.professional.avgRating)} · {quote.professional.avgRating.toFixed(1)}
                    </p>
                  </div>
                  <p className="font-[var(--font-heading)] text-xl font-bold text-white">{formatCop(quote.amountCop)}</p>
                </div>

                <p className="mt-3 text-sm text-brand-muted">{quote.message}</p>

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[#c5d0e3]">
                  <span>Tiempo estimado: {quote.estimatedHours} horas</span>
                  <span>Trabajos: {quote.professional.totalJobs}</span>
                  <span>Score IA: {quote.score.toFixed(3)}</span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {canAccept && quote.status === "PENDIENTE" && (
                    <button
                      type="button"
                      onClick={() => onAcceptQuote(quote.id)}
                      disabled={acceptingQuoteId === quote.id}
                      className="premium-btn-primary px-4 py-2 text-sm"
                    >
                      {acceptingQuoteId === quote.id ? "Aceptando..." : "Aceptar"}
                    </button>
                  )}

                  {quote.jobId && (
                    <Link href={`/dashboard/job/${quote.jobId}`} className="text-sm text-emerald-300 hover:underline">
                      Ver job
                    </Link>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
