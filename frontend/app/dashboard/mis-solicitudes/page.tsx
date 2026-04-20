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

type PaginatedRequestsResponse = {
  data: ServiceRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cancelModalId, setCancelModalId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData(page = 1, firstLoad = false) {
      const savedToken = getToken();
      const role = getRole();

      if (!savedToken || role !== "CLIENTE") {
        router.replace("/auth/login");
        return;
      }

      if (firstLoad) setLoading(true);

      try {
        const [profile, myRequests] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: savedToken }),
          apiRequest<PaginatedRequestsResponse>(`/requests?page=${page}&limit=10`, {
            method: "GET",
            token: savedToken,
          }),
        ]);

        setUserName(profile.name);
        setRequests(myRequests.data);
        setCurrentPage(myRequests.page);
        setTotalPages(myRequests.totalPages);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar tus solicitudes.");
      } finally {
        if (firstLoad) setLoading(false);
      }
    }

    void loadData(1, true);
  }, [router]);

  async function reloadPage(page: number) {
    const savedToken = getToken();
    if (!savedToken) return;

    const myRequests = await apiRequest<PaginatedRequestsResponse>(`/requests?page=${page}&limit=10`, {
      method: "GET",
      token: savedToken,
    });
    setRequests(myRequests.data);
    setCurrentPage(myRequests.page);
    setTotalPages(myRequests.totalPages);
  }

  function onLogout() {
    clearSession();
    router.push("/auth/login");
  }

  async function onConfirmCancel() {
    const token = getToken();
    if (!token || !cancelModalId) return;

    setCancelling(true);
    setError(null);
    try {
      await apiRequest<{ message: string }>(`/requests/${cancelModalId}/cancel`, {
        method: "PUT",
        token,
      });
      setCancelModalId(null);
      await reloadPage(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cancelar la solicitud.");
    } finally {
      setCancelling(false);
    }
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

                  {request.status === "ACTIVA" && (
                    <button
                      type="button"
                      onClick={() => setCancelModalId(request.id)}
                      className="text-rose-300 hover:underline"
                    >
                      Cancelar solicitud
                    </button>
                  )}

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

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => void reloadPage(currentPage - 1)}
              className="premium-btn-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Anterior
            </button>
            <span className="text-brand-muted">
              Pagina {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => void reloadPage(currentPage + 1)}
              className="premium-btn-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      {cancelModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#30425a] bg-[#0A0F1A] p-5">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-white">Confirmar cancelacion</h2>
            <p className="mt-2 text-sm text-brand-muted">
              Esta accion es irreversible. La solicitud pasara a estado CANCELADA.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalId(null)}
                className="premium-btn-secondary px-4 py-2 text-sm"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => void onConfirmCancel()}
                disabled={cancelling}
                className="rounded-lg border border-rose-400/45 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/25 disabled:opacity-60"
              >
                {cancelling ? "Cancelando..." : "Si, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
