"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { showToast } from "@/lib/toast";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { LoadingDots } from "@/components/LoadingDots";

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
  if (status === "ACTIVA") return "bg-[var(--brand-accent)]/18 text-[#ffd0bd] border-[var(--brand-accent)]/38";
  if (status === "AGENDADA") return "bg-orange-500/20 text-orange-200 border-orange-500/35";
  if (status === "COMPLETADA") return "bg-emerald-500/20 text-emerald-200 border-emerald-500/35";
  return "bg-rose-500/20 text-rose-200 border-rose-500/35";
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
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
    router.push("/");
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
      showToast({ message: "Solicitud cancelada", kind: "info" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cancelar la solicitud.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <ScreenSkeleton />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Mis solicitudes</h1>
            <p className="mt-2 text-brand-muted">Revisa el estado y avance de cada solicitud.</p>
          </div>
          <Link href="/dashboard/nueva-solicitud" className="premium-btn-primary text-sm">
            Nueva solicitud
          </Link>
        </div>

        {error && (
          <div className="premium-error mb-4 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => window.location.reload()} className="underline">
              Reintentar
            </button>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <div className="mx-auto mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-[#9fb4d4]">
              <FolderIcon />
            </div>
            <p className="text-lg font-semibold text-white">Aún no tienes solicitudes</p>
            <p className="mt-1 text-sm text-brand-muted">Crea tu primera solicitud y recibe cotizaciones de profesionales verificados.</p>
            <Link href="/dashboard/nueva-solicitud" className="premium-btn-primary mt-5 inline-flex px-5 py-2.5 text-sm">
              Crear primera solicitud
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <article
                key={request.id}
                onClick={() => router.push(`/dashboard/solicitud/${request.id}`)}
                className="premium-panel premium-hover-card cursor-pointer p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{request.category.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-brand-muted">{request.description}</p>
                  </div>

                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(request.status)}`}>
                    {request.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#9cb0cd]">
                  <span>{request._count.quotes} presupuestos</span>
                  <span>{new Date(request.createdAt).toLocaleDateString("es-CO")}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-sm" onClick={(event) => event.stopPropagation()}>
                  <Link href={`/dashboard/solicitud/${request.id}`} className="text-[var(--brand-accent)] hover:underline">
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
              Página {currentPage} de {totalPages}
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
        <div className="fixed inset-0 z-50 bg-black/65">
          <button type="button" aria-label="Cerrar" className="absolute inset-0" onClick={() => setCancelModalId(null)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-white/10 bg-[#0A0F1A] p-5 shadow-[0_-18px_40px_rgba(0,0,0,0.45)] md:left-1/2 md:max-w-md md:-translate-x-1/2 md:bottom-6 md:rounded-2xl">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-white">Confirmar cancelación</h2>
            <p className="mt-2 text-sm text-brand-muted">Esta acción es irreversible. La solicitud pasará a estado CANCELADA.</p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setCancelModalId(null)}
                className="premium-btn-secondary w-full py-2.5 text-sm"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => void onConfirmCancel()}
                disabled={cancelling}
                className="w-full rounded-xl border border-rose-400/45 bg-rose-400/15 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/25 disabled:opacity-60"
              >
                {cancelling ? <LoadingDots label="Cancelando" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}



