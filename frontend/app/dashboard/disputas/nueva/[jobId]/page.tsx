"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken, UserRole } from "@/lib/auth";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";

type ProfileMeResponse = {
  name: string;
  role: UserRole;
};

type JobDetail = {
  id: string;
  status: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "CANCELADO";
  paymentStatus: "PENDIENTE" | "RETENIDO" | "LIBERADO" | "REEMBOLSADO";
  updatedAt: string;
  request: {
    category: {
      name: string;
    };
    description: string;
  };
};

type OpenDisputeResponse = {
  message: string;
  dispute: {
    id: string;
  };
};

const REASONS = [
  "Trabajo mal ejecutado",
  "Profesional no se presento",
  "Cobro incorrecto",
  "Otro",
] as const;

function timeLeftText(updatedAt: string) {
  const limit = new Date(updatedAt).getTime() + 72 * 60 * 60 * 1000;
  const diff = limit - Date.now();

  if (diff <= 0) {
    return "La ventana de 72 horas ya expiro para abrir disputa.";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `Tiempo restante para abrir disputa: ${hours}h ${minutes}min`;
}

export default function NuevaDisputaPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [description, setDescription] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const authToken = getToken();
    if (!authToken) {
      router.replace("/auth/login");
      return;
    }

    setToken(authToken);

    const init = async () => {
      try {
        const [me, jobDetail] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: authToken }),
          apiRequest<JobDetail>(`/jobs/${params.jobId}`, { method: "GET", token: authToken }),
        ]);

        setUserName(me.name);
        setJob(jobDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar la información del trabajo.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [params.jobId, router]);

  const canOpenDispute = useMemo(() => {
    if (!job) return false;

    const withinWindow = Date.now() - new Date(job.updatedAt).getTime() <= 72 * 60 * 60 * 1000;
    return job.status === "COMPLETADO" && job.paymentStatus === "LIBERADO" && withinWindow;
  }, [job]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !job) return;

    if (!reason || !description.trim() || description.trim().length < 20) {
      setError("Completa el motivo y una descripcion de al menos 20 caracteres.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!canOpenDispute) {
      setError("No puedes abrir disputa para este job en su estado actual.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<OpenDisputeResponse>(`/disputes/${job.id}`, {
        method: "POST",
        token,
        body: JSON.stringify({
          reason,
          description: description.trim(),
        }),
      });

      setMessage(response.message);
      setTimeout(() => {
        router.push(`/dashboard/disputas/${response.dispute.id}`);
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible abrir la disputa.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <ScreenSkeleton />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Abrir disputa</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Solo puedes abrir una disputa dentro de las 72 horas despues de completado el trabajo.
        </p>

        {job && (
          <article className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-[#d5dded]">
            <p><span className="text-brand-muted">Categoría:</span> {job.request.category.name}</p>
            <p className="mt-1"><span className="text-brand-muted">Descripcion:</span> {job.request.description}</p>
            <p className="mt-1 text-[#8ddfce]">{timeLeftText(job.updatedAt)}</p>
          </article>
        )}

        {error && <p className="premium-error mt-4">{error}</p>}
        {message && <p className="premium-success mt-4">{message}</p>}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm text-[#cfd7e7]">
            Motivo
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="premium-input mt-1"
              disabled={saving}
            >
              {REASONS.map((value) => (
                <option key={value} value={value} className="bg-[#111827]">
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-[#cfd7e7]">
            Descripcion detallada
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              maxLength={1200}
              className="premium-input mt-1 resize-none"
              placeholder="Explica lo ocurrido con detalle (minimo 20 caracteres)."
              disabled={saving}
            />
          </label>

          <div className="flex items-center justify-between text-xs text-brand-muted">
            <p>Minimo 20 caracteres para registrar la disputa.</p>
            <p>{description.trim().length}/1200</p>
          </div>

          <button
            type="submit"
            disabled={saving || !canOpenDispute}
            className={`rounded-xl bg-[#e94560] px-5 py-3 font-semibold text-[#052b22] transition hover:-translate-y-0.5 hover:bg-[#2fe0c2] disabled:cursor-not-allowed disabled:opacity-60 ${
              shake ? "animate-dispute-shake" : ""
            }`}
          >
            {saving ? "Abriendo disputa..." : "Abrir disputa"}
          </button>
        </form>
      </section>
    </main>
  );
}

