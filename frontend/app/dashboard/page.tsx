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
  paymentStatus: "PENDIENTE" | "RETENIDO" | "LIBERADO" | "REEMBOLSADO";
};

type ProfileMeResponse = {
  name: string;
  role: UserRole;
};

function CardIcon({ variant }: { variant: "plus" | "list" | "profile" | "briefcase" | "payments" }) {
  if (variant === "plus") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }

  if (variant === "list") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 6h10M9 12h10M9 18h10M4 6h.01M4 12h.01M4 18h.01" />
      </svg>
    );
  }

  if (variant === "briefcase") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 8h18v11H3zM9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    );
  }

  if (variant === "payments") {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 7h18v10H3zM3 11h18M7 15h3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
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

        const jobs = await apiRequest<JobItem[]>("/jobs", {
          method: "GET",
          token,
        });
        setPendingPaymentsCount(jobs.filter((job) => job.paymentStatus === "PENDIENTE").length);

        if (profile.role === "CLIENTE") {
          const requests = await apiRequest<ClientRequest[]>("/requests", {
            method: "GET",
            token,
          });
          setActiveRequestsCount(requests.filter((request) => request.status === "ACTIVA").length);
        }

        if (profile.role === "PROFESIONAL") {
          const [availableRequests, myQuotes] = await Promise.all([
            apiRequest<AvailableRequest[]>("/requests/available", {
              method: "GET",
              token,
            }),
            apiRequest<ProfessionalQuote[]>("/requests/my-quotes", {
              method: "GET",
              token,
            }),
          ]);
          setAvailableRequestsCount(availableRequests.length);
          setPendingQuotesCount(myQuotes.filter((quote) => quote.status === "PENDIENTE").length);
        }
      } catch (err) {
        clearSession();
        router.replace("/auth/login");
        setError(err instanceof Error ? err.message : "No fue posible cargar el dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  const clientCards = useMemo(
    () => [
      {
        icon: <CardIcon variant="plus" />,
        title: "Nueva solicitud",
        description: "Crea una nueva solicitud y recibe cotizaciones.",
        countLabel: `${activeRequestsCount} activas`,
        href: "/dashboard/nueva-solicitud",
      },
      {
        icon: <CardIcon variant="list" />,
        title: "Mis solicitudes",
        description: "Consulta estados, presupuestos y avances.",
        countLabel: `${activeRequestsCount} activas`,
        href: "/dashboard/mis-solicitudes",
      },
      {
        icon: <CardIcon variant="payments" />,
        title: "Mis pagos",
        description: "Revisa estado de escrow y pagos liberados.",
        countLabel: `${pendingPaymentsCount} pendientes`,
        href: "/dashboard/mis-jobs",
      },
      {
        icon: <CardIcon variant="profile" />,
        title: "Mi perfil",
        description: "Actualiza tus datos personales y direcciones.",
        countLabel: "Editar perfil",
        href: "/dashboard/profile",
      },
    ],
    [activeRequestsCount, pendingPaymentsCount],
  );

  const professionalCards = useMemo(
    () => [
      {
        icon: <CardIcon variant="briefcase" />,
        title: "Solicitudes disponibles",
        description: "Revisa nuevos trabajos y envia tu cotizacion.",
        countLabel: `${availableRequestsCount} nuevas`,
        href: "/dashboard/solicitudes-disponibles",
      },
      {
        icon: <CardIcon variant="list" />,
        title: "Mis cotizaciones",
        description: "Gestiona tus propuestas enviadas.",
        countLabel: `${pendingQuotesCount} pendientes`,
        href: "/dashboard/mis-cotizaciones",
      },
      {
        icon: <CardIcon variant="payments" />,
        title: "Mis pagos",
        description: "Consulta los jobs y pagos en escrow.",
        countLabel: `${pendingPaymentsCount} pendientes`,
        href: "/dashboard/mis-jobs",
      },
      {
        icon: <CardIcon variant="profile" />,
        title: "Mi perfil",
        description: "Ajusta bio, especialidades y tarifa.",
        countLabel: "Editar perfil",
        href: "/dashboard/profile",
      },
    ],
    [availableRequestsCount, pendingPaymentsCount, pendingQuotesCount],
  );

  function onLogout() {
    clearSession();
    router.push("/auth/login");
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando dashboard...</main>;
  }

  const cards = role === "PROFESIONAL" ? professionalCards : clientCards;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={name} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Panel principal</h1>
        <p className="mt-2 text-brand-muted">Accede rapidamente a los modulos clave de tu cuenta.</p>

        {error && <p className="premium-error mt-4">{error}</p>}

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="premium-panel p-5 transition duration-200 hover:-translate-y-0.5 hover:border-white/20"
            >
              <div className="mb-3 text-brand-accent">{card.icon}</div>
              <p className="font-[var(--font-heading)] text-xl font-bold text-white">{card.title}</p>
              <p className="mt-2 text-sm text-brand-muted">{card.description}</p>
              <p className="mt-3 text-sm font-medium text-brand-accent">{card.countLabel}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
