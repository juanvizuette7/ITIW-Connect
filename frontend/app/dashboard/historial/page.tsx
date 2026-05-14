"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { LoadingDots } from "@/components/LoadingDots";

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

type ReceiptResponse = {
  receipt: {
    receiptNumber: string;
    issuedAt: string;
    payment: {
      id: string;
      jobId: string;
      status: PaymentItem["status"];
      createdAt: string;
      amountCop: number;
      commissionCop: number | null;
      netProfessionalCop: number | null;
      clientVisibleTotalCop: number;
    };
    service: {
      requestId: string;
      category: string;
      description: string;
    };
    parties: {
      client: {
        name: string;
        email?: string;
      };
      professional: {
        name: string;
        email?: string;
      };
    };
    viewerRole: UserRole;
    note: string;
  };
  digitalSignature: {
    algorithm: string;
    payloadHash: string;
    signature: string;
    signedBy: string;
  };
};

function formatCop(value: number) {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatReceiptDate(value: string) {
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
  });
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
  const [exportingReceiptId, setExportingReceiptId] = useState<string | null>(null);
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
    router.push("/");
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
    const isClient = role === "CLIENTE";
    const headers = isClient
      ? ["Fecha", "Estado", "Categoría", "Descripción", "Total pagado", "Profesional"]
      : ["Fecha", "Estado", "Categoría", "Descripción", "Total cobrado", "Comisión plataforma", "Neto recibido", "Cliente"];

    const rows = items.map((item) =>
      isClient
        ? [
            new Date(item.createdAt).toLocaleString("es-CO"),
            item.status,
            item.request.category.name,
            item.request.description.replace(/\n/g, " "),
            item.amountCop.toString(),
            item.professional.name,
          ]
        : [
            new Date(item.createdAt).toLocaleString("es-CO"),
            item.status,
            item.request.category.name,
            item.request.description.replace(/\n/g, " "),
            item.amountCop.toString(),
            item.commissionCop.toString(),
            item.netProfessionalCop.toString(),
            item.client.name,
          ],
    );

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

  function buildReceiptHtml(response: ReceiptResponse) {
    const { receipt, digitalSignature } = response;
    const isClient = receipt.viewerRole === "CLIENTE";
    const safeDescription = escapeHtml(receipt.service.description).replace(/\n/g, "<br />");

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Recibo ${escapeHtml(receipt.receiptNumber)} - ITIW Connect</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 40px;
      background: #0A0F1A;
      color: #f8fafc;
      font-family: Arial, sans-serif;
    }
    .receipt {
      max-width: 820px;
      margin: 0 auto;
      border: 1px solid rgba(255, 107, 44, 0.28);
      border-radius: 24px;
      background: linear-gradient(145deg, #111827, #0D2137);
      overflow: hidden;
      box-shadow: 0 24px 70px rgba(0,0,0,0.42);
    }
    .header {
      padding: 30px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: radial-gradient(circle at top right, rgba(255,107,44,0.22), transparent 42%);
    }
    .brand { color: #FF6B2C; font-size: 14px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
    h1 { margin: 12px 0 6px; font-size: 34px; line-height: 1.05; }
    .muted { color: #a8b3c7; }
    .content { padding: 30px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .card {
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 18px;
      padding: 18px;
      background: rgba(255,255,255,0.035);
    }
    .label { color: #8892A4; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; }
    .value { margin-top: 7px; font-size: 16px; font-weight: 700; }
    .amount { color: #FF6B2C; font-size: 28px; }
    .signature {
      margin-top: 22px;
      border: 1px dashed rgba(255,107,44,0.45);
      border-radius: 18px;
      padding: 18px;
      background: rgba(255,107,44,0.08);
    }
    .hash {
      margin-top: 8px;
      color: #ffd0bd;
      font-family: Consolas, monospace;
      font-size: 11px;
      word-break: break-all;
    }
    .footer {
      padding: 20px 30px 30px;
      color: #a8b3c7;
      font-size: 12px;
    }
    @media (max-width: 640px) {
      body { padding: 16px; }
      .grid { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: #fff; color: #111827; padding: 0; }
      .receipt { box-shadow: none; border-color: #ddd; background: #fff; border-radius: 0; }
      .card, .signature { background: #fff; border-color: #ddd; }
      .muted, .label, .footer { color: #475569; }
      .hash { color: #92400e; }
    }
  </style>
</head>
<body>
  <main class="receipt">
    <section class="header">
      <div class="brand">ITIW Connect</div>
      <h1>Recibo firmado</h1>
      <p class="muted">Recibo No. ${escapeHtml(receipt.receiptNumber)} · Emitido ${escapeHtml(formatReceiptDate(receipt.issuedAt))}</p>
    </section>
    <section class="content">
      <div class="grid">
        <div class="card">
          <div class="label">Servicio</div>
          <div class="value">${escapeHtml(receipt.service.category)}</div>
          <p class="muted">${safeDescription}</p>
        </div>
        <div class="card">
          <div class="label">${isClient ? "Total pagado" : "Total cobrado"}</div>
          <div class="value amount">${escapeHtml(formatCop(receipt.payment.amountCop))}</div>
          <p class="muted">Estado: ${escapeHtml(receipt.payment.status)} · Fecha de pago: ${escapeHtml(formatReceiptDate(receipt.payment.createdAt))}</p>
        </div>
        <div class="card">
          <div class="label">Cliente</div>
          <div class="value">${escapeHtml(receipt.parties.client.name)}</div>
        </div>
        <div class="card">
          <div class="label">Profesional</div>
          <div class="value">${escapeHtml(receipt.parties.professional.name)}</div>
        </div>
        ${
          isClient
            ? ""
            : `<div class="card">
          <div class="label">Comisión ITIW</div>
          <div class="value">${escapeHtml(formatCop(receipt.payment.commissionCop || 0))}</div>
        </div>
        <div class="card">
          <div class="label">Neto profesional</div>
          <div class="value">${escapeHtml(formatCop(receipt.payment.netProfessionalCop || 0))}</div>
        </div>`
        }
      </div>
      <div class="signature">
        <div class="label">Firma digital</div>
        <div class="value">${escapeHtml(digitalSignature.signedBy)} · ${escapeHtml(digitalSignature.algorithm)}</div>
        <div class="hash">Hash: ${escapeHtml(digitalSignature.payloadHash)}</div>
        <div class="hash">Firma: ${escapeHtml(digitalSignature.signature)}</div>
      </div>
    </section>
    <footer class="footer">
      ${escapeHtml(receipt.note)} Este documento fue generado automáticamente desde datos reales registrados en ITIW Connect.
    </footer>
  </main>
</body>
</html>`;
  }

  async function exportSignedReceipt(paymentId: string) {
    if (!token) return;

    setExportingReceiptId(paymentId);
    setError(null);

    try {
      const response = await apiRequest<ReceiptResponse>(`/payments/${paymentId}/receipt`, {
        method: "GET",
        token,
      });

      const html = buildReceiptHtml(response);
      const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `recibo-${response.receipt.receiptNumber}.html`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible exportar el recibo firmado.");
    } finally {
      setExportingReceiptId(null);
    }
  }

  if (loading) {
    return <ScreenSkeleton />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Historial de transacciones</h1>
            <p className="mt-2 text-sm text-[#94a3b8]">
              {role === "CLIENTE"
                ? "Consulta tus pagos realizados por servicio, con fecha, estado y profesional asignado."
                : "Consulta tus ingresos, descuentos de plataforma y neto recibido por servicio."}
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl bg-[#e94560] px-4 py-2 text-sm font-semibold text-[#06281f] transition hover:-translate-y-0.5 hover:bg-[#2fe0c2]"
          >
            Exportar CSV
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <input
            type="date"
            value={filters.fechaInicio}
            onChange={(event) => setFilters((current) => ({ ...current, fechaInicio: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none focus:border-[#e94560]"
          />
          <input
            type="date"
            value={filters.fechaFin}
            onChange={(event) => setFilters((current) => ({ ...current, fechaFin: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none focus:border-[#e94560]"
          />
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none focus:border-[#e94560]"
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">PENDIENTE</option>
            <option value="COMPLETADO">COMPLETADO</option>
            <option value="FALLIDO">FALLIDO</option>
            <option value="REEMBOLSADO">REEMBOLSADO</option>
          </select>
          <input
            type="number"
            placeholder="Monto mínimo"
            value={filters.montoMinimo}
            onChange={(event) => setFilters((current) => ({ ...current, montoMinimo: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none placeholder:text-[#94a3b8] focus:border-[#e94560]"
          />
          <input
            type="number"
            placeholder="Monto máximo"
            value={filters.montoMaximo}
            onChange={(event) => setFilters((current) => ({ ...current, montoMaximo: event.target.value }))}
            className="rounded-xl border border-[#334155] bg-[#0A0F1A] px-3 py-2 text-sm text-white outline-none placeholder:text-[#94a3b8] focus:border-[#e94560]"
          />
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={onApplyFilters}
            className="rounded-xl border border-[#e94560]/40 bg-[#e94560]/10 px-4 py-2 text-sm font-semibold text-[#7ff8e1] transition hover:-translate-y-0.5 hover:bg-[#e94560]/20"
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
                <div className={`mt-3 grid gap-2 text-sm text-[#cbd5e1] ${role === "CLIENTE" ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                  {role === "CLIENTE" ? (
                    <>
                      <p>Total pagado: {formatCop(item.amountCop)}</p>
                      <p>Profesional: {item.professional.name}</p>
                    </>
                  ) : (
                    <>
                      <p>Total cobrado: {formatCop(item.amountCop)}</p>
                      <p>Comisión plataforma: {formatCop(item.commissionCop)}</p>
                      <p>Neto recibido: {formatCop(item.netProfessionalCop)}</p>
                    </>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => void exportSignedReceipt(item.id)}
                    disabled={exportingReceiptId === item.id}
                    className="rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/10 px-3 py-2 text-xs font-semibold text-[#ffd0bd] transition hover:-translate-y-0.5 hover:bg-[var(--brand-accent)]/18 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {exportingReceiptId === item.id ? <LoadingDots label="Firmando" /> : "Exportar recibo firmado"}
                  </button>
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
              Página {currentPage} de {totalPages}
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
          <p className="mb-3 text-sm font-semibold text-[#dbe6ff]">
            {role === "CLIENTE" ? "Resumen de pagos" : "Totales del historial"}
          </p>
          <div className={`grid gap-3 ${role === "CLIENTE" ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
            <div className="rounded-xl border border-[#263245] bg-[#0A0F1A] p-4">
              <p className="text-xs text-[#9fb0c9]">{role === "CLIENTE" ? "Total pagado por servicios" : "Total cobrado"}</p>
              <p className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-white">{formatCop(animatedTotalPagado)}</p>
            </div>
            {role !== "CLIENTE" && (
              <>
                <div className="rounded-xl border border-[#263245] bg-[#0A0F1A] p-4">
                  <p className="text-xs text-[#9fb0c9]">Comisión plataforma</p>
                  <p className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-white">{formatCop(animatedTotalComisiones)}</p>
                </div>
                <div className="rounded-xl border border-[#263245] bg-[#0A0F1A] p-4">
                  <p className="text-xs text-[#9fb0c9]">Neto recibido</p>
                  <p className="mt-2 font-[var(--font-heading)] text-2xl font-bold text-white">{formatCop(animatedTotalNeto)}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

