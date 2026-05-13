"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { showToast } from "@/lib/toast";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";

 type JobDetail = {
  id: string;
  amountCop: number;
  paymentStatus: "PENDIENTE" | "RETENIDO" | "LIBERADO" | "REEMBOLSADO";
  request: {
    description: string;
  };
};

type ProfileMeResponse = {
  name: string;
};

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function EscrowSteps() {
  const steps = [
    { title: "Pago retenido", text: "El dinero queda protegido en escrow." },
    { title: "Trabajo ejecutado", text: "El profesional realiza el servicio." },
    { title: "Confirmas", text: "Validas que todo quedo bien." },
    { title: "Profesional cobra", text: "Liberamos el pago al finalizar." },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {steps.map((step, index) => (
        <article key={step.title} className="rounded-2xl border border-[var(--border)] bg-[#111827] p-4 transition duration-200 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(255,107,44,0.15)]">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-accent)] text-sm font-bold text-[#261006]">
            {index + 1}
          </span>
          <p className="mt-3 text-sm font-semibold text-white">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-brand-muted">{step.text}</p>
        </article>
      ))}
    </div>
  );
}

function PayForm({ token, job, onPaid }: { token: string; job: JobDetail; onPaid: () => void }) {
  const router = useRouter();
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = Math.round(job.amountCop);
  const commission = Math.round(service * 0.1);
  const total = service + commission;

  function formatCardNumber(value: string) {
    return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }

  function formatExpiry(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!holder.trim() || cardNumber.replace(/\s/g, "").length < 12 || expiry.length < 5 || cvc.length < 3) {
      setError("Completa los datos visuales de la tarjeta para simular el pago.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest<{ message: string }>(`/jobs/${job.id}/pay`, {
        method: "POST",
        token,
        body: JSON.stringify({ paymentMode: "simulado" }),
      });

      showToast({ message: response.message || "Pago procesado. Tu dinero esta seguro en escrow.", kind: "success" });
      onPaid();
      setTimeout(() => router.push(`/dashboard/job/${job.id}`), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible procesar el pago simulado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <EscrowSteps />

      <div className="rounded-2xl border border-[var(--border)] bg-[#111827] p-5">
        <p className="text-sm font-semibold text-white">Formulario visual de tarjeta</p>
        <p className="mt-1 text-sm text-brand-muted">No guardamos datos de tarjeta. Este MVP simula el pago y activa el escrow en la base de datos.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-white">Nombre en la tarjeta</span>
            <input className="premium-input" value={holder} onChange={(event) => setHolder(event.target.value)} placeholder="Ej: Carlos Mendoza" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-white">Numero de tarjeta</span>
            <input className="premium-input tracking-[0.18em]" inputMode="numeric" value={cardNumber} onChange={(event) => setCardNumber(formatCardNumber(event.target.value))} placeholder="4242 4242 4242 4242" />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-white">Fecha</span>
            <input className="premium-input" inputMode="numeric" value={expiry} onChange={(event) => setExpiry(formatExpiry(event.target.value))} placeholder="12/26" />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-white">CVC</span>
            <input className="premium-input" inputMode="numeric" value={cvc} onChange={(event) => setCvc(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="123" />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[#111827] p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-brand-muted">Servicio</span>
          <span className="text-white">{formatCop(service)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-brand-muted">Comision ITIW 10%</span>
          <span className="text-white">{formatCop(commission)}</span>
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-brand-muted">Total protegido</span>
            <span className="font-[var(--font-heading)] text-3xl font-bold text-[var(--brand-accent)]">{formatCop(total)}</span>
          </div>
        </div>
      </div>

      <p className="rounded-xl border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/10 px-4 py-3 text-sm text-orange-100">
        Tu dinero esta protegido hasta que confirmes que el trabajo quedo bien.
      </p>

      {error && <p className="premium-error">{error}</p>}

      <button disabled={loading} className="premium-btn-primary w-full py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-60">
        Pagar de forma segura
      </button>
    </form>
  );
}

export default function JobPayPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadJob(authToken: string) {
    const detail = await apiRequest<JobDetail>(`/jobs/${params.jobId}`, {
      method: "GET",
      token: authToken,
    });
    setJob(detail);
  }

  useEffect(() => {
    async function init() {
      const authToken = getToken();
      const role = getRole();

      if (!authToken || role !== "CLIENTE") {
        router.replace("/auth/login");
        return;
      }

      setToken(authToken);

      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", {
          method: "GET",
          token: authToken,
        });
        setUserName(profile.name);
        await loadJob(authToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el pago.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [params.jobId, router]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  const canPay = useMemo(() => job?.paymentStatus === "PENDIENTE", [job]);

  if (loading) {
    return <ScreenSkeleton />;
  }

  if (!job) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-5 py-10">
        <div className="premium-panel p-6">
          <p className="text-white">No encontramos el job.</p>
          <button onClick={() => router.back()} className="premium-btn-secondary mt-4">Volver</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <button onClick={() => router.back()} className="premium-btn-secondary mb-5 px-4 py-2 text-sm">
          Volver
        </button>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Pago seguro en escrow</h1>
        <p className="mt-2 max-w-3xl text-brand-muted">Completa el formulario visual para simular el pago. El sistema cambiara el estado a retenido y dejara el dinero protegido hasta tu confirmacion.</p>
        <p className="mt-4 rounded-2xl border border-white/10 bg-[#111827] p-4 text-sm text-brand-muted">{job.request.description}</p>

        {error && (
          <div className="mt-4 rounded-xl border border-[#e94560]/40 bg-[#e94560]/10 px-4 py-3 text-sm text-[#ff9aaa]">
            {error}
            <button onClick={() => token && loadJob(token)} className="ml-3 underline">Reintentar</button>
          </div>
        )}

        {!canPay ? (
          <p className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            Este job ya no tiene pagos pendientes.
          </p>
        ) : token ? (
          <PayForm token={token} job={job} onPaid={() => loadJob(token)} />
        ) : null}
      </section>
    </main>
  );
}
