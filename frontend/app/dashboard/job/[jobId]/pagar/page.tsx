"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { showToast } from "@/lib/toast";

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

type CreatePayResponse = {
  clientSecret: string;
  paymentIntentId: string;
  amountCop: number;
  commissionCop: number;
  netProfessionalCop: number;
};

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : Promise.resolve(null);
const isMockStripeKey = publishableKey.includes("usa_esta_clave_publica");

function formatCop(value: number): string {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function CardField() {
  return (
    <div className="premium-input py-4">
      <CardElement
        options={{
          style: {
            base: {
              color: "#f6f8ff",
              iconColor: "#e94560",
              fontSize: "16px",
              "::placeholder": {
                color: "#8ca2c1",
              },
            },
          },
        }}
      />
    </div>
  );
}

function MockCardFields() {
  return (
    <div className="grid gap-3">
      <input className="premium-input" placeholder="4242 4242 4242 4242" />
      <div className="grid grid-cols-2 gap-3">
        <input className="premium-input" placeholder="12/26" />
        <input className="premium-input" placeholder="123" />
      </div>
      <p className="text-xs text-brand-muted">Usa la tarjeta de prueba 4242 4242 4242 4242.</p>
    </div>
  );
}

function EscrowSteps() {
  const steps = [
    "Pago retenido",
    "Trabajo ejecutado",
    "Confirmas",
    "Profesional cobra",
  ];

  return (
    <div className="grid gap-3 md:grid-cols-4">
      {steps.map((step, index) => (
        <article key={step} className="rounded-2xl border border-[var(--border)] bg-[#0f1d2e] p-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-accent)] text-sm font-bold text-[#032920]">
            {index + 1}
          </span>
          <p className="mt-2 text-sm font-semibold text-white">{step}</p>
        </article>
      ))}
    </div>
  );
}

function PayForm({
  token,
  job,
  onPaid,
}: {
  token: string;
  job: JobDetail;
  onPaid: () => void;
}) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = Math.round(job.amountCop);
  const commission = Math.round(service * 0.1);
  const total = service + commission;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const create = await apiRequest<CreatePayResponse>(`/jobs/${job.id}/pay`, {
        method: "POST",
        token,
        body: JSON.stringify({ action: "create" }),
      });

      if (!isMockStripeKey) {
        if (!stripe || !elements) {
          throw new Error("Stripe no está disponible en este momento.");
        }

        const card = elements.getElement(CardElement);
        if (!card) {
          throw new Error("No fue posible cargar el formulario de tarjeta.");
        }

        const confirmed = await stripe.confirmCardPayment(create.clientSecret, {
          payment_method: {
            card,
          },
        });

        if (confirmed.error) {
          throw new Error(confirmed.error.message || "El pago no fue confirmado por Stripe.");
        }
      }

      await apiRequest<{ message: string }>(`/jobs/${job.id}/pay`, {
        method: "POST",
        token,
        body: JSON.stringify({
          action: "confirm",
          paymentIntentId: create.paymentIntentId,
        }),
      });

      showToast({ message: "Pago procesado correctamente", kind: "success" });
      onPaid();
      setTimeout(() => router.push(`/dashboard/job/${job.id}`), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible procesar el pago.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <EscrowSteps />

      <div className="rounded-2xl border border-[var(--border)] bg-[#0f1d2e] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-brand-muted">Servicio</span>
          <span className="text-white">{formatCop(service)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-brand-muted">Comisión 10%</span>
          <span className="text-white">{formatCop(commission)}</span>
        </div>
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-brand-muted">Total</span>
            <span className="font-[var(--font-heading)] text-2xl font-bold text-[var(--brand-accent)]">{formatCop(total)}</span>
          </div>
        </div>
      </div>

      {isMockStripeKey ? <MockCardFields /> : <CardField />}

      <p className="rounded-xl border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 px-3 py-2 text-sm text-[#83ffe8]">
        Tu dinero está protegido hasta que confirmes que el trabajo quedó bien.
      </p>

      {error && <p className="premium-error">{error}</p>}

      <button disabled={loading} className="premium-btn-primary w-full py-3.5 text-base">
        {loading ? "Procesando pago..." : "Pagar de forma segura"}
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
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: authToken });
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
    router.push("/auth/login");
  }

  const canPay = useMemo(() => job?.paymentStatus === "PENDIENTE", [job]);

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando pago...</main>;
  }

  if (!job) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">No encontramos el job.</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Pago seguro en escrow</h1>
        <p className="mt-2 text-brand-muted">{job.request.description}</p>

        {error && <p className="premium-error mt-4">{error}</p>}

        {!canPay ? (
          <p className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            Este job ya no tiene pagos pendientes.
          </p>
        ) : (
          <Elements stripe={stripePromise}>
            {token ? <PayForm token={token} job={job} onPaid={() => loadJob(token)} /> : null}
          </Elements>
        )}
      </section>
    </main>
  );
}

