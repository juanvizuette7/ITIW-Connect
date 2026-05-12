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
  category: {
    name: string;
  };
  quotes: QuoteItem[];
};

type ProfileMeResponse = {
  id: string;
  name: string;
  role: "CLIENTE" | "PROFESIONAL";
};

type AcceptQuoteResponse = {
  message: string;
  job: {
    id: string;
  };
};

type MessageItem = {
  id: string;
  requestId: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    role: "CLIENTE" | "PROFESIONAL";
    name: string;
  };
};

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function stars(rating: number): string {
  const amount = Math.max(0, Math.min(5, Math.round(rating)));
  if (amount === 0) return "Sin calificaciones";
  return "★".repeat(amount);
}

function statusClass(status: RequestDetail["status"]) {
  if (status === "ACTIVA") return "border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/15 text-[#80ffe8]";
  if (status === "AGENDADA") return "border-sky-400/35 bg-sky-400/15 text-sky-200";
  if (status === "COMPLETADA") return "border-emerald-400/35 bg-emerald-400/15 text-emerald-200";
  return "border-rose-400/35 bg-rose-400/15 text-rose-200";
}

function ChatSendIcon() {
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
  const [role, setRole] = useState<"CLIENTE" | "PROFESIONAL" | null>(null);
  const [requestDetail, setRequestDetail] = useState<RequestDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"presupuestos" | "chat">("presupuestos");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acceptingQuoteId, setAcceptingQuoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmQuote, setConfirmQuote] = useState<QuoteItem | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function loadDetail(authToken: string) {
    const data = await apiRequest<RequestDetail>(`/requests/${params.id}`, {
      method: "GET",
      token: authToken,
    });
    setRequestDetail(data);
  }

  async function loadMessages(authToken: string) {
    const response = await apiRequest<MessageItem[]>(`/messages/${params.id}`, {
      method: "GET",
      token: authToken,
    });
    setMessages(response);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
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
        setUserId(profile.id);
        setUserName(profile.name);
        setRole(profile.role);

        await Promise.all([loadDetail(savedToken), loadMessages(savedToken)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el detalle.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [params.id, router]);

  useEffect(() => {
    if (!token || activeTab !== "chat") return;

    const timer = setInterval(() => {
      void loadMessages(token);
    }, 5000);

    return () => clearInterval(timer);
  }, [activeTab, token]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function onAcceptQuote(quoteId: string) {
    if (!token) return;

    setAcceptingQuoteId(quoteId);
    setError(null);

    try {
      const response = await apiRequest<AcceptQuoteResponse>(`/requests/${params.id}/quotes/${quoteId}/accept`, {
        method: "PUT",
        token,
      });

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
    setError(null);

    try {
      await apiRequest<MessageItem>(`/messages/${params.id}`, {
        method: "POST",
        token,
        body: JSON.stringify({ content: chatInput.trim() }),
      });
      setChatInput("");
      await loadMessages(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar el mensaje.");
    } finally {
      setSendingChat(false);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Detalle de solicitud</h1>
            <p className="mt-1 text-sm text-brand-muted">{requestDetail.category.name}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(requestDetail.status)}`}>
            {requestDetail.status}
          </span>
        </div>

        <p className="mt-4 text-[#d5dded]">{requestDetail.description}</p>

        <div className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("presupuestos")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "presupuestos"
                ? "bg-[var(--brand-accent)] text-[#032920]"
                : "text-[#c2d1e8] hover:bg-white/5"
            }`}
          >
            Presupuestos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "chat"
                ? "bg-[var(--brand-accent)] text-[#032920]"
                : "text-[#c2d1e8] hover:bg-white/5"
            }`}
          >
            Chat
          </button>
        </div>

        {error && (
          <div className="premium-error mt-4 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => window.location.reload()} className="underline">
              Reintentar
            </button>
          </div>
        )}

        {activeTab === "presupuestos" ? (
          <div className="mt-6 space-y-4">
            {requestDetail.quotes.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
                <div className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-2xl">💬</div>
                <p className="text-base font-semibold text-white">Aún no tienes presupuestos</p>
                <p className="mt-1 text-sm text-brand-muted">Cuando un profesional cotice, aparecerá aquí automáticamente.</p>
                <Link href="/dashboard/mis-solicitudes" className="premium-btn-secondary mt-4 inline-flex px-4 py-2 text-sm">
                  Ver mis solicitudes
                </Link>
              </div>
            ) : (
              requestDetail.quotes.map((quote) => (
                <article key={quote.id} className="premium-panel p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 text-sm font-bold text-[#8dffea]">
                        {quote.professional.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{quote.professional.name}</p>
                          {quote.professional.verifiedBadge && (
                            <span className="rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                              Verificado
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#f5cf7a]">{stars(quote.professional.avgRating)}</p>
                        <p className="text-xs text-[#9cb0cd]">
                          {quote.professional.avgRating.toFixed(1)} · {quote.professional.reviewCount} reseñas
                        </p>
                      </div>
                    </div>

                    <p className="font-[var(--font-heading)] text-2xl font-bold text-[var(--brand-accent)]">{formatCop(quote.amountCop)}</p>
                  </div>

                  <p className="mt-3 text-sm text-[#cbd5e1]">{quote.message}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[#a7bbd8]">
                    <span>Tiempo estimado: {quote.estimatedHours} horas</span>
                    <span>Trabajos: {quote.professional.totalJobs}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link href={`/dashboard/profesional/${quote.professional.id}`} className="text-sm text-[var(--brand-accent)] hover:underline">
                      Ver perfil
                    </Link>

                    {canAccept && quote.status === "PENDIENTE" && (
                      <button
                        type="button"
                        onClick={() => setConfirmQuote(quote)}
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
        ) : (
          <section className="mt-6 rounded-2xl border border-white/10 bg-[#0b1828]">
            <div className="h-[420px] space-y-3 overflow-y-auto p-4 md:h-[480px]">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-3 text-3xl">💬</div>
                  <p className="text-sm font-semibold text-white">Aún no hay mensajes</p>
                  <p className="mt-1 text-xs text-brand-muted">Inicia la conversación para coordinar detalles del servicio.</p>
                </div>
              ) : (
                messages.map((message) => {
                  const own = message.sender.id === userId;
                  return (
                    <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                      <article
                        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                          own
                            ? "bg-[var(--brand-accent)] text-[#06261f]"
                            : "border border-white/10 bg-[#111827] text-[#dbe6f7]"
                        }`}
                      >
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
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  className="premium-input"
                  placeholder="Escribe un mensaje..."
                />
                <button
                  type="submit"
                  disabled={sendingChat || !chatInput.trim()}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[#05261f] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Enviar mensaje"
                >
                  <ChatSendIcon />
                </button>
              </div>
            </form>
          </section>
        )}
      </section>

      {confirmQuote && (
        <div className="fixed inset-0 z-50 bg-black/65">
          <button type="button" aria-label="Cerrar" className="absolute inset-0" onClick={() => setConfirmQuote(null)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-white/10 bg-[#0A0F1A] p-5 shadow-[0_-18px_40px_rgba(0,0,0,0.45)] md:left-1/2 md:max-w-lg md:-translate-x-1/2 md:bottom-6 md:rounded-2xl">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-white">Confirmar presupuesto</h2>
            <p className="mt-3 text-sm text-brand-muted">Vas a aceptar este profesional para tu solicitud:</p>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
              <p className="font-semibold text-white">{confirmQuote.professional.name}</p>
              <p className="mt-1 text-[var(--brand-accent)]">{formatCop(confirmQuote.amountCop)}</p>
              <p className="mt-1 text-[#b8c9e2]">Tiempo estimado: {confirmQuote.estimatedHours} horas</p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmQuote(null)}
                className="premium-btn-secondary w-full py-2.5 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void onAcceptQuote(confirmQuote.id)}
                disabled={acceptingQuoteId === confirmQuote.id}
                className="premium-btn-primary w-full py-2.5 text-sm"
              >
                {acceptingQuoteId === confirmQuote.id ? "Confirmando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

