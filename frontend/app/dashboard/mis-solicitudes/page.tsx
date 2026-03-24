"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type ServiceRequest = {
  id: string;
  description: string;
  status: "ACTIVA" | "AGENDADA" | "COMPLETADA" | "CANCELADA";
  createdAt: string;
  jobId: string | null;
  category: {
    name: string;
  };
  _count: {
    quotes: number;
  };
};

type ProfileMeResponse = {
  name: string;
};

function statusClasses(status: ServiceRequest["status"]): string {
  if (status === "ACTIVA") return "bg-emerald-500/20 text-emerald-300 border-emerald-500/35";
  if (status === "AGENDADA") return "bg-sky-500/20 text-sky-300 border-sky-500/35";
  if (status === "COMPLETADA") return "bg-slate-500/20 text-slate-300 border-slate-500/35";
  return "bg-rose-500/20 text-rose-300 border-rose-500/35";
}

export default function MisSolicitudesPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const savedToken = getToken();
      const role = getRole();

      if (!savedToken || role !== "CLIENTE") {
        router.replace("/auth/login");
        return;
      }

      try {
        const [profile, myRequests] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: savedToken }),
          apiRequest<ServiceRequest[]>("/requests", { method: "GET", token: savedToken }),
        ]);

        setUserName(profile.name);
        setRequests(myRequests);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar tus solicitudes.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/auth/login");
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando solicitudes...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Mis solicitudes</h1>
            <p className="mt-2 text-brand-muted">Revisa estado, cotizaciones y detalle de cada trabajo.</p>
          </div>
          <Link href="/dashboard/nueva-solicitud" className="premium-btn-primary text-sm">
            Nueva solicitud
          </Link>
        </div>

        {error && <p className="premium-error mb-4">{error}</p>}

        {requests.length === 0 ? (
          <div className="premium-panel p-5 text-center">
            <p className="text-brand-muted">Aun no tienes solicitudes. Crea tu primera solicitud para recibir cotizaciones.</p>
            <Link href="/dashboard/nueva-solicitud" className="premium-btn-primary mt-4 inline-block">
              Crear solicitud
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <article key={request.id} className="premium-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-white">{request.category.name}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusClasses(request.status)}`}>
                    {request.status}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-brand-muted">{request.description}</p>
                <p className="mt-2 text-xs text-[#aab3c7]">
                  {new Date(request.createdAt).toLocaleDateString("es-CO")} - {request._count.quotes} cotizaciones
                </p>

                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <Link href={`/dashboard/solicitud/${request.id}`} className="text-brand-accent hover:underline">
                    Ver detalle
                  </Link>

                  {request.jobId && (request.status === "AGENDADA" || request.status === "COMPLETADA") && (
                    <Link href={`/dashboard/job/${request.jobId}`} className="text-emerald-300 hover:underline">
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
