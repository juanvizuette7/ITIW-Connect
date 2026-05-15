"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { showToast } from "@/lib/toast";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";

type JobDetail = {
  id: string;
  status: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "CANCELADO";
  paymentStatus: "PENDIENTE" | "RETENIDO" | "LIBERADO" | "REEMBOLSADO";
  request: {
    description: string;
    category: {
      name: string;
    };
  };
  professional: {
    id: string;
    name: string;
  };
  client: {
    name: string;
  };
  hasReviewedProfessional: boolean;
  hasReviewedClient: boolean;
};

type ProfileMeResponse = {
  name: string;
  role: UserRole;
};

type ReviewPayload = {
  rating: number;
  subcategoryRatings: {
    puntualidad: number;
    calidad: number;
    comunicacion: number;
    limpieza: number;
  };
  comment: string;
};

function StarSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div>
      <p className="mb-2 text-sm text-[#cbd5e1]">{label}</p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((item) => {
          const selected = item <= active;
          return (
            <button
              key={`${label}-${item}`}
              type="button"
              onMouseEnter={() => setHover(item)}
              onMouseLeave={() => setHover(0)}
              onClick={() => onChange(item)}
              className={`text-2xl transition duration-200 ${selected ? "text-[#e94560] scale-110" : "text-slate-500 hover:text-[#6ef0d7]"}`}
              aria-label={`${item} estrellas`}
            >
              {"\u2605"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Confetti({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 40 }).map((_, index) => (
        <span
          key={index}
          className="absolute block h-3 w-2 rounded-sm"
          style={{
            left: `${(index * 2.5) % 100}%`,
            top: "-10%",
            backgroundColor: index % 2 === 0 ? "#e94560" : "#e94560",
            animation: `confetti-fall ${2 + (index % 6) * 0.35}s linear forwards`,
            animationDelay: `${(index % 10) * 0.08}s`,
            transform: `rotate(${(index * 37) % 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function CalificarJobPage() {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userName, setUserName] = useState("");
  const [job, setJob] = useState<JobDetail | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const [rating, setRating] = useState(0);
  const [subcategoryRatings, setSubcategoryRatings] = useState({
    puntualidad: 0,
    calidad: 0,
    comunicacion: 0,
    limpieza: 0,
  });
  const [comment, setComment] = useState("");

  useEffect(() => {
    async function init() {
      const token = getToken();
      const savedRole = getRole();

      if (!token || !savedRole) {
        router.replace("/auth/login");
        return;
      }

      try {
        const [profile, detail] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token }),
          apiRequest<JobDetail>(`/jobs/${params.jobId}`, { method: "GET", token }),
        ]);

        setUserName(profile.name);
        setRole(profile.role);
        setJob(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el formulario de calificación.");
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

  function updateSubcategory(key: keyof typeof subcategoryRatings, value: number) {
    setSubcategoryRatings((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();

    if (!token || !job || !role) {
      setError("Sesión inválida. Inicia sesión nuevamente.");
      return;
    }

    const hasAllSubcategories = Object.values(subcategoryRatings).every((value) => value >= 1 && value <= 5);

    if (rating < 1 || rating > 5) {
      setError("Debes seleccionar una calificación general entre 1 y 5 estrellas.");
      return;
    }

    if (!hasAllSubcategories) {
      setError("Debes calificar puntualidad, calidad, comunicación y limpieza.");
      return;
    }

    if (!comment.trim()) {
      setError("Escribe un comentario de tu experiencia.");
      return;
    }

    setSending(true);
    setError(null);
    setMessage(null);

    try {
      const endpoint = role === "CLIENTE" ? `/reviews/${job.id}/professional` : `/reviews/${job.id}/client`;

      const payload: ReviewPayload = {
        rating,
        subcategoryRatings,
        comment: comment.trim(),
      };

      const response = await apiRequest<{ message: string }>(endpoint, {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });

      setShowConfetti(true);
      setMessage(response.message || "Gracias por tu calificación.");
      showToast({ message: "Calificación enviada", kind: "success" });
      setTimeout(() => setShowConfetti(false), 2400);
      setTimeout(() => {
        router.push(role === "CLIENTE" ? `/dashboard/profesional/${job.professional.id}` : `/dashboard/job/${job.id}`);
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible enviar la calificación.");
    } finally {
      setSending(false);
    }
  }

  const remainingChars = 400 - comment.length;
  const targetName = role === "CLIENTE" ? job?.professional.name : job?.client.name;
  const alreadyReviewed = role === "CLIENTE" ? job?.hasReviewedProfessional ?? false : job?.hasReviewedClient ?? false;

  if (loading) {
    return <ScreenSkeleton />;
  }

  if (!job || !role) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">No encontramos el job para calificar.</main>;
  }

  if (job.status !== "COMPLETADO" || job.paymentStatus !== "LIBERADO") {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
        <DashboardHeader userName={userName} onLogout={onLogout} />
        <section className="rounded-2xl border border-[#2f3b4d] bg-[#111827] p-6 text-[#cbd5e1]">
          Solo puedes calificar cuando el job esté completado y con pago liberado.
        </section>
      </main>
    );
  }

  if (alreadyReviewed) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
        <DashboardHeader userName={userName} onLogout={onLogout} />
        <section className="rounded-2xl border border-[#2f3b4d] bg-[#111827] p-6 text-[#cbd5e1]">
          Ya registraste una calificación para este job.
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <Confetti show={showConfetti} />
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Calificar servicio</h1>
        <p className="mt-2 text-sm text-[#9ca3af]">
          Comparte tu experiencia con {targetName}. Tu opinión ayuda a mejorar la calidad de la plataforma.
        </p>
        <p className="mt-2 text-sm text-[#7f8da3]">
          {job.request.category.name}: {job.request.description}
        </p>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <StarSelector label="Calificación general" value={rating} onChange={setRating} />
          <StarSelector
            label="Puntualidad"
            value={subcategoryRatings.puntualidad}
            onChange={(value) => updateSubcategory("puntualidad", value)}
          />
          <StarSelector
            label="Calidad del trabajo"
            value={subcategoryRatings.calidad}
            onChange={(value) => updateSubcategory("calidad", value)}
          />
          <StarSelector
            label="Comunicación"
            value={subcategoryRatings.comunicacion}
            onChange={(value) => updateSubcategory("comunicacion", value)}
          />
          <StarSelector
            label="Limpieza"
            value={subcategoryRatings.limpieza}
            onChange={(value) => updateSubcategory("limpieza", value)}
          />

          <div>
            <label className="mb-2 block text-sm text-[#cbd5e1]">Comentario</label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value.slice(0, 400))}
              rows={5}
              maxLength={400}
              className="w-full rounded-xl border border-[#334155] bg-[#0A0F1A] px-4 py-3 text-white outline-none transition focus:border-[#e94560] focus:ring-2 focus:ring-[#e94560]/25"
              placeholder="Describe brevemente cómo fue el servicio."
            />
            <p className={`mt-1 text-xs ${remainingChars < 30 ? "text-[#fda4af]" : "text-[#94a3b8]"}`}>
              {remainingChars} caracteres restantes
            </p>
          </div>

          {error && <p className="premium-error">{error}</p>}
          {message && <p className="premium-success">{message}</p>}

          <button
            disabled={sending}
            className="premium-btn-primary px-5 py-3"
          >
            Enviar calificación
          </button>
        </form>
      </section>

      <style jsx global>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(120vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </main>
  );
}
