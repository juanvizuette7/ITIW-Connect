"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type JobItem = {
  id: string;
  status: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "CANCELADO";
  paymentStatus: "PENDIENTE" | "RETENIDO" | "LIBERADO" | "REEMBOLSADO";
  amountCop: number;
  request: {
    id: string;
    description: string;
    category: {
      name: string;
    };
  };
  professional: {
    name: string;
  };
  client: {
    name: string;
  };
};

type ProfileMeResponse = {
  name: string;
};

function paymentStatusClass(status: JobItem["paymentStatus"]): string {
  if (status === "PENDIENTE") return "bg-amber-500/20 border-amber-500/35 text-amber-300";
  if (status === "RETENIDO") return "bg-sky-500/20 border-sky-500/35 text-sky-300";
  if (status === "LIBERADO") return "bg-emerald-500/20 border-emerald-500/35 text-emerald-300";
  return "bg-slate-500/20 border-slate-500/35 text-slate-300";
}

function formatCop(value: number) {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

export default function MisJobsPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const token = getToken();

      if (!token) {
        router.replace("/auth/login");
        return;
      }

      try {
        const [profile, items] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token }),
          apiRequest<JobItem[]>("/jobs", { method: "GET", token }),
        ]);
        setUserName(profile.name);
        setJobs(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar tus jobs.");
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
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando jobs...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Mis jobs</h1>
        <p className="mt-2 text-brand-muted">Consulta estado del trabajo y del pago escrow.</p>

        {error && <p className="premium-error mt-4">{error}</p>}

        {jobs.length === 0 ? (
          <div className="mt-6 premium-panel p-5 text-center">
            <p className="text-brand-muted">Aun no tienes jobs registrados. Cuando aceptes o recibas una cotizacion, aparecera aqui.</p>
            <Link href="/dashboard" className="premium-btn-secondary mt-4 inline-block">
              Volver al dashboard
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {jobs.map((job) => (
              <article key={job.id} className="premium-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-white">{job.request.category.name}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${paymentStatusClass(job.paymentStatus)}`}>
                    {job.paymentStatus}
                  </span>
                </div>

                <p className="mt-2 text-sm text-brand-muted line-clamp-2">{job.request.description}</p>
                <p className="mt-2 text-sm text-[#c5d0e3]">{formatCop(job.amountCop)}</p>

                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <Link href={`/dashboard/job/${job.id}`} className="text-brand-accent hover:underline">
                    Ver job
                  </Link>
                  <Link href={`/dashboard/job/${job.id}/chat`} className="text-sky-300 hover:underline">
                    Abrir chat
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

