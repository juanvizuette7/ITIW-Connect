"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";

type NotificationType =
  | "SOLICITUD"
  | "PRESUPUESTO"
  | "MENSAJE"
  | "PAGO"
  | "CALIFICACION"
  | "BADGE"
  | "DISPUTA"
  | "SISTEMA";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
};

type PaginatedNotificationsResponse = {
  data: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ProfileMeResponse = {
  name: string;
};

function typeLabel(type: NotificationType) {
  if (type === "SOLICITUD") return "Solicitud";
  if (type === "PRESUPUESTO") return "Presupuesto";
  if (type === "MENSAJE") return "Mensaje";
  if (type === "PAGO") return "Pago";
  if (type === "CALIFICACION") return "Calificacion";
  if (type === "BADGE") return "Badge";
  if (type === "DISPUTA") return "Disputa";
  return "Sistema";
}

function typeIcon(type: NotificationType) {
  if (type === "SOLICITUD") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  if (type === "PRESUPUESTO") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7h16v10H4zM4 11h16M8 15h2" />
      </svg>
    );
  }

  if (type === "MENSAJE") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 6h14v9H8l-3 3z" />
      </svg>
    );
  }

  if (type === "PAGO") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7h18v10H3zM3 11h18M7 15h3" />
      </svg>
    );
  }

  if (type === "CALIFICACION") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m12 4 2.2 4.5 4.8.7-3.5 3.4.8 4.8L12 15l-4.3 2.3.8-4.8L5 9.2l4.8-.7z" />
      </svg>
    );
  }

  if (type === "BADGE") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 4h10v6a5 5 0 1 1-10 0zM9 20l3-2 3 2" />
      </svg>
    );
  }

  if (type === "DISPUTA") {
    return (
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 7v6m0 4h.01M5 4h14l-1 14H6z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 6v6m0 6h.01M6 6h12v12H6z" />
    </svg>
  );
}

function typeClass(type: NotificationType) {
  if (type === "SOLICITUD") return "border-cyan-400/40 bg-cyan-400/15 text-cyan-200";
  if (type === "PRESUPUESTO") return "border-fuchsia-400/40 bg-fuchsia-400/15 text-fuchsia-200";
  if (type === "MENSAJE") return "border-sky-400/40 bg-sky-400/15 text-sky-200";
  if (type === "PAGO") return "border-emerald-400/40 bg-emerald-400/15 text-emerald-200";
  if (type === "CALIFICACION") return "border-amber-400/40 bg-amber-400/15 text-amber-200";
  if (type === "BADGE") return "border-violet-400/40 bg-violet-400/15 text-violet-200";
  if (type === "DISPUTA") return "border-rose-400/40 bg-rose-400/15 text-rose-200";
  return "border-slate-400/40 bg-slate-400/15 text-slate-200";
}

function relativeTime(dateValue: string) {
  const now = Date.now();
  const time = new Date(dateValue).getTime();
  const diffMs = Math.max(0, now - time);

  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "hace unos segundos";
  if (minutes < 60) return `hace ${minutes} minuto${minutes === 1 ? "" : "s"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hora${hours === 1 ? "" : "s"}`;

  const days = Math.floor(hours / 24);
  return `hace ${days} dia${days === 1 ? "" : "s"}`;
}

export default function NotificacionesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [fadingIds, setFadingIds] = useState<string[]>([]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.isRead).length, [notifications]);

  const loadNotifications = async (authToken: string, background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const list = await apiRequest<PaginatedNotificationsResponse>("/notifications?page=1&limit=100", {
        method: "GET",
        token: authToken,
      });
      setNotifications(list.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar las notificaciones.");
    } finally {
      if (background) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const authToken = getToken();
    if (!authToken) {
      router.replace("/auth/login");
      return;
    }

    setToken(authToken);

    const init = async () => {
      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", {
          method: "GET",
          token: authToken,
        });
        setUserName(profile.name);
      } catch {
        setUserName("Bienvenido");
      }

      await loadNotifications(authToken);
    };

    void init();

    const timer = setInterval(() => {
      void loadNotifications(authToken, true);
    }, 10_000);

    return () => {
      clearInterval(timer);
    };
  }, [router]);

  const onLogout = () => {
    clearSession();
    router.push("/");
  };

  const onMarkRead = async (id: string) => {
    if (!token) return;

    try {
      setFadingIds((current) => [...current, id]);
      await apiRequest<{ message: string }>(`/notifications/${id}/read`, {
        method: "PUT",
        token,
      });

      setTimeout(() => {
        setNotifications((current) =>
          current.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
        );
        setFadingIds((current) => current.filter((itemId) => itemId !== id));
      }, 220);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible marcar la notificacion.");
      setFadingIds((current) => current.filter((itemId) => itemId !== id));
    }
  };

  const onMarkAllRead = async () => {
    if (!token) return;

    try {
      await apiRequest<{ message: string }>("/notifications/read-all", {
        method: "PUT",
        token,
      });
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible marcar todas como leidas.");
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 text-brand-muted">Cargando notificaciones...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Notificaciones</h1>
            <p className="mt-2 text-sm text-brand-muted">
              Polling automatico cada 10 segundos. No leidas: {unreadCount}
              {refreshing ? " � sincronizando..." : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="rounded-xl border border-[#e94560]/35 bg-[#e94560]/12 px-4 py-2 text-sm font-semibold text-[#82ffe8] transition hover:bg-[#e94560]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Marcar todas como leidas
          </button>
        </div>

        {error && <p className="premium-error mt-4">{error}</p>}

        <div className="mt-6 space-y-3">
          {notifications.length === 0 ? (
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-brand-muted">
              Aun no tienes notificaciones.
            </article>
          ) : (
            notifications.map((item, index) => {
              const isFading = fadingIds.includes(item.id);

              return (
                <article
                  key={item.id}
                  className={`rounded-xl border p-4 transition-all duration-300 ${
                    item.isRead
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-[#e94560]/35 bg-[#e94560]/12"
                  } ${isFading ? "opacity-40" : "opacity-100"}`}
                  style={{
                    animation: `notif-slide-in 400ms ease both`,
                    animationDelay: `${Math.min(index * 70, 420)}ms`,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${typeClass(item.type)}`}>
                        {typeIcon(item.type)}
                        {typeLabel(item.type)}
                      </span>
                      {!item.isRead && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#e94560]/40 bg-[#e94560]/15 px-2 py-0.5 text-[11px] text-[#83fce5]">
                          <span className="h-2 w-2 rounded-full bg-[#e94560] animate-teal-pulse" />
                          Nueva
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#94a3b8]">{relativeTime(item.createdAt)}</p>
                  </div>

                  <p className="mt-3 font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-brand-muted">{item.body}</p>

                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(item.id)}
                      className="mt-3 rounded-lg border border-[#e94560]/40 bg-[#e94560]/10 px-3 py-1.5 text-xs font-semibold text-[#83fce5] transition hover:bg-[#e94560]/20"
                    >
                      Marcar como leida
                    </button>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      <style jsx global>{`
        @keyframes notif-slide-in {
          from {
            opacity: 0;
            transform: translateX(16px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </main>
  );
}


