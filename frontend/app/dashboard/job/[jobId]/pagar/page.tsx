"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

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
                color: "#8892a4",
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
      <p className="text-xs text-brand-muted">
        Usa la tarjeta de prueba 4242 4242 4242 4242.
      </p>
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
  const [success, setSuccess] = useState<string | null>(null);

  const subtotal = Math.round(job.amountCop);
  const commission = Math.round(subtotal * 0.1);
  const total = subtotal;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const create = await apiRequest<CreatePayResponse>(`/jobs/${job.id}/pay`, {
        method: "POST",
        token,
        body: JSON.stringify({ action: "create" }),
      });

      if (!isMockStripeKey) {
        if (!stripe || !elements) {
          throw new Error("Stripe no esta disponible en este momento.");
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

      setSuccess("Pago retenido en escrow correctamente.");
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
      <div className="premium-panel p-4">
        <p className="text-sm text-brand-muted">Subtotal</p>
        <p className="text-white">{formatCop(subtotal)}</p>
        <p className="mt-3 text-sm text-brand-muted">Comision ITIW Connect (10%)</p>
        <p className="text-white">{formatCop(commission)}</p>
        <p className="mt-3 text-sm text-brand-muted">Total</p>
        <p className="font-[var(--font-heading)] text-2xl font-bold text-white">{formatCop(total)}</p>
      </div>

      {isMockStripeKey ? <MockCardFields /> : <CardField />}

      <p className="text-sm text-brand-muted">
        Tu dinero queda protegido hasta que confirmes que el trabajo quedo bien.
      </p>

      {error && <p className="premium-error">{error}</p>}
      {success && <p className="premium-success">{success}</p>}

      <button disabled={loading} className="premium-btn-primary w-full">
        {loading ? "Procesando pago..." : `Pagar ${formatCop(total)} de forma segura`}
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

    init();
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
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Pagar job</h1>
        <p className="mt-2 text-brand-muted">{job.request.description}</p>

        {error && <p className="premium-error mt-4">{error}</p>}

        {!canPay ? (
          <p className="mt-6 text-emerald-300">Este job ya no tiene pagos pendientes.</p>
        ) : (
          <Elements stripe={stripePromise}>
            {token ? <PayForm token={token} job={job} onPaid={() => loadJob(token)} /> : null}
          </Elements>
        )}
      </section>
    </main>
  );
}
