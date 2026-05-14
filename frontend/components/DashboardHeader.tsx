"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { LoadingDots } from "./LoadingDots";
import { InlineLoader } from "./LoadingScreen";
import { apiRequest } from "@/lib/api";
import { getRole, getToken } from "@/lib/auth";
import { getStoredProfilePhoto } from "@/lib/profilePhoto";

interface DashboardHeaderProps {
  userName?: string;
  userPhotoUrl?: string | null;
  onLogout: () => void;
  showNotifications?: boolean;
}

type UnreadCountResponse = {
  unread: number;
};

type NotificationType =
  | "SOLICITUD"
  | "PRESUPUESTO"
  | "MENSAJE"
  | "PAGO"
  | "CALIFICACION"
  | "BADGE"
  | "DISPUTA"
  | "SISTEMA";

type HeaderNotification = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  href?: string | null;
  targetUrl?: string | null;
};

type PaginatedNotificationsResponse = {
  data: HeaderNotification[];
};

type HeaderProfileResponse = {
  id: string;
  name: string;
  role: RoleType;
  clientProfile?: {
    name?: string | null;
    photoUrl?: string | null;
  } | null;
  professionalProfile?: {
    name?: string | null;
  } | null;
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

function typeLabel(type: NotificationType) {
  if (type === "SOLICITUD") return "Solicitud";
  if (type === "PRESUPUESTO") return "Cotización";
  if (type === "MENSAJE") return "Mensaje";
  if (type === "PAGO") return "Pago";
  if (type === "CALIFICACION") return "Calificación";
  if (type === "BADGE") return "Badge";
  if (type === "DISPUTA") return "Disputa";
  return "Sistema";
}

function relativeTime(dateValue: string) {
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(dateValue).getTime()) / 60_000);
  if (minutes < 1) return "hace unos segundos";
  if (minutes < 60) return `hace ${minutes} minuto${minutes === 1 ? "" : "s"}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hora${hours === 1 ? "" : "s"}`;

  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}

function resolveNotificationHref(item: Pick<HeaderNotification, "type" | "href" | "targetUrl" | "title" | "body">, role: RoleType) {
  const explicitHref = item.href || item.targetUrl;
  if (explicitHref?.startsWith("/")) return explicitHref;

  if (item.type === "SOLICITUD") return role === "PROFESIONAL" ? "/dashboard/solicitudes-disponibles" : "/dashboard/mis-solicitudes";
  if (item.type === "PRESUPUESTO") return role === "PROFESIONAL" ? "/dashboard/mis-cotizaciones" : "/dashboard/mis-solicitudes";
  if (item.type === "MENSAJE") return "/dashboard/mis-jobs";
  if (item.type === "PAGO") return "/dashboard/mis-jobs";
  if (item.type === "CALIFICACION") return "/dashboard/profile";
  if (item.type === "BADGE") return "/dashboard/profile";
  if (item.type === "DISPUTA") return "/dashboard/disputas";

  const text = `${item.title} ${item.body}`.toLowerCase();
  if (text.includes("perfil") || text.includes("cuenta")) return "/dashboard/profile";

  return "/dashboard/notificaciones";
}

export function DashboardHeader({ userName, userPhotoUrl, onLogout, showNotifications = true }: DashboardHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [bounce, setBounce] = useState(false);
  const [role, setRole] = useState<RoleType>(null);
  const [resolvedName, setResolvedName] = useState("");
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState<string | null>(null);
  const [photoIsValid, setPhotoIsValid] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const previousUnread = useRef(0);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const currentRole = getRole();
    const token = getToken();
    setRole(currentRole);

    if (!token) return;

    let mounted = true;

    const loadProfileShell = async () => {
      try {
        const profile = await apiRequest<HeaderProfileResponse>("/profile/me", {
          method: "GET",
          token,
        });

        if (!mounted) return;

        setRole(profile.role);
        setResolvedName(profile.name || profile.clientProfile?.name || profile.professionalProfile?.name || "");
        setResolvedPhotoUrl(profile.clientProfile?.photoUrl || getStoredProfilePhoto(profile.id) || null);
      } catch {
        if (mounted) {
          setResolvedName("");
          setResolvedPhotoUrl(null);
        }
      }
    };

    void loadProfileShell();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const nextPhotoUrl = userPhotoUrl?.trim() || resolvedPhotoUrl?.trim() || "";
    setPhotoIsValid(Boolean(nextPhotoUrl));
  }, [userPhotoUrl, resolvedPhotoUrl]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [notificationsOpen]);

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

  const loadHeaderNotifications = async () => {
    const token = getToken();
    if (!token) return;

    setNotificationsLoading(true);
    setNotificationsError(null);

    try {
      const response = await apiRequest<PaginatedNotificationsResponse>("/notifications?page=1&limit=6", {
        method: "GET",
        token,
      });

      setNotifications(response.data);
    } catch {
      setNotificationsError("No se pudieron cargar las notificaciones.");
    } finally {
      setNotificationsLoading(false);
    }
  };

  const openNotificationsPanel = () => {
    setNotificationsOpen((current) => {
      const next = !current;
      if (next) void loadHeaderNotifications();
      return next;
    });
  };

  const openNotification = async (notification: HeaderNotification) => {
    const token = getToken();
    const href = resolveNotificationHref(notification, role);

    setNotificationsOpen(false);

    if (token && !notification.isRead) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      );
      setUnread((current) => Math.max(0, current - 1));

      try {
        await apiRequest<{ message: string }>(`/notifications/${notification.id}/read`, {
          method: "PUT",
          token,
        });
      } catch {
        // La navegación no debe bloquearse si solo falla marcar como leída.
      }
    }

    router.push(href);
  };

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
  const displayName = userName?.trim() || resolvedName.trim() || "Bienvenido";
  const headerPhotoUrl = userPhotoUrl?.trim() || resolvedPhotoUrl?.trim() || "";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
              <div ref={notificationsRef} className="relative">
                <button
                  type="button"
                  onClick={openNotificationsPanel}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#d6e2f5] transition hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/45 hover:bg-[var(--brand-accent)]/12"
                  aria-label="Ver notificaciones"
                  aria-expanded={notificationsOpen}
                >
                  <BellIcon />
                  {unread > 0 && (
                    <span
                      className={`absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff526e] px-1.5 text-[10px] font-bold text-white ${bounce ? "animate-badge-bounce" : ""}`}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="fixed left-3 right-3 top-20 z-50 rounded-2xl border border-white/10 bg-[#0A0F1A]/98 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96">
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div>
                        <p className="font-[var(--font-heading)] text-base font-bold text-white">Notificaciones</p>
                        <p className="text-xs text-brand-muted">{unread > 0 ? `${unread} sin leer` : "Todo al día"}</p>
                      </div>
                      <Link
                        href="/dashboard/notificaciones"
                        onClick={() => setNotificationsOpen(false)}
                        className="rounded-lg border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/10 px-3 py-1.5 text-xs font-semibold text-[#ffd0bd] transition hover:bg-[var(--brand-accent)]/18"
                      >
                        Ver todas
                      </Link>
                    </div>

                    {notificationsLoading && <InlineLoader label="Cargando información..." />}
                    {notificationsError && <p className="rounded-xl border border-[#e94560]/35 bg-[#e94560]/12 p-3 text-sm text-[#ffc4ce]">{notificationsError}</p>}

                    {!notificationsLoading && !notificationsError && (
                      <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1 sm:max-h-96">
                        {notifications.length === 0 ? (
                          <p className="rounded-xl bg-white/[0.04] p-3 text-sm text-brand-muted">Aún no tienes notificaciones.</p>
                        ) : (
                          notifications.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => void openNotification(item)}
                              className={`w-full rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/45 hover:bg-[var(--brand-accent)]/10 ${
                                item.isRead ? "border-white/10 bg-white/[0.03]" : "border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#d7e2f4]">
                                  {typeLabel(item.type)}
                                </span>
                                <span className="text-[11px] text-[#8fa0b9]">{relativeTime(item.createdAt)}</span>
                              </div>
                              <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">{item.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-muted">{item.body}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Link
              href="/dashboard/profile"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-[#c5d0e3] transition hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/45 hover:bg-[var(--brand-accent)]/12 hover:text-white"
              aria-label="Abrir perfil"
            >
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/12 text-xs font-extrabold text-[#ffd0bd]">
                {headerPhotoUrl && photoIsValid ? (
                  <img
                    src={headerPhotoUrl}
                    alt={displayName}
                    loading="lazy"
                    onError={() => setPhotoIsValid(false)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials || "IC"
                )}
              </span>
              <span className="hidden max-w-40 truncate md:inline">{displayName}</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setLoggingOut(true);
                onLogout();
              }}
              disabled={loggingOut}
              className="premium-btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-70 md:text-sm"
            >
              {loggingOut ? <LoadingDots label="Cerrando" /> : "Cerrar sesión"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-white/10 pt-3 sm:items-center">
          <div className="min-w-0 flex flex-wrap items-center gap-2 text-xs text-[#a9b9d2]">
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
              className="ml-auto shrink-0 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#d6e2f5] transition hover:border-[var(--brand-accent)]/45 hover:bg-[var(--brand-accent)]/12"
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
