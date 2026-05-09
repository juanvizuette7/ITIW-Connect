"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";

type ProfileMeResponse = {
  name: string;
  role: "CLIENTE" | "PROFESIONAL" | "ADMIN";
};

type NpsMetric = {
  total: number;
  averageScore: number;
  nps: number;
  promoters: number;
  detractors: number;
};

type AdminStatsResponse = {
  totalProfessionalsActive: number;
  totalClients: number;
  requestsMonth: number;
  conversionRate: number;
  averageTicketCop: number;
  totalRevenueCop: number;
  npsAverage: number;
  npsClientes: NpsMetric;
  npsProfesionales: NpsMetric;
  requestsByWeek: Array<{
    label: string;
    value: number;
  }>;
};

function formatCop(value: number) {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function useCountUp(target: number, duration = 850) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const steps = 24;
    const increment = target / steps;
    const interval = Math.max(16, Math.floor(duration / steps));

    const timer = setInterval(() => {
      frame += 1;
      if (frame >= steps) {
        setValue(target);
        clearInterval(timer);
        return;
      }
      setValue((prev) => prev + increment);
    }, interval);

    return () => clearInterval(timer);
  }, [target, duration]);

  return value;
}

function Gauge({ title, metric }: { title: string; metric: NpsMetric }) {
  const targetProgress = Math.max(0, Math.min(100, ((metric.nps + 100) / 200) * 100));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(targetProgress);
    }, 60);

    return () => clearTimeout(timer);
  }, [targetProgress]);

  return (
    <article className="rounded-2xl border border-[#263245] bg-[#0A0F1A] p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 flex items-center gap-4">
        <div
          className="relative h-24 w-24 rounded-full transition-all duration-700 ease-out"
          style={{
            background: `conic-gradient(#e94560 ${progress}%, #1f2a3a ${progress}% 100%)`,
          }}
        >
          <div className="absolute inset-2 flex items-center justify-center rounded-full bg-[#0A0F1A]">
            <span className="text-lg font-bold text-[#7efbe7]">{metric.nps.toFixed(0)}</span>
          </div>
        </div>
        <div className="text-xs text-[#9db2cf]">
          <p>Promedio: {metric.averageScore.toFixed(2)}</p>
          <p>Total respuestas: {metric.total}</p>
          <p>Promotores: {metric.promoters}</p>
        </div>
      </div>
    </article>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);

  useEffect(() => {
    const authToken = getToken();
    if (!authToken) {
      router.replace("/auth/login");
      return;
    }

    setToken(authToken);

    const init = async () => {
      try {
        const me = await apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: authToken });
        if (me.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }

        setUserName(me.name);

        const statsResponse = await apiRequest<AdminStatsResponse>("/admin/stats", {
          method: "GET",
          token: authToken,
        });
        setStats(statsResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar metricas administrativas.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  const activeProsCount = useCountUp(stats?.totalProfessionalsActive || 0);
  const requestsMonthCount = useCountUp(stats?.requestsMonth || 0);
  const conversionRateCount = useCountUp(stats?.conversionRate || 0);
  const avgTicketCount = useCountUp(stats?.averageTicketCop || 0);
  const revenueCount = useCountUp(stats?.totalRevenueCop || 0);

  const conversionColor = useMemo(() => {
    const rate = stats?.conversionRate || 0;
    return rate >= 30 ? "text-emerald-300" : "text-amber-300";
  }, [stats]);
  const weekMax = useMemo(() => {
    const values = stats?.requestsByWeek?.map((item) => item.value) || [];
    return Math.max(1, ...values);
  }, [stats]);

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 text-brand-muted">Cargando panel admin...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Panel de administracion</h1>
            <p className="mt-2 text-sm text-brand-muted">Métricas reales y monitoreo de la beta cerrada.</p>
          </div>

          <Link href="/admin/profesionales" className="rounded-xl border border-[#e94560]/35 bg-[#e94560]/12 px-4 py-2 text-sm font-semibold text-[#7efbe7] transition hover:-translate-y-0.5 hover:bg-[#e94560]/20">
            Gestionar profesionales
          </Link>
        </div>

        {error && <p className="premium-error mt-4">{error}</p>}

        {stats && (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(233,69,96,0.18)]">
                <p className="text-sm text-[#9db2cf]">Profesionales activos</p>
                <p className="mt-2 text-3xl font-extrabold text-white">{Math.round(activeProsCount)}</p>
              </article>

              <article className="rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(233,69,96,0.18)]">
                <p className="text-sm text-[#9db2cf]">Solicitudes del mes</p>
                <p className="mt-2 text-3xl font-extrabold text-white">{Math.round(requestsMonthCount)}</p>
                <div className="mt-3 h-2 w-full rounded-full bg-[#132033]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#e94560] to-[#6df7e0]" style={{ width: `${Math.min(100, Math.max(8, stats.requestsMonth))}%` }} />
                </div>
              </article>

              <article className="rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(233,69,96,0.18)]">
                <p className="text-sm text-[#9db2cf]">Tasa de conversion</p>
                <p className={`mt-2 text-3xl font-extrabold ${conversionColor}`}>{conversionRateCount.toFixed(2)}%</p>
              </article>

              <article className="rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(233,69,96,0.18)]">
                <p className="text-sm text-[#9db2cf]">Ticket promedio</p>
                <p className="mt-2 text-3xl font-extrabold text-white">{formatCop(avgTicketCount)}</p>
              </article>

              <article className="rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(233,69,96,0.18)]">
                <p className="text-sm text-[#9db2cf]">Ingresos ITIW (comisiones)</p>
                <p className="mt-2 text-3xl font-extrabold text-white">{formatCop(revenueCount)}</p>
              </article>

              <article className="rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5 transition hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(233,69,96,0.18)]">
                <p className="text-sm text-[#9db2cf]">Total clientes</p>
                <p className="mt-2 text-3xl font-extrabold text-white">{stats.totalClients}</p>
              </article>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Gauge title="NPS clientes" metric={stats.npsClientes} />
              <Gauge title="NPS profesionales" metric={stats.npsProfesionales} />
            </div>

            <article className="mt-6 rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5">
              <p className="text-sm font-semibold text-white">Solicitudes del mes (grafico semanal)</p>
              <div className="mt-4 grid grid-cols-5 gap-3">
                {stats.requestsByWeek.map((bucket, index) => {
                  const height = Math.max(10, Math.round((bucket.value / weekMax) * 100));

                  return (
                    <div key={bucket.label} className="flex flex-col items-center gap-2">
                      <div className="flex h-28 w-full items-end rounded-lg border border-[#233246] bg-[#101826] px-2">
                        <div
                          className="w-full rounded-md bg-gradient-to-t from-[#e94560] to-[#6df7e0] transition-all duration-700 ease-out"
                          style={{
                            height: `${height}%`,
                            transitionDelay: `${index * 80}ms`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-[#93a9c7]">{bucket.label}</p>
                      <p className="text-xs font-semibold text-[#dff8f3]">{bucket.value}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          </>
        )}
      </section>
    </main>
  );
}


