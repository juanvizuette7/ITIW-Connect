"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken, UserRole } from "@/lib/auth";

type DisputeStatus = "ABIERTA" | "EN_REVISION" | "RESUELTA" | "CERRADA";

type ProfileMeResponse = {
  name: string;
  role: UserRole;
};

type DisputeItem = {
  id: string;
  jobId: string;
  status: DisputeStatus;
  reason: string;
  description: string;
  createdAt: string;
  job: {
    paymentStatus: string;
    request: {
      description: string;
      category: {
        name: string;
      };
    };
  };
};

type ResolveResponse = {
  message: string;
  dispute: {
    id: string;
    status: DisputeStatus;
    resolution: string;
  };
};

function statusClass(status: DisputeStatus) {
  if (status === "ABIERTA") return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  if (status === "EN_REVISION") return "border-amber-500/40 bg-amber-500/15 text-amber-200";
  if (status === "RESUELTA") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
  return "border-slate-500/40 bg-slate-500/15 text-slate-200";
}

export default function AdminDisputasPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<DisputeItem[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);

  async function loadDisputes(authToken: string) {
    const disputes = await apiRequest<DisputeItem[]>("/disputes", {
      method: "GET",
      token: authToken,
    });
    setItems(disputes);
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
        const me = await apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: authToken });
        setUserName(me.name);
        setRole(me.role);

        if (me.role !== "ADMIN") {
          setError("Esta vista es exclusiva para administradores.");
          return;
        }

        await loadDisputes(authToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar las disputas.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function onResolve(disputeId: string, outcome: "LIBERAR" | "REEMBOLSAR") {
    if (!token) return;

    const resolution = (resolutions[disputeId] || "").trim();
    if (resolution.length < 10) {
      setError("Escribe una resolucion de al menos 10 caracteres para cerrar la disputa.");
      setShakeId(disputeId);
      setTimeout(() => setShakeId(null), 450);
      return;
    }

    setWorkingId(disputeId);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<ResolveResponse>(`/disputes/${disputeId}/resolve`, {
        method: "PUT",
        token,
        body: JSON.stringify({ outcome, resolution }),
      });

      setMessage(response.message);
      await loadDisputes(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible resolver la disputa.");
    } finally {
      setWorkingId(null);
    }
  }

  const openItems = useMemo(
    () => items.filter((item) => item.status === "ABIERTA" || item.status === "EN_REVISION"),
    [items],
  );

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 text-brand-muted">Cargando panel admin de disputas...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Panel admin de disputas</h1>
            <p className="mt-2 text-sm text-brand-muted">
              Gestion de disputas abiertas con acciones de liberacion o reembolso.
            </p>
          </div>
          <Link href="/dashboard/disputas" className="premium-btn-secondary px-4 py-2 text-sm">
            Volver a disputas
          </Link>
        </div>

        {error && <p className="premium-error mt-4">{error}</p>}
        {message && <p className="premium-success mt-4">{message}</p>}

        {role !== "ADMIN" ? (
          <article className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-brand-muted">
            No tienes permisos para esta seccion.
          </article>
        ) : (
          <div className="mt-6 space-y-4">
            {openItems.length === 0 ? (
              <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-brand-muted">
                No hay disputas abiertas en este momento.
              </article>
            ) : (
              openItems.map((item) => {
                const isWorking = workingId === item.id;
                const canEdit = item.status === "ABIERTA" || item.status === "EN_REVISION";

                return (
                  <article
                    key={item.id}
                    className="rounded-xl border border-[#263245] bg-[#0A0F1A] p-4 transition hover:-translate-y-0.5 hover:border-white/20"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-white">{item.job.request.category.name}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-[#d5dded]">{item.reason}</p>
                    <p className="mt-1 text-sm text-brand-muted">{item.description}</p>
                    <p className="mt-2 text-xs text-[#8ea0b9]">
                      {new Date(item.createdAt).toLocaleString("es-CO")} � Estado pago: {item.job.paymentStatus}
                    </p>

                    <label className="mt-4 block text-sm text-[#cfd7e7]">
                      Resolucion administrativa
                      <textarea
                        value={resolutions[item.id] || ""}
                        onChange={(event) =>
                          setResolutions((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        rows={3}
                        maxLength={1200}
                        disabled={!canEdit || isWorking}
                        className="premium-input mt-1 resize-none"
                        placeholder="Describe la decision final para ambas partes."
                      />
                    </label>

                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => onResolve(item.id, "LIBERAR")}
                        disabled={!canEdit || isWorking}
                        className={`rounded-xl border border-emerald-400/45 bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-60 ${
                          shakeId === item.id ? "animate-dispute-shake" : ""
                        }`}
                      >
                        {isWorking ? "Procesando..." : "Liberar pago al profesional"}
                      </button>

                      <button
                        type="button"
                        onClick={() => onResolve(item.id, "REEMBOLSAR")}
                        disabled={!canEdit || isWorking}
                        className={`rounded-xl border border-rose-400/45 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/25 disabled:cursor-not-allowed disabled:opacity-60 ${
                          shakeId === item.id ? "animate-dispute-shake" : ""
                        }`}
                      >
                        {isWorking ? "Procesando..." : "Reembolsar al cliente"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>
    </main>
  );
}

