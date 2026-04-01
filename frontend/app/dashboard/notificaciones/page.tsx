"use client";

import { useEffect, useState } from "react";
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

export default function NotificacionesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const loadNotifications = async (authToken: string, background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const list = await apiRequest<NotificationItem[]>("/notifications", {
        method: "GET",
        token: authToken,
      });
      setNotifications(list);
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
    router.push("/auth/login");
  };

  const onMarkRead = async (id: string) => {
    if (!token) return;

    try {
      await apiRequest<{ message: string }>(`/notifications/${id}/read`, {
        method: "PUT",
        token,
      });
      setNotifications((current) =>
        current.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible marcar la notificacion.");
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

      <section className="premium-panel p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Notificaciones</h1>
            <p className="mt-2 text-sm text-brand-muted">
              Actualizacion automatica cada 10 segundos. No leidas: {unreadCount}
              {refreshing ? " · sincronizando..." : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="premium-btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
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
            notifications.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border p-4 transition ${
                  item.isRead
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-[#00C9A7]/35 bg-[#00C9A7]/10"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${typeClass(item.type)}`}>
                      {typeLabel(item.type)}
                    </span>
                    {!item.isRead && (
                      <span className="rounded-full border border-[#00C9A7]/50 bg-[#00C9A7]/15 px-2 py-0.5 text-[11px] text-[#89ffe8]">
                        Nueva
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#94a3b8]">{new Date(item.createdAt).toLocaleString("es-CO")}</p>
                </div>

                <p className="mt-3 font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm text-brand-muted">{item.body}</p>

                {!item.isRead && (
                  <button
                    type="button"
                    onClick={() => onMarkRead(item.id)}
                    className="mt-3 rounded-lg border border-[#00C9A7]/40 bg-[#00C9A7]/10 px-3 py-1.5 text-xs font-semibold text-[#83fce5] transition hover:bg-[#00C9A7]/20"
                  >
                    Marcar como leida
                  </button>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

