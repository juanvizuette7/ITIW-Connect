"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";

type ProfileMeResponse = {
  name: string;
  role: "CLIENTE" | "PROFESIONAL" | "ADMIN";
};

type ProfessionalItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
  verificationStatus: string;
  verificationNotes: string | null;
  aiScore: number;
  totalJobs: number;
  avgRating: number;
  reviewCount: number;
  createdAt: string;
};

type FilterStatus = "TODOS" | "PENDIENTE" | "APROBADO" | "RECHAZADO" | "DESACTIVADO";

function stars(value: number) {
  return "?".repeat(Math.max(0, Math.min(5, Math.round(value))));
}

function statusClass(status: string) {
  if (status === "APROBADO") return "border-emerald-400/40 bg-emerald-400/15 text-emerald-200";
  if (status === "RECHAZADO") return "border-rose-400/40 bg-rose-400/15 text-rose-200";
  if (status === "DESACTIVADO") return "border-slate-400/40 bg-slate-400/15 text-slate-200";
  return "border-amber-400/40 bg-amber-400/15 text-amber-200";
}

export default function AdminProfesionalesPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<ProfessionalItem[]>([]);
  const [filter, setFilter] = useState<FilterStatus>("TODOS");
  const [search, setSearch] = useState("");

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function loadProfessionals(authToken: string, selectedFilter = filter, selectedSearch = search) {
    const params = new URLSearchParams();
    if (selectedFilter !== "TODOS") {
      params.set("status", selectedFilter);
    }
    if (selectedSearch.trim()) {
      params.set("search", selectedSearch.trim());
    }
    const query = params.toString();

    const professionals = await apiRequest<ProfessionalItem[]>(`/admin/professionals${query ? `?${query}` : ""}`, {
      method: "GET",
      token: authToken,
    });
    setItems(professionals);
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
        if (me.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }

        setUserName(me.name);
        await loadProfessionals(authToken, "TODOS", "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar profesionales.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  useEffect(() => {
    if (!token || loading) return;

    const timer = setTimeout(() => {
      void loadProfessionals(token, filter, search);
    }, 220);

    return () => clearTimeout(timer);
  }, [filter, loading, search, token]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function runAction(
    professionalId: string,
    action: "approve" | "reject" | "deactivate",
    payload?: Record<string, string>,
  ) {
    if (!token) return;

    setSavingId(professionalId);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<{ message: string }>(`/admin/professionals/${professionalId}/${action}`, {
        method: "PUT",
        token,
        body: JSON.stringify(payload || {}),
      });

      setMessage(response.message);
      await loadProfessionals(token, filter, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible ejecutar la accion.");
    } finally {
      setSavingId(null);
    }
  }

  function openRejectModal(id: string) {
    setRejectId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  }

  async function onConfirmReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rejectId) return;

    if (rejectReason.trim().length < 8) {
      setError("El motivo de rechazo debe tener al menos 8 caracteres.");
      return;
    }

    await runAction(rejectId, "reject", { reason: rejectReason.trim() });
    setRejectModalOpen(false);
  }

  if (loading) {
    return <main className="mx-auto max-w-7xl px-5 py-10 text-brand-muted">Cargando profesionales...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Profesionales</h1>
            <p className="mt-2 text-sm text-brand-muted">Panel de aprobacion, rechazo y desactivacion.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o correo"
              className="rounded-xl border border-white/15 bg-[#0A0F1A] px-3 py-2 text-sm text-white placeholder:text-[#8ca1bc]"
            />
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as FilterStatus)}
              className="rounded-xl border border-white/15 bg-[#0A0F1A] px-3 py-2 text-sm text-white"
            >
              <option value="TODOS">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="APROBADO">Aprobado</option>
              <option value="RECHAZADO">Rechazado</option>
              <option value="DESACTIVADO">Desactivado</option>
            </select>
          </div>
        </div>

        {error && <p className="premium-error mt-4">{error}</p>}
        {message && <p className="premium-success mt-4">{message}</p>}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#7f97b5]">
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">AI Score</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2">Trabajos</th>
                <th className="px-3 py-2">Registro</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="rounded-xl border border-[#263245] bg-[#0A0F1A] px-4 py-6 text-center text-sm text-[#97a8bf]">
                    No hay profesionales que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="rounded-xl border border-[#263245] bg-[#0A0F1A] text-sm text-[#dbe6ff] transition hover:shadow-[0_0_16px_rgba(233,69,96,0.18)]">
                    <td className="rounded-l-xl px-3 py-3 align-top">
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="mt-1 text-xs text-[#8ea0b9]">{item.email}</p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(item.verificationStatus)}`}>
                        {item.verificationStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top font-semibold text-[#7efbe7]">{item.aiScore.toFixed(2)}</td>
                    <td className="px-3 py-3 align-top">
                      <p className="text-[#f4c15a]">{stars(item.avgRating)}</p>
                      <p className="text-xs text-[#8ea0b9]">{item.avgRating.toFixed(2)} � {item.reviewCount} rese�as</p>
                    </td>
                    <td className="px-3 py-3 align-top">{item.totalJobs}</td>
                    <td className="px-3 py-3 align-top text-xs text-[#8ea0b9]">{new Date(item.createdAt).toLocaleDateString("es-CO")}</td>
                    <td className="rounded-r-xl px-3 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => runAction(item.id, "approve")}
                          disabled={savingId === item.id}
                          className="rounded-lg border border-emerald-400/45 bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-60"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => openRejectModal(item.id)}
                          disabled={savingId === item.id}
                          className="rounded-lg border border-rose-400/45 bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/25 disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          onClick={() => runAction(item.id, "deactivate", { reason: "Desactivacion temporal administrativa." })}
                          disabled={savingId === item.id}
                          className="rounded-lg border border-slate-400/45 bg-slate-400/15 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-400/25 disabled:opacity-60"
                        >
                          Desactivar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <form onSubmit={onConfirmReject} className="w-full max-w-lg rounded-2xl border border-[#2f3f54] bg-[#0A0F1A] p-5">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-white">Motivo de rechazo</h2>
            <p className="mt-2 text-sm text-brand-muted">Especifica claramente que ajustes debe realizar el profesional.</p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={4}
              maxLength={500}
              className="premium-input mt-4 resize-none"
              placeholder="Describe el motivo de rechazo"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="premium-btn-secondary px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button type="submit" className="rounded-lg border border-rose-400/45 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/25">
                Confirmar rechazo
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}


