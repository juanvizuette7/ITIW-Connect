"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

export function DashboardHeader({ userName, onLogout, showNotifications = true }: DashboardHeaderProps) {
  const displayName = userName?.trim() ? userName.trim() : "Bienvenido";
  const [unread, setUnread] = useState(0);
  const [bounce, setBounce] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const previousUnread = useRef(0);

  useEffect(() => {
    setIsAdmin(getRole() === "ADMIN");
  }, []);

  useEffect(() => {
    if (!showNotifications) {
      return;
    }

    const token = getToken();
    if (!token) {
      return;
    }

    let mounted = true;

    const loadUnread = async () => {
      try {
        const response = await apiRequest<UnreadCountResponse>("/notifications/unread-count", {
          method: "GET",
          token,
        });

        if (mounted) {
          if (response.unread > previousUnread.current) {
            setBounce(true);
            setTimeout(() => setBounce(false), 600);
          }
          previousUnread.current = response.unread;
          setUnread(response.unread);
        }
      } catch {
        if (mounted) {
          setUnread(0);
        }
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

  return (
    <header className="mb-8 premium-panel-strong px-4 py-2.5 md:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BrandLogo href="/dashboard" imgClassName="h-11 w-auto md:h-[3.25rem]" />

        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className="rounded-xl border border-[#00C9A7]/35 bg-[#00C9A7]/12 px-3 py-2 text-xs font-semibold text-[#82ffe8] transition hover:-translate-y-0.5 hover:bg-[#00C9A7]/20"
            >
              Admin
            </Link>
          )}

          {showNotifications && (
            <Link
              href="/dashboard/notificaciones"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#d6e2f5] transition hover:-translate-y-0.5 hover:bg-white/10"
              aria-label="Ver notificaciones"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" />
              </svg>
              {unread > 0 && (
                <span
                  className={`absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#e94560] px-1.5 text-[10px] font-bold text-white ${bounce ? "animate-badge-bounce" : ""}`}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          )}

          <span className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-[#c5d0e3]">
            {displayName}
          </span>
          <button type="button" onClick={onLogout} className="premium-btn-secondary px-4 py-2 text-sm">
            Cerrar sesion
          </button>
        </div>
      </div>
    </header>
  );
}
