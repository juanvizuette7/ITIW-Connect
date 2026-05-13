"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { showToast } from "@/lib/toast";

type QuoteItem = {
  id: string;
  amountCop: number;
  estimatedHours: number;
  message: string;
  status: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
  score: number;
  jobId: string | null;
  professionalId: string;
  professional: {
    id: string;
    name: string;
    avgRating: number;
    totalJobs: number;
    reviewCount: number;
    verifiedBadge: boolean;
    badges: string[];
  };
};

type RequestDetail = {
  id: string;
  status: "ACTIVA" | "AGENDADA" | "COMPLETADA" | "CANCELADA";
  description: string;
  photosUrls: string[];
  preferredDateTime: string | null;
  preferredSchedule: string | null;
  locationLabel: string | null;
  locationLat: number | null;
  locationLng: number | null;
  createdAt: string;
  category: { name: string };
  quotes: QuoteItem[];
};

type ProfileMeResponse = {
  id: string;
  name: string;
  role: "CLIENTE" | "PROFESIONAL" | "ADMIN";
};

type AcceptQuoteResponse = { message: string; job: { id: string } };

type MessageItem = {
  id: string;
  requestId: string;
  content: string;
  createdAt: string;
  sender: { id: string; role: "CLIENTE" | "PROFESIONAL"; name: string };
};

const scheduleLabels: Record<string, string> = {
  MANANA: "Manana, 6am - 12pm",
  TARDE: "Tarde, 12pm - 6pm",
  NOCHE: "Noche, 6pm - 10pm",
};

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function stars(rating: number): string {
  const amount = Math.max(0, Math.min(5, Math.round(rating)));
  if (amount === 0) return "Sin calificaciones";
  return String.fromCharCode(9733).repeat(amount);
}

function timeAgo(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `Publicado hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Publicado hace ${hours} h`;
  return `Publicado hace ${Math.floor(hours / 24)} dias`;
}

function formatDate(value: string | null) {
  if (!value) return "Fecha no especificada";
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function statusClass(status: RequestDetail["status"]) {
  if (status === "ACTIVA") return "border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/15 text-[#ffd0bd]";
  if (status === "AGENDADA") return "border-orange-400/35 bg-orange-400/15 text-orange-200";
  if (status === "COMPLETADA") return "border-emerald-400/35 bg-emerald-400/15 text-emerald-200";
  return "border-rose-400/35 bg-rose-400/15 text-rose-200";
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </svg>
  );
}

export default function SolicitudDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<"CLIENTE" | "PROFESIONAL" | "ADMIN" | null>(null);
  const [requestDetail, setRequestDetail] = useState<RequestDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"presupuestos" | "chat">("presupuestos");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingChat, setSendingChat] = useState(false);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [confirmQuote, setConfirmQuote] = useState<QuoteItem | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadDetail(authToken: string) {
    const data = await apiRequest<RequestDetail>(`/requests/${params.id}`, { method: "GET", token: authToken });
    setRequestDetail(data);
  }

  async function loadMessages(authToken: string) {
    try {
      const response = await apiRequest<MessageItem[]>(`/messages/${params.id}`, { method: "GET", token: authToken });
      setMessages(response);
      setChatError(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
    } catch (err) {
      setMessages([]);
      setChatError(err instanceof Error ? err.message : "No fue posible cargar el chat.");
    }
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
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: savedToken });
        setUserId(profile.id);
        setUserName(profile.name);
        setRole(profile.role);
        await loadDetail(savedToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el detalle de la solicitud.");
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [params.id, router]);

  useEffect(() => {
    if (!token || activeTab !== "chat") return;
    void loadMessages(token);
    const timer = setInterval(() => void loadMessages(token), 5000);
    return () => clearInterval(timer);
  }, [activeTab, token]);

  const canAccept = useMemo(() => role === "CLIENTE" && requestDetail?.status === "ACTIVA", [role, requestDetail]);
  const hasOwnQuote = useMemo(
    () => Boolean(requestDetail?.quotes.some((quote) => quote.professional.id === userId || quote.professionalId === userId)),
    [requestDetail, userId],
  );

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function onAcceptQuote(quoteId: string) {
    if (!token) return;
    setAcceptingQuoteId(quoteId);
    setError(null);
    try {
      const response = await apiRequest<AcceptQuoteResponse>(`/requests/${params.id}/quotes/${quoteId}/accept`, { method: "PUT", token });
      showToast({ message: "Presupuesto aceptado correctamente", kind: "success" });
      if (response.job?.id) {
        router.push(`/dashboard/job/${response.job.id}/pagar`);
        return;
      }
      await loadDetail(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible aceptar el presupuesto.");
    } finally {
      setAcceptingQuoteId(null);
      setConfirmQuote(null);
    }
  }

  async function onSendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !chatInput.trim()) return;
    setSendingChat(true);
    setChatError(null);
    try {
      await apiRequest<MessageItem>(`/messages/${params.id}`, {
        method: "POST",
        token,
        body: JSON.stringify({ content: chatInput.trim() }),
      });
      setChatInput("");
      await loadMessages(token);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "No fue posible enviar el mensaje.");
    } finally {
      setSendingChat(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
        <div className="premium-panel h-64 animate-pulse" />
      </main>
    );
  }

  if (!requestDetail) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
        <div className="premium-error flex flex-wrap items-center justify-between gap-3">
          <span>{error || "No encontramos la solicitud."}</span>
          <Link href="/dashboard" className="underline">Volver al dashboard</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel-strong p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/15 px-3 py-1 text-xs font-bold text-[#ffd0bd]">
                {requestDetail.category.name}
              </span>
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(requestDetail.status)}`}>
                {requestDetail.status}
              </span>
            </div>
            <h1 className="mt-4 font-[var(--font-heading)] text-4xl font-extrabold text-white">Detalle de solicitud</h1>
            <p className="mt-2 text-sm text-brand-muted">{timeAgo(requestDetail.createdAt)}</p>
          </div>
          <Link href="/dashboard/mis-solicitudes" className="premium-btn-secondary px-4 py-2 text-sm">Mis solicitudes</Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-3xl border border-white/10 bg-[#0A0F1A]/55 p-5">
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Descripcion del trabajo</h2>
            <p className="mt-3 whitespace-pre-wrap text-[#d8e2f2]">{requestDetail.description}</p>
            {requestDetail.photosUrls?.length > 0 && (
              <div className="mt-5 grid grid-cols-3 gap-3">
                {requestDetail.photosUrls.slice(0, 5).map((photo, index) => (
                  <img key={`${photo}-${index}`} src={photo} alt="Foto de la solicitud" loading="lazy" className="h-28 w-full rounded-2xl border border-white/10 object-cover" />
                ))}
              </div>
            )}
          </article>

          <aside className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-accent)]">Ubicacion</p>
              <p className="mt-1 font-semibold text-white">{requestDetail.locationLabel || "Bogota, Colombia"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-accent)]">Horario preferido</p>
              <p className="mt-1 font-semibold text-white">{scheduleLabels[requestDetail.preferredSchedule || ""] || requestDetail.preferredSchedule || "Horario no especificado"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-accent)]">Fecha</p>
              <p className="mt-1 font-semibold text-white capitalize">{formatDate(requestDetail.preferredDateTime)}</p>
            </div>
          </aside>
        </div>

        <div className="mt-7 inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {(["presupuestos", "chat"] as const).map((tab) => (
            <button
              type="button"
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-5 py-2 text-sm font-bold capitalize transition ${
                activeTab === tab ? "bg-[var(--brand-accent)] text-white" : "text-[#c2d1e8] hover:bg-white/5"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {error && (
          <div className="premium-error mt-4 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => window.location.reload()} className="underline">Reintentar</button>
          </div>
        )}

        {activeTab === "presupuestos" ? (
          <section className="mt-6 space-y-4">
            {requestDetail.quotes.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] p-8 text-center">
                <p className="font-[var(--font-heading)] text-2xl font-bold text-white">Aun no hay presupuestos</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">Cuando un profesional envie una cotizacion, aparecera aqui con monto, tiempo estimado y reputacion.</p>
              </div>
            ) : (
              requestDetail.quotes.map((quote) => (
                <article key={quote.id} className="premium-panel premium-hover-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 font-bold text-[#ffd0bd]">
                        {quote.professional.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-lg font-bold text-white">{quote.professional.name}</p>
                          {quote.professional.verifiedBadge && <span className="rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2 py-0.5 text-[11px] font-bold text-emerald-200">Verificado</span>}
                        </div>
                        <p className="mt-1 text-sm text-[#f0a500]">{stars(quote.professional.avgRating)}</p>
                        <p className="text-xs text-[#9cb0cd]">{quote.professional.avgRating.toFixed(1)} de promedio - {quote.professional.reviewCount} resenas - {quote.professional.totalJobs} trabajos</p>
                      </div>
                    </div>
                    <p className="font-[var(--font-heading)] text-3xl font-extrabold text-[var(--brand-accent)]">{formatCop(quote.amountCop)}</p>
                  </div>
                  <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-[#dbe6f7]">{quote.message}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[#a7bbd8]">
                    <span>Tiempo estimado: {quote.estimatedHours} horas</span>
                    <Link href={`/dashboard/profesional/${quote.professional.id}`} className="text-[var(--brand-accent)] hover:underline">Ver perfil</Link>
                    {quote.jobId && <Link href={`/dashboard/job/${quote.jobId}`} className="text-emerald-300 hover:underline">Ver trabajo</Link>}
                  </div>
                  {canAccept && quote.status === "PENDIENTE" && (
                    <button type="button" onClick={() => setConfirmQuote(quote)} disabled={acceptingQuoteId === quote.id} className="premium-btn-primary mt-4 px-5 py-2.5 text-sm">
                      {acceptingQuoteId === quote.id ? "Aceptando..." : "Aceptar presupuesto"}
                    </button>
                  )}
                </article>
              ))
            )}
          </section>
        ) : (
          <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-[#0A0F1A]/65">
            {chatError && <div className="m-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{chatError}</div>}
            <div className="h-[430px] space-y-3 overflow-y-auto p-4 md:h-[500px]">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="font-[var(--font-heading)] text-2xl font-bold text-white">Sin mensajes todavia</p>
                  <p className="mt-2 max-w-md text-sm text-brand-muted">
                    {role === "PROFESIONAL" && !hasOwnQuote
                      ? "Envia tu cotizacion primero para poder chatear con el cliente."
                      : "Inicia la conversacion para coordinar detalles del servicio."}
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const own = message.sender.id === userId;
                  return (
                    <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                      <article className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${own ? "bg-[var(--brand-accent)] text-white" : "border border-white/10 bg-[#111827] text-[#dbe6f7]"}`}>
                        <p className="mb-1 text-[11px] font-semibold opacity-80">{message.sender.name}</p>
                        <p>{message.content}</p>
                        <p className="mt-2 text-[10px] opacity-70">{new Date(message.createdAt).toLocaleString("es-CO")}</p>
                      </article>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={onSendChat} className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2">
                <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} className="premium-input" placeholder="Escribe un mensaje claro y respetuoso..." />
                <button type="submit" disabled={sendingChat || !chatInput.trim()} className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-accent)] text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Enviar mensaje">
                  <SendIcon />
                </button>
              </div>
            </form>
          </section>
        )}
      </section>

      {confirmQuote && (
        <div className="fixed inset-0 z-50 bg-black/70">
          <button type="button" aria-label="Cerrar" className="absolute inset-0" onClick={() => setConfirmQuote(null)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-white/10 bg-[#0A0F1A] p-5 shadow-[0_-18px_40px_rgba(0,0,0,0.45)] md:bottom-6 md:left-1/2 md:max-w-lg md:-translate-x-1/2 md:rounded-2xl">
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Confirmar presupuesto</h2>
            <p className="mt-2 text-sm text-brand-muted">Al confirmar, la solicitud queda agendada y pasaras al pago seguro.</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="font-bold text-white">{confirmQuote.professional.name}</p>
              <p className="mt-1 text-2xl font-extrabold text-[var(--brand-accent)]">{formatCop(confirmQuote.amountCop)}</p>
              <p className="mt-1 text-sm text-[#b8c9e2]">Tiempo estimado: {confirmQuote.estimatedHours} horas</p>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirmQuote(null)} className="premium-btn-secondary w-full py-3 text-sm">Cancelar</button>
              <button type="button" onClick={() => void onAcceptQuote(confirmQuote.id)} disabled={acceptingQuoteId === confirmQuote.id} className="premium-btn-primary w-full py-3 text-sm">
                {acceptingQuoteId === confirmQuote.id ? "Confirmando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

