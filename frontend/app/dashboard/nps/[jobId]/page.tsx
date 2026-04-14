"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";

type ProfileMeResponse = {
  name: string;
};

export default function NpsPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
        setUserName(me.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar la encuesta.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/auth/login");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) return;
    if (!score) {
      setError("Selecciona una calificacion entre 1 y 10.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<{ message: string }>(`/nps/${params.jobId}`, {
        method: "POST",
        token,
        body: JSON.stringify({ score, comment: comment.trim() }),
      });

      setMessage(response.message);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar la encuesta NPS.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando encuesta NPS...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Recomendarias ITIW Connect?</h1>
        <p className="mt-2 text-sm text-brand-muted">Selecciona un puntaje del 1 al 10 y comparte un comentario opcional.</p>

        {error && <p className="premium-error mt-4">{error}</p>}
        {message && <p className="premium-success mt-4">Gracias por tu feedback!</p>}

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {Array.from({ length: 10 }, (_, idx) => idx + 1).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScore(value)}
                className={`rounded-xl border px-0 py-3 text-sm font-bold transition ${
                  score === value
                    ? "border-[#00C9A7] bg-[#00C9A7]/20 text-[#8dfde8]"
                    : "border-white/15 bg-white/[0.03] text-[#d5dded] hover:-translate-y-0.5 hover:border-[#00C9A7]/40"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[#d5dded]">Comentario (opcional)</label>
            <textarea
              rows={4}
              maxLength={300}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="premium-input resize-none"
              placeholder="Comparte como fue tu experiencia."
            />
            <p className="mt-1 text-right text-xs text-brand-muted">{comment.length}/300</p>
          </div>

          <button disabled={saving} className="rounded-xl bg-[#00C9A7] px-5 py-3 font-semibold text-[#04271f] transition hover:-translate-y-0.5 hover:bg-[#36e4c6] disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </section>
    </main>
  );
}
