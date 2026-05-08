"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type ClientRequest = {
  id: string;
  status: "ACTIVA" | "AGENDADA" | "COMPLETADA" | "CANCELADA";
};

type AvailableRequest = {
  id: string;
};

type ProfessionalQuote = {
  id: string;
  status: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
};

type JobItem = {
  id: string;
  status: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "CANCELADO";
  paymentStatus: "PENDIENTE" | "RETENIDO" | "LIBERADO" | "REEMBOLSADO";
};

type PaymentHistoryResponse = {
  data: Array<{ id: string }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  totals: {
    totalPagado: number;
    totalComisiones: number;
    totalNeto: number;
  };
};

type PaginatedClientRequests = {
  data: ClientRequest[];
};

type ProfileMeResponse = {
  id: string;
  name: string;
  role: UserRole;
};

type UnreadCountResponse = {
  unread: number;
};

type OnboardingStatusResponse = {
  onboardingCompleted: boolean;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
};

type ProfessionalStatsResponse = {
  professionalProfile: {
    avgRating: number | string;
  };
};

function formatCop(value: number) {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function TileIcon({ name }: { name: "new" | "list" | "briefcase" | "money" | "history" | "notif" | "profile" }) {
  if (name === "new") {
    return <span className="text-lg">?</span>;
  }
  if (name === "list") {
    return <span className="text-lg">??</span>;
  }
  if (name === "briefcase") {
    return <span className="text-lg">??</span>;
  }
  if (name === "money") {
    return <span className="text-lg">??</span>;
  }
  if (name === "history") {
    return <span className="text-lg">??</span>;
  }
  if (name === "notif") {
    return <span className="text-lg">??</span>;
  }
  return <span className="text-lg">??</span>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRequestsCount, setActiveRequestsCount] = useState(0);
  const [availableRequestsCount, setAvailableRequestsCount] = useState(0);
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [onboarding, setOnboarding] = useState<OnboardingStatusResponse | null>(null);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      const token = getToken();
      const savedRole = getRole();

      if (!token || !savedRole) {
        router.replace("/auth/login");
        return;
      }

      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", {
          method: "GET",
          token,
        });

        setName(profile.name);
        setRole(profile.role);

        if (profile.role === "ADMIN") {
          router.replace("/admin/dashboard");
          return;
        }

        const [jobs, currentMonthHistory, unread] = await Promise.all([
          apiRequest<JobItem[]>("/jobs", { method: "GET", token }),
          (() => {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999);
            const query = `?fechaInicio=${encodeURIComponent(monthStart.toISOString())}&fechaFin=${encodeURIComponent(monthEnd.toISOString())}`;
            return apiRequest<PaymentHistoryResponse>(`/payments/history${query}`, {
              method: "GET",
              token,
            });
          })(),
          apiRequest<UnreadCountResponse>("/notifications/unread-count", { method: "GET", token }),
        ]);

        setPendingPaymentsCount(jobs.filter((job) => job.paymentStatus === "PENDIENTE").length);
        setCompletedJobs(jobs.filter((job) => job.status === "COMPLETADO").length);
        setMonthTotal(currentMonthHistory.totals.totalPagado);
        setUnreadNotifications(unread.unread);

        if (profile.role === "CLIENTE") {
          const requests = await apiRequest<PaginatedClientRequests>("/requests?page=1&limit=200", {
            method: "GET",
            token,
          });
          setActiveRequestsCount(requests.data.filter((request) => request.status === "ACTIVA").length);
          setAvgRating(null);
        }

        if (profile.role === "PROFESIONAL") {
          const [availableRequests, myQuotes, onboardingStatus, professionalPublic] = await Promise.all([
            apiRequest<AvailableRequest[]>("/requests/available", { method: "GET", token }),
            apiRequest<ProfessionalQuote[]>("/requests/my-quotes", { method: "GET", token }),
            apiRequest<OnboardingStatusResponse>("/onboarding/status", { method: "GET", token }),
            apiRequest<ProfessionalStatsResponse>(`/profile/professional/${profile.id}`, { method: "GET", token }),
          ]);
          setAvailableRequestsCount(availableRequests.length);
          setPendingQuotesCount(myQuotes.filter((quote) => quote.status === "PENDIENTE").length);
          setOnboarding(onboardingStatus);
          setAvgRating(Number(professionalPublic.professionalProfile?.avgRating || 0));
        }
      } catch (err) {
        clearSession();
        router.replace("/auth/login");
        setError(err instanceof Error ? err.message : "No fue posible cargar el dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [router]);

  const stats = useMemo(
    () => [
      {
        title: role === "PROFESIONAL" ? "Solicitudes activas" : "Solicitudes activas",
        value: role === "PROFESIONAL" ? availableRequestsCount : activeRequestsCount,
      },
      {
        title: "Trabajos completados",
        value: completedJobs,
      },
      {
        title: "Calificaci�n promedio",
        value: avgRating === null ? "Sin calificar" : avgRating.toFixed(1),
      },
    ],
    [activeRequestsCount, availableRequestsCount, avgRating, completedJobs, role],
  );

  const clientCards = useMemo(
    () => [
      {
        icon: <TileIcon name="new" />,
        title: "Nueva solicitud",
        description: "Publica un servicio y recibe cotizaciones verificadas.",
        countLabel: `${activeRequestsCount} activas`,
        href: "/dashboard/nueva-solicitud",
      },
      {
        icon: <TileIcon name="list" />,
        title: "Mis solicitudes",
        description: "Consulta estado, presupuestos y avance de cada servicio.",
        countLabel: `${activeRequestsCount} activas`,
        href: "/dashboard/mis-solicitudes",
      },
      {
        icon: <TileIcon name="money" />,
        title: "Mis pagos",
        description: "Monitorea pagos pendientes y liberaciones en escrow.",
        countLabel: `${pendingPaymentsCount} pendientes`,
        href: "/dashboard/mis-jobs",
      },
      {
        icon: <TileIcon name="history" />,
        title: "Mi historial",
        description: "Revisa movimientos y totales del mes actual.",
        countLabel: formatCop(monthTotal),
        href: "/dashboard/historial",
      },
      {
        icon: <TileIcon name="profile" />,
        title: "Mi perfil",
        description: "Actualiza tus datos y preferencias de cuenta.",
        countLabel: "Editar",
        href: "/dashboard/profile",
      },
      {
        icon: <TileIcon name="notif" />,
        title: "Notificaciones",
        description: "Mantente al d�a con alertas importantes.",
        countLabel: unreadNotifications > 0 ? `${unreadNotifications} nuevas` : "Sin pendientes",
        href: "/dashboard/notificaciones",
      },
    ],
    [activeRequestsCount, monthTotal, pendingPaymentsCount, unreadNotifications],
  );

  const professionalCards = useMemo(
    () => [
      {
        icon: <TileIcon name="briefcase" />,
        title: "Solicitudes disponibles",
        description: "Explora trabajos activos y env�a tu propuesta.",
        countLabel: `${availableRequestsCount} nuevas`,
        href: "/dashboard/solicitudes-disponibles",
      },
      {
        icon: <TileIcon name="list" />,
        title: "Mis cotizaciones",
        description: "Gestiona tus propuestas enviadas a clientes.",
        countLabel: `${pendingQuotesCount} pendientes`,
        href: "/dashboard/mis-cotizaciones",
      },
      {
        icon: <TileIcon name="money" />,
        title: "Mis pagos",
        description: "Revisa jobs y estados de pago en escrow.",
        countLabel: `${pendingPaymentsCount} pendientes`,
        href: "/dashboard/mis-jobs",
      },
      {
        icon: <TileIcon name="history" />,
        title: "Mi historial",
        description: "Controla ingresos, comisiones y movimiento mensual.",
        countLabel: formatCop(monthTotal),
        href: "/dashboard/historial",
      },
      {
        icon: <TileIcon name="profile" />,
        title: "Mi perfil",
        description: "Actualiza bio, especialidades y portafolio.",
        countLabel: "Editar",
        href: "/dashboard/profile",
      },
      {
        icon: <TileIcon name="notif" />,
        title: "Notificaciones",
        description: "Sigue tus alertas en tiempo real.",
        countLabel: unreadNotifications > 0 ? `${unreadNotifications} nuevas` : "Sin pendientes",
        href: "/dashboard/notificaciones",
      },
    ],
    [availableRequestsCount, monthTotal, pendingPaymentsCount, pendingQuotesCount, unreadNotifications],
  );

  function onLogout() {
    clearSession();
    router.push("/");
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando dashboard...</main>;
  }

  const cards = role === "PROFESIONAL" ? professionalCards : clientCards;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={name} onLogout={onLogout} />

      {role === "PROFESIONAL" && onboarding && !onboarding.onboardingCompleted && (
        <section className="mb-5 rounded-2xl border border-amber-400/35 bg-amber-400/12 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-200">Completa tu perfil para empezar a recibir solicitudes.</p>
              <div className="mt-2 h-2 w-[260px] max-w-full overflow-hidden rounded-full bg-amber-100/20">
                <div
                  className="h-full rounded-full bg-amber-300 transition-all duration-700"
                  style={{ width: `${onboarding.progress.percentage}%` }}
                />
              </div>
            </div>
            <Link href="/dashboard/onboarding" className="rounded-lg bg-amber-300 px-3 py-2 text-xs font-semibold text-[#2f2200]">
              Ir a onboarding
            </Link>
          </div>
        </section>
      )}

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Panel principal</h1>
        <p className="mt-2 text-brand-muted">Resumen r�pido de tu actividad y accesos principales.</p>

        {error && <p className="premium-error mt-4">{error}</p>}

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {stats.map((stat) => (
            <article key={stat.title} className="rounded-2xl border border-[var(--border)] bg-[#0d1928] p-4">
              <p className="text-xs uppercase tracking-wide text-[#9bb0ce]">{stat.title}</p>
              <p className="mt-2 font-[var(--font-heading)] text-3xl font-extrabold text-[var(--brand-accent)]">{stat.value}</p>
            </article>
          ))}
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="premium-panel premium-hover-card p-5"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 text-[#8effea]">
                {card.icon}
              </div>
              <p className="font-[var(--font-heading)] text-xl font-bold text-white">{card.title}</p>
              <p className="mt-2 text-sm text-brand-muted">{card.description}</p>
              <p className="mt-3 text-sm font-semibold text-[var(--brand-accent)]">{card.countLabel}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}


