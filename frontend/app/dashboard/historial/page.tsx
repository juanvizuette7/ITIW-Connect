"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type PaymentItem = {
  id: string;
  jobId: string;
  status: "PENDIENTE" | "COMPLETADO" | "FALLIDO" | "REEMBOLSADO";
  amountCop: number;
  commissionCop: number;
  netProfessionalCop: number;
  createdAt: string;
  request: {
    id: string;
    description: string;
    category: {
      name: string;
    };
  };
  client: {
    name: string;
  };
  professional: {
    name: string;
  };
};

type PaymentHistoryResponse = {
  data: PaymentItem[];
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

type ProfileMeResponse = {
  name: string;
  role: UserRole;
};

function formatCop(value: number) {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function statusClass(status: PaymentItem["status"]) {
  if (status === "COMPLETADO") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
  if (status === "PENDIENTE") return "border-amber-500/40 bg-amber-500/15 text-amber-200";
  if (status === "REEMBOLSADO") return "border-slate-400/40 bg-slate-400/15 text-slate-200";
  return "border-rose-500/40 bg-rose-500/15 text-rose-200";
}

function useAnimatedNumber(value: number) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 850;
    const start = performance.now();
    const from = display;
    const delta = value - from;

    let animationId = 0;

    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + delta * eased);
      if (progress < 1) {
        animationId = requestAnimationFrame(frame);
      }
    };

    animationId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

export default function HistorialPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [totals, setTotals] = useState({ totalPagado: 0, totalComisiones: 0, totalNeto: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    fechaInicio: "",
    fechaFin: "",
    status: "",
    montoMinimo: "",
    montoMaximo: "",
  });

  const animatedTotalPagado = useAnimatedNumber(totals.totalPagado);
  const animatedTotalComisiones = useAnimatedNumber(totals.totalComisiones);
  const animatedTotalNeto = useAnimatedNumber(totals.totalNeto);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.fechaInicio) params.set("fechaInicio", filters.fechaInicio);
    if (filters.fechaFin) params.set("fechaFin", filters.fechaFin);
    if (filters.status) params.set("status", filters.status);
    if (filters.montoMinimo) params.set("montoMinimo", filters.montoMinimo);
    if (filters.montoMaximo) params.set("montoMaximo", filters.montoMaximo);
    const built = params.toString();
    return built ? `?${built}` : "";
  }, [filters]);

  async function loadHistory(authToken: string, query = "", page = 1) {
    const separator = query ? "&" : "?";
    const response = await apiRequest<PaymentHistoryResponse>(`/payments/history${query}${separator}page=${page}&limit=10`, {
      method: "GET",
      token: authToken,
    });
    setItems(response.data);
    setTotals(response.totals);
    setCurrentPage(response.page);
    setTotalPages(response.totalPages);
  }

  useEffect(() => {
    async function init() {
      const authToken = getToken();
      const savedRole = getRole();

      if (!authToken || !savedRole) {
        router.replace("/auth/login");
        return;
      }

      setToken(authToken);
      setRole(savedRole);

      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: authToken });
        setUserName(profile.name);
        await loadHistory(authToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el historial.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/auth/login");
  }

  async function onApplyFilters() {
    if (!token) return;
    setError(null);
    try {
      await loadHistory(token, queryString, 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible aplicar filtros.");
    }
  }

  async function onChangePage(nextPage: number) {
    if (!token) return;
    await loadHistory(token, queryString, nextPage);
  }

  function exportCsv() {
    const headers = [
      "Fecha",
      "Estado",
      "Categoria",
      "Descripcion",
      "Monto total",
      "Comision",
      "Neto",
      "Cliente",
      "Profesional",
    ];

    const rows = items.map((item) => [
      new Date(item.createdAt).toLocaleString("es-CO"),
      item.status,
      item.request.category.name,
      item.request.description.replace(/\n/g, " "),
      item.amountCop.toString(),
      item.commissionCop.toString(),
      item.netProfessionalCop.toString(),
      item.client.name,
      item.professional.name,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "historial-itiw-connect.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 text-brand-muted">Cargando historial...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Historial de transacciones</h1>
            <p className="mt-2 text-sm text-[#94a3b8]">Consulta pagos con filtros por fecha, estado y rango de monto.</p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl bg-[#00C9A7] px-4 py-2 text-sm font-semibold text-[#06281f] transition hover:-translate-y-0.5 hover:bg-[#2fe0c2]"
          >
            Exportar CSV
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <input
            type="date"
            value={filters.fechaInicio}
            onChange={(event) => setFilters((current) => ({ ...current, fechaInicio: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none focus:border-[#00C9A7]"
          />
          <input
            type="date"
            value={filters.fechaFin}
            onChange={(event) => setFilters((current) => ({ ...current, fechaFin: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none focus:border-[#00C9A7]"
          />
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none focus:border-[#00C9A7]"
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="COMPLETADO">COMPLETADO</option>
            <option value="FALLIDO">FALLIDO</option>
            <option value="REEMBOLSADO">REEMBOLSADO</option>
          </select>
          <input
            type="number"
            placeholder="Monto minimo"
            value={filters.montoMinimo}
            onChange={(event) => setFilters((current) => ({ ...current, montoMinimo: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none placeholder:text-[#94a3b8] focus:border-[#00C9A7]"
          />
          <input
            type="number"
            placeholder="Monto maximo"
            value={filters.montoMaximo}
            onChange={(event) => setFilters((current) => ({ ...current, montoMaximo: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none placeholder:text-[#94a3b8] focus:border-[#00C9A7]"
          />
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={onApplyFilters}
            className="rounded-xl border border-[#00C9A7]/40 bg-[#00C9A7]/10 px-4 py-2 text-sm font-semibold text-[#7ff8e1] transition hover:-translate-y-0.5 hover:bg-[#00C9A7]/20"
          >
            Aplicar filtros
          </button>
        </div>

        {error && <p className="mt-4 rounded-xl border border-[#e94560]/30 bg-[#e94560]/15 px-3 py-2 text-sm text-[#ff9bac]">{error}</p>}

        <div className="mt-6 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-[#94a3b8]">No hay transacciones para los filtros seleccionados.</p>
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-xl border border-[#263245] bg-[#0A0F1A] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.request.category.name}</p>
                    <p className="mt-1 text-xs text-[#8ea0b9]">{new Date(item.createdAt).toLocaleString("es-CO")}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <p className="mt-2 text-sm text-[#cbd5e1]">{item.request.description}</p>
                <div className="mt-3 grid gap-2 text-sm text-[#cbd5e1] md:grid-cols-3">
                  <p>Monto: {formatCop(item.amountCop)}</p>
                  <p>Comision: {formatCop(item.commissionCop)}</p>
                  <p>Neto: {formatCop(item.netProfessionalCop)}</p>
                </div>
              </article>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => void onChangePage(currentPage - 1)}
              className="premium-btn-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Anterior
            </button>
            <span className="text-brand-muted">
              Pagina {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => void onChangePage(currentPage + 1)}
              className="premium-btn-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Siguiente
            </button>
          </div>
        )}

        <div className="mt-6 border-t border-[#253245] pt-6">
          <p className="mb-3 text-sm font-semibold text-[#dbe6ff]">Totales del historial</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#263245] bg-[#0A0F1A] p-4">
              <p className="text-xs text-[#9fb0c9]">{role === "CLIENTE" ? "Total pagado" : "Total facturado"}</p>
              <p className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-white">{formatCop(animatedTotalPagado)}</p>
            </div>
            <div className="rounded-xl border border-[#263245] bg-[#0A0F1A] p-4">
              <p className="text-xs text-[#9fb0c9]">Total comisiones</p>
              <p className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-white">{formatCop(animatedTotalComisiones)}</p>
            </div>
            <div className="rounded-xl border border-[#263245] bg-[#0A0F1A] p-4">
              <p className="text-xs text-[#9fb0c9]">Total neto</p>
              <p className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-white">{formatCop(animatedTotalNeto)}</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
