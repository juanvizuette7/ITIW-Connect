"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { showToast } from "@/lib/toast";

type AvailableRequest = {
  id: string;
  description: string;
  createdAt: string;
  category: {
    name: string;
  };
  _count: {
    quotes: number;
  };
};

type ProfileMeResponse = {
  name: string;
};

export default function SolicitudesDisponiblesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [requests, setRequests] = useState<AvailableRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [amountCop, setAmountCop] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadRequests(authToken: string) {
    const available = await apiRequest<AvailableRequest[]>("/requests/available", {
      method: "GET",
      token: authToken,
    });
    setRequests(available);
  }

  useEffect(() => {
    async function init() {
      const savedToken = getToken();
      const role = getRole();

      if (!savedToken || role !== "PROFESIONAL") {
        router.replace("/auth/login");
        return;
      }

      setToken(savedToken);

      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", {
          method: "GET",
          token: savedToken,
        });
        setUserName(profile.name);
        await loadRequests(savedToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar las solicitudes disponibles.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function onSubmitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !selectedRequestId) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest<{ message: string }>(`/requests/${selectedRequestId}/quotes`, {
        method: "POST",
        token,
        body: JSON.stringify({
          amountCop: Number(amountCop),
          estimatedHours: Number(estimatedHours),
          message,
        }),
      });

      setAmountCop("");
      setEstimatedHours("");
      setMessage("");
      setSelectedRequestId(null);
      setSuccess("Cotizacion enviada correctamente.");
      showToast({ message: "Presupuesto enviado", kind: "success" });
      await loadRequests(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar la cotización.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando solicitudes...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Solicitudes disponibles</h1>
        <p className="mt-2 text-brand-muted">Explora solicitudes activas y envia tu presupuesto.</p>

        {error && <p className="premium-error mt-4">{error}</p>}
        {success && (
          <div className="premium-success mt-4">
            <p>{success}</p>
            <Link href="/dashboard/mis-cotizaciones" className="mt-1 inline-block underline">
              Ir a mis cotizaciones
            </Link>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="mt-6 premium-panel p-5 text-center">
            <p className="text-brand-muted">No hay solicitudes activas por ahora. Te avisaremos cuando haya nuevas oportunidades.</p>
            <Link href="/dashboard" className="premium-btn-secondary mt-4 inline-block">
              Volver al dashboard
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {requests.map((request) => (
              <article key={request.id} className="premium-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-white">{request.category.name}</p>
                  <p className="text-xs text-[#aab3c7]">{request._count.quotes} cotizaciones</p>
                </div>

                <p className="mt-2 text-sm text-brand-muted">{request.description}</p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequestId(request.id);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="premium-btn-primary px-4 py-2 text-sm"
                  >
                    Cotizar
                  </button>

                  <Link href={`/dashboard/solicitud/${request.id}`} className="text-sm text-brand-accent hover:underline">
                    Ver detalle
                  </Link>
                </div>

                {selectedRequestId === request.id && (
                  <form className="mt-4 space-y-3" onSubmit={onSubmitQuote}>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        type="number"
                        min={1}
                        value={amountCop}
                        onChange={(event) => setAmountCop(event.target.value)}
                        placeholder="Monto en COP"
                        className="premium-input"
                        required
                      />
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={estimatedHours}
                        onChange={(event) => setEstimatedHours(event.target.value)}
                        placeholder="Horas estimadas"
                        className="premium-input"
                        required
                      />
                    </div>

                    <textarea
                      rows={3}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder="Describe tu propuesta de trabajo"
                      className="premium-input"
                      required
                    />

                    <button disabled={submitting} className="premium-btn-primary px-4 py-2 text-sm">
                      {submitting ? "Enviando..." : "Enviar cotización"}
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

