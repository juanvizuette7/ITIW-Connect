"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { showToast } from "@/lib/toast";

type AvailableRequest = {
  id: string;
  description: string;
  createdAt: string;
  preferredDateTime?: string | null;
  preferredSchedule?: string | null;
  locationLabel?: string | null;
  category: { name: string };
  _count: { quotes: number };
};

type ProfileMeResponse = { name: string };

const scheduleLabels: Record<string, string> = {
  MANANA: "Manana, 6am - 12pm",
  TARDE: "Tarde, 12pm - 6pm",
  NOCHE: "Noche, 6pm - 10pm",
};

function timeAgo(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} dias`;
}

function formatDate(value?: string | null) {
  if (!value) return "Fecha flexible";
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", month: "long", day: "numeric" }).format(new Date(value));
}

export default function SolicitudesDisponiblesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [requests, setRequests] = useState<AvailableRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [amountCop, setAmountCop] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadRequests(authToken: string) {
    const available = await apiRequest<AvailableRequest[]>("/requests/available", { method: "GET", token: authToken });
    setRequests(available);
  }

  useEffect(() => {
    async function init() {
      const savedToken = getToken();
      const role = getRole();
      if (!savedToken || role !== "PROFESIONAL") {
        router.replace("/auth/login");
        return;
      }
      setToken(savedToken);
      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: savedToken });
        setUserName(profile.name);
        await loadRequests(savedToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Servicio no disponible, intenta de nuevo en unos minutos.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [router]);

  const categories = useMemo(() => ["TODAS", ...Array.from(new Set(requests.map((request) => request.category.name)))], [requests]);
  const filteredRequests = useMemo(
    () => requests.filter((request) => categoryFilter === "TODAS" || request.category.name === categoryFilter),
    [requests, categoryFilter],
  );

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function onSubmitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedRequestId) return;
    if (!amountCop || !estimatedHours || !message.trim()) {
      setError("Completa monto, horas estimadas y mensaje antes de cotizar.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest<{ message: string }>(`/requests/${selectedRequestId}/quotes`, {
        method: "POST",
        token,
        body: JSON.stringify({ amountCop: Number(amountCop), estimatedHours: Number(estimatedHours), message: message.trim() }),
      });
      setAmountCop("");
      setEstimatedHours("");
      setMessage("");
      setSelectedRequestId(null);
      setSuccess("Cotizacion enviada correctamente.");
      showToast({ message: "Presupuesto enviado", kind: "success" });
      await loadRequests(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar la cotizacion.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
        <div className="premium-panel h-52 animate-pulse" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel-strong p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 px-3 py-1 text-xs font-bold text-[#ffd0bd]">
              Oportunidades disponibles
            </span>
            <h1 className="mt-4 font-[var(--font-heading)] text-4xl font-extrabold text-white">Solicitudes para cotizar</h1>
            <p className="mt-2 max-w-2xl text-brand-muted">Elige solicitudes activas, revisa la ubicacion y envia una propuesta clara. Cuando cotices, podras chatear con el cliente.</p>
          </div>
          <Link href="/dashboard/mis-cotizaciones" className="premium-btn-secondary px-4 py-2 text-sm">Mis cotizaciones</Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              type="button"
              key={category}
              onClick={() => setCategoryFilter(category)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                categoryFilter === category ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/15 text-[#ffd0bd]" : "border-white/10 bg-white/[0.03] text-[#c8d4e8]"
              }`}
            >
              {category === "TODAS" ? "Todas" : category}
            </button>
          ))}
        </div>

        {error && (
          <div className="premium-error mt-5 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => window.location.reload()} className="underline">Reintentar</button>
          </div>
        )}
        {success && <div className="premium-success mt-5">{success}</div>}

        {filteredRequests.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-white/12 bg-white/[0.02] p-8 text-center">
            <p className="font-[var(--font-heading)] text-2xl font-bold text-white">No hay solicitudes disponibles en tu zona ahora mismo</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">Asegurate de tener tu zona de cobertura configurada y especialidades actualizadas.</p>
            <Link href="/dashboard/profile" className="premium-btn-primary mt-5 inline-flex px-5 py-3 text-sm">Actualizar perfil</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {filteredRequests.map((request) => (
              <article key={request.id} className="premium-panel premium-hover-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/15 px-3 py-1 text-xs font-bold text-[#ffd0bd]">
                      {request.category.name}
                    </span>
                    <p className="mt-3 text-xs text-brand-muted">Publicado {timeAgo(request.createdAt)}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[#c8d4e8]">
                    {request._count.quotes} cotizaciones
                  </span>
                </div>

                <p className="mt-4 line-clamp-4 text-sm leading-6 text-[#d8e2f2]">{request.description}</p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-[#0A0F1A]/55 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Ubicacion</p>
                    <p className="mt-1 text-sm font-semibold text-white">{request.locationLabel || "Bogota, Colombia"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0A0F1A]/55 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Horario</p>
                    <p className="mt-1 text-sm font-semibold text-white">{scheduleLabels[request.preferredSchedule || ""] || "Flexible"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0A0F1A]/55 p-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Fecha</p>
                    <p className="mt-1 text-sm font-semibold text-white capitalize">{formatDate(request.preferredDateTime)}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Link href={`/dashboard/solicitud/${request.id}`} className="premium-btn-secondary px-4 py-2 text-sm">Ver detalle</Link>
                  <button type="button" onClick={() => setSelectedRequestId(request.id)} className="premium-btn-primary px-4 py-2 text-sm">Cotizar ahora</button>
                </div>

                {selectedRequestId === request.id && (
                  <form className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-[#0A0F1A]/65 p-4" onSubmit={onSubmitQuote}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input type="number" min={1} value={amountCop} onChange={(event) => setAmountCop(event.target.value)} placeholder="Monto en COP, ej: 180000" className="premium-input" />
                      <input type="number" min={0.5} step={0.5} value={estimatedHours} onChange={(event) => setEstimatedHours(event.target.value)} placeholder="Horas estimadas" className="premium-input" />
                    </div>
                    <textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explica que incluye tu servicio y cuando puedes atender." className="premium-input" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setSelectedRequestId(null)} className="premium-btn-secondary w-full py-2.5 text-sm">Cancelar</button>
                      <button disabled={submitting} className="premium-btn-primary w-full py-2.5 text-sm">{submitting ? "Enviando..." : "Enviar cotizacion"}</button>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
