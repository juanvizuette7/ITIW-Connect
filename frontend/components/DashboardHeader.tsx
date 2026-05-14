"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { apiRequest } from "@/lib/api";
import { getRole, getToken } from "@/lib/auth";

interface DashboardHeaderProps {
  userName?: string;
  onLogout: () => void;
  showNotifications?: boolean;
}

type UnreadCountResponse = {
  unread: number;
};

type RoleType = "CLIENTE" | "PROFESIONAL" | "ADMIN" | null;

type MobileNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

const pathLabels: Record<string, string> = {
  dashboard: "Dashboard",
  "nueva-solicitud": "Nueva solicitud",
  "mis-solicitudes": "Mis solicitudes",
  solicitud: "Solicitud",
  "solicitudes-disponibles": "Solicitudes disponibles",
  "mis-cotizaciones": "Mis cotizaciones",
  "mis-jobs": "Mis jobs",
  job: "Trabajo",
  pagar: "Pagar",
  chat: "Chat",
  calificar: "Calificar",
  profile: "Perfil",
  notificaciones: "Notificaciones",
  disputas: "Disputas",
  admin: "Admin",
  profesionales: "Profesionales",
  historial: "Historial",
  onboarding: "Onboarding",
  buscar: "Buscar",
  nps: "NPS",
  profesional: "Profesional",
};

function isTechnicalPathSegment(part: string) {
  const decoded = decodeURIComponent(part);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cuidPattern = /^c[a-z0-9]{20,}$/i;
  const longOpaqueIdPattern = /^(?=.*\d)[a-z0-9_-]{16,}$/i;

  return uuidPattern.test(decoded) || cuidPattern.test(decoded) || longOpaqueIdPattern.test(decoded);
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="m3 11 9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function RequestsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" />
    </svg>
  );
}

export function DashboardHeader({ userName, onLogout, showNotifications = true }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [bounce, setBounce] = useState(false);
  const [role, setRole] = useState<RoleType>(null);
  const previousUnread = useRef(0);

  useEffect(() => {
    setRole(getRole());
  }, []);

  useEffect(() => {
    if (!showNotifications) return;

    let mounted = true;

    const loadUnread = async () => {
      try {
        const response = await apiRequest<UnreadCountResponse>("/notifications/unread-count", {
          method: "GET",
          token: getToken() || "",
        });

        if (!mounted) return;

        if (response.unread > previousUnread.current) {
          setBounce(true);
          setTimeout(() => setBounce(false), 650);
        }

        previousUnread.current = response.unread;
        setUnread(response.unread);
      } catch {
        if (mounted) setUnread(0);
      }
    };

    void loadUnread();
    const timer = setInterval(() => {
      void loadUnread();
    }, 10_000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [showNotifications]);

  const crumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return [] as Array<{ label: string; href: string }>;

    let currentPath = "";
    return parts.reduce<Array<{ label: string; href: string }>>((acc, part) => {
      currentPath += `/${part}`;

      if (isTechnicalPathSegment(part)) {
        return acc;
      }

      acc.push({
        label: pathLabels[part] || part,
        href: currentPath,
      });

      return acc;
    }, []);
  }, [pathname]);

  const showBack = pathname !== "/dashboard" && pathname !== "/admin/dashboard";
  const displayName = userName?.trim() ? userName.trim() : "Bienvenido";

  const mobileItems = useMemo<MobileNavItem[]>(() => {
    if (role === "ADMIN") {
      return [
        { href: "/admin/dashboard", label: "Inicio", icon: <HomeIcon /> },
        { href: "/buscar", label: "Buscar", icon: <SearchIcon /> },
        { href: "/admin/profesionales", label: "Admin", icon: <RequestsIcon /> },
        { href: "/dashboard/notificaciones", label: "Alertas", icon: <BellIcon /> },
        { href: "/dashboard/profile", label: "Perfil", icon: <UserIcon /> },
      ];
    }

    if (role === "PROFESIONAL") {
      return [
        { href: "/dashboard", label: "Inicio", icon: <HomeIcon /> },
        { href: "/buscar", label: "Buscar", icon: <SearchIcon /> },
        { href: "/dashboard/solicitudes-disponibles", label: "Solicitudes", icon: <RequestsIcon /> },
        { href: "/dashboard/notificaciones", label: "Alertas", icon: <BellIcon /> },
        { href: "/dashboard/profile", label: "Perfil", icon: <UserIcon /> },
      ];
    }

    return [
      { href: "/dashboard", label: "Inicio", icon: <HomeIcon /> },
      { href: "/buscar", label: "Buscar", icon: <SearchIcon /> },
      { href: "/dashboard/mis-solicitudes", label: "Solicitudes", icon: <RequestsIcon /> },
      { href: "/dashboard/notificaciones", label: "Alertas", icon: <BellIcon /> },
      { href: "/dashboard/profile", label: "Perfil", icon: <UserIcon /> },
    ];
  }, [role]);

  return (
    <>
      <header className="mb-8 premium-panel-strong px-4 py-3 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BrandLogo href="/dashboard" imgClassName="h-12 w-auto md:h-[3.5rem]" />

          <div className="flex items-center gap-2 md:gap-3">
            <Link
              href="/buscar"
              className="hidden rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-[#d6e2f5] transition hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/50 hover:bg-[var(--brand-accent)]/12 md:inline-flex"
            >
              Buscar
            </Link>

            {role === "ADMIN" && (
              <Link
                href="/admin/dashboard"
                className="rounded-xl border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 px-3 py-2 text-xs font-semibold text-[#ffd0bd] transition hover:-translate-y-0.5 hover:bg-[var(--brand-accent)]/20"
              >
                Admin
              </Link>
            )}

            {showNotifications && (
              <Link
                href="/dashboard/notificaciones"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#d6e2f5] transition hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/45 hover:bg-[var(--brand-accent)]/12"
                aria-label="Ver notificaciones"
              >
                <BellIcon />
                {unread > 0 && (
                  <span
                    className={`absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff526e] px-1.5 text-[10px] font-bold text-white ${bounce ? "animate-badge-bounce" : ""}`}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            )}

            <span className="hidden rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-[#c5d0e3] md:inline-flex">
              {displayName}
            </span>
            <button type="button" onClick={onLogout} className="premium-btn-secondary px-3 py-2 text-xs md:text-sm">
              Cerrar sesión
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#a9b9d2]">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <span key={crumb.href} className="inline-flex items-center gap-2">
                  {index > 0 && <span className="text-[#6e809e]">/</span>}
                  {isLast ? (
                    <span className="font-semibold text-white">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="hover:text-white">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </div>

          {showBack && (
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                  return;
                }
                router.push("/dashboard");
              }}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#d6e2f5] transition hover:border-[var(--brand-accent)]/45 hover:bg-[var(--brand-accent)]/12"
            >
              Volver
            </button>
          )}
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[var(--dark)]/96 px-2 pb-2 pt-2 backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5 gap-1">
          {mobileItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex flex-col items-center justify-center rounded-xl px-2 py-2 text-[11px] transition ${
                    active
                      ? "border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/15 text-[#ffd0bd]"
                      : "border border-transparent bg-white/[0.03] text-[#9fb0ca]"
                  }`}
                >
                  <span className="mb-0.5 inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="h-20 md:hidden" />
    </>
  );
}

