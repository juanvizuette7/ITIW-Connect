"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type QuoteItem = {
  id: string;
  amountCop: number;
  estimatedHours: number;
  message: string;
  status: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
  createdAt: string;
  request: {
    id: string;
    description: string;
    status: "ACTIVA" | "AGENDADA" | "COMPLETADA" | "CANCELADA";
    category: {
      name: string;
    };
  };
  job: {
    id: string;
    paymentStatus: "PENDIENTE" | "RETENIDO" | "LIBERADO" | "REEMBOLSADO";
    status: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "CANCELADO";
  } | null;
};

type ProfileMeResponse = {
  name: string;
};

function quoteStatusClass(status: QuoteItem["status"]) {
  if (status === "ACEPTADA") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/35";
  if (status === "PENDIENTE") return "bg-amber-500/20 text-amber-300 border-amber-500/35";
  return "bg-rose-500/20 text-rose-300 border-rose-500/35";
}

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

export default function MisCotizacionesPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      const role = getRole();

      if (!token || role !== "PROFESIONAL") {
        router.replace("/auth/login");
        return;
      }

      try {
        const [profile, data] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token }),
          apiRequest<QuoteItem[]>("/requests/my-quotes", { method: "GET", token }),
        ]);

        setUserName(profile.name);
        setQuotes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar tus cotizaciones.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando cotizaciones...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Mis cotizaciones</h1>
        <p className="mt-2 text-brand-muted">Haz seguimiento de tus propuestas enviadas.</p>

        {error && <p className="premium-error mt-4">{error}</p>}

        {quotes.length === 0 ? (
          <div className="mt-6 premium-panel p-5 text-center">
            <p className="text-brand-muted">Aún no has enviado cotizaciones. Revisa solicitudes disponibles y envia tu primera propuesta.</p>
            <Link href="/dashboard/solicitudes-disponibles" className="premium-btn-primary mt-4 inline-block">
              Ver solicitudes disponibles
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {quotes.map((quote) => (
              <article key={quote.id} className="premium-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-white">{quote.request.category.name}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${quoteStatusClass(quote.status)}`}>
                    {quote.status}
                  </span>
                </div>

                <p className="mt-2 text-sm text-brand-muted line-clamp-2">{quote.request.description}</p>
                <p className="mt-2 text-sm text-[#d5dded]">{formatCop(quote.amountCop)} - {quote.estimatedHours} horas</p>

                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <Link href={`/dashboard/solicitud/${quote.request.id}`} className="text-brand-accent hover:underline">
                    Ver solicitud
                  </Link>
                  {quote.job?.id && (
                    <Link href={`/dashboard/job/${quote.job.id}`} className="text-emerald-300 hover:underline">
                      Ver job
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
