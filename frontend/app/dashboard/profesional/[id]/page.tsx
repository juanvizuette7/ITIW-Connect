"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type ProfessionalPublicProfile = {
  id: string;
  isIdentityVerified: boolean;
  professionalProfile: {
    name: string;
    bio: string | null;
    specialties: string[];
    hourlyRate: string | number;
    coverageRadiusKm: number;
    avgRating: string | number;
    reviewCount: number;
    totalJobs: number;
    badges: string[];
    verifiedBadge: boolean;
  };
};

type ReviewItem = {
  id: string;
  rating: number;
  subcategoryRatings: {
    puntualidad: number;
    calidad: number;
    comunicacion: number;
    limpieza: number;
  } | null;
  comment: string;
  createdAt: string;
  reviewer: {
    id: string;
    name: string;
    role: "CLIENTE" | "PROFESIONAL";
  };
};

type PaginatedReviewsResponse = {
  data: ReviewItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ProfileMeResponse = {
  name: string;
};

type PortfolioPhoto = {
  id: string;
  photoUrl: string;
  description: string | null;
  createdAt: string;
};

type PortfolioResponse = {
  professional: {
    id: string;
    name: string;
  };
  total: number;
  photos: PortfolioPhoto[];
};

function formatCop(value: number) {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function badgeClass(type: string) {
  if (type === "VERIFICADO") return "border-emerald-400/40 bg-emerald-400/15 text-emerald-200";
  if (type === "TOP_RATED") return "border-[#00C9A7]/40 bg-[#00C9A7]/15 text-[#74fbe4]";
  if (type === "EXPERTO") return "border-amber-300/40 bg-amber-300/15 text-amber-200";
  return "border-sky-400/40 bg-sky-400/15 text-sky-200";
}

function badgeIconLabel(type: string) {
  if (type === "VERIFICADO") return "V";
  if (type === "TOP_RATED") return "T";
  if (type === "EXPERTO") return "E";
  return "N";
}

function stars(value: number) {
  return "\u2605".repeat(Math.max(0, Math.min(5, Math.round(value))));
}

function safeSubcategoryRatings(value: ReviewItem["subcategoryRatings"]) {
  return {
    puntualidad: Number(value?.puntualidad || 0),
    calidad: Number(value?.calidad || 0),
    comunicacion: Number(value?.comunicacion || 0),
    limpieza: Number(value?.limpieza || 0),
  };
}

export default function ProfessionalPublicPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [profile, setProfile] = useState<ProfessionalPublicProfile | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);
  const [portfolioPhotos, setPortfolioPhotos] = useState<PortfolioPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const token = getToken();
      if (!token) {
        router.replace("/auth/login");
        return;
      }

      try {
        const [me, professionalData, reviewsData, portfolioData] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token }),
          apiRequest<ProfessionalPublicProfile>(`/profile/professional/${params.id}`, { method: "GET", token }),
          apiRequest<PaginatedReviewsResponse>(`/reviews/professional/${params.id}?page=1&limit=12`, {
            method: "GET",
            token,
          }),
          apiRequest<PortfolioResponse>(`/portfolio/${params.id}`, { method: "GET", token }),
        ]);

        setUserName(me.name);
        setProfile(professionalData);
        setReviews(reviewsData.data);
        setReviewsPage(reviewsData.page);
        setReviewsTotalPages(reviewsData.totalPages);
        setPortfolioPhotos(portfolioData.photos);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar el perfil profesional.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [params.id, router]);

  function onLogout() {
    clearSession();
    router.push("/auth/login");
  }

  const average = useMemo(() => (profile ? toNumber(profile.professionalProfile.avgRating) : 0), [profile]);
  const fee = useMemo(() => (profile ? toNumber(profile.professionalProfile.hourlyRate) : 0), [profile]);

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando perfil profesional...</main>;
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">
        {error || "No encontramos el profesional."}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#334155] bg-[#0A0F1A] text-xl font-bold text-white">
                {profile.professionalProfile.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">
                  {profile.professionalProfile.name}
                </h1>
                {profile.isIdentityVerified && (
                  <span className="mt-1 inline-flex rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-200">
                    VERIFICADO
                  </span>
                )}
              </div>
            </div>

            <p className="mt-4 max-w-3xl text-sm text-[#9ca3af]">
              {profile.professionalProfile.bio || "Profesional registrado en ITIW Connect."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {profile.professionalProfile.badges.map((badge) => (
                <span
                  key={badge}
                  title={
                    badge === "VERIFICADO"
                      ? "Identidad validada por ITIW Connect."
                      : badge === "TOP_RATED"
                      ? "Mantiene calificaciones sobresalientes."
                      : badge === "EXPERTO"
                      ? "Alto volumen de trabajos completados."
                      : "Profesional nuevo con primeras entregas."
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-[0_0_18px_rgba(0,201,167,0.16)] ${badgeClass(badge)}`}
                >
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/20 text-[10px] font-bold">
                    {badgeIconLabel(badge)}
                  </span>
                  {badge}
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#cbd5e1]">
              <span className="rounded-lg border border-[#334155] bg-[#0A0F1A] px-3 py-1">
                Tarifa: {formatCop(fee)}
              </span>
              <span className="rounded-lg border border-[#334155] bg-[#0A0F1A] px-3 py-1">
                Cobertura: {profile.professionalProfile.coverageRadiusKm} km
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#263245] bg-[#0A0F1A] px-5 py-4 text-center md:min-w-[220px]">
            <p className="font-[var(--font-heading)] text-5xl font-extrabold text-white">{average.toFixed(1)}</p>
            <p className="mt-1 text-[#f0c15d]">{stars(average)}</p>
            <p className="mt-2 text-xs text-[#94a3b8]">
              {profile.professionalProfile.reviewCount} resenas - {profile.professionalProfile.totalJobs} trabajos
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold text-[#cbd5e1]">Especialidades</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.professionalProfile.specialties.length === 0 ? (
              <span className="text-sm text-[#94a3b8]">Aun no registra especialidades.</span>
            ) : (
              profile.professionalProfile.specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="rounded-full border border-[#334155] bg-[#0A0F1A] px-3 py-1 text-xs text-[#dbe6ff]"
                >
                  {specialty}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Portafolio</h2>
        <p className="mt-2 text-sm text-[#94a3b8]">Trabajos recientes del profesional.</p>

        {portfolioPhotos.length === 0 ? (
          <p className="mt-4 text-sm text-[#94a3b8]">Aun no hay fotos publicas en este portafolio.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
            {portfolioPhotos.map((photo, index) => (
              <article
                key={photo.id}
                className="overflow-hidden rounded-xl border border-[#283549] bg-[#0A0F1A] opacity-0"
                style={{
                  animation: "portfolio-public-fade-in 380ms ease forwards",
                  animationDelay: `${index * 70}ms`,
                }}
              >
                <img src={photo.photoUrl} alt={photo.description || "Foto de portafolio"} className="h-40 w-full object-cover" />
                {photo.description && <p className="px-2 py-2 text-xs text-[#d5dded]">{photo.description}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Resenas publicas</h2>
        <p className="mt-2 text-sm text-[#94a3b8]">Ordenadas de la mas reciente a la mas antigua.</p>

        {error && (
          <p className="mt-4 rounded-xl border border-[#e94560]/30 bg-[#e94560]/15 px-3 py-2 text-sm text-[#ff9bac]">
            {error}
          </p>
        )}

        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-[#94a3b8]">Este profesional aun no tiene resenas publicas.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {reviews.map((review, index) => {
              const subcategories = safeSubcategoryRatings(review.subcategoryRatings);

              return (
                <article
                  key={review.id}
                  className="rounded-xl border border-[#283549] bg-[#0A0F1A] p-4 opacity-0"
                  style={{
                    animation: "review-fade-in 420ms ease forwards",
                    animationDelay: `${index * 85}ms`,
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{review.reviewer.name}</p>
                    <p className="text-xs text-[#8ea0b9]">{new Date(review.createdAt).toLocaleDateString("es-CO")}</p>
                  </div>
                  <p className="mt-1 text-sm text-[#f0c15d]">
                    {stars(review.rating)} - {review.rating.toFixed(1)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#334155] bg-[#111827] px-2 py-0.5 text-[11px] text-[#d7e7ff]">
                      Puntualidad {subcategories.puntualidad}/5
                    </span>
                    <span className="rounded-full border border-[#334155] bg-[#111827] px-2 py-0.5 text-[11px] text-[#d7e7ff]">
                      Calidad {subcategories.calidad}/5
                    </span>
                    <span className="rounded-full border border-[#334155] bg-[#111827] px-2 py-0.5 text-[11px] text-[#d7e7ff]">
                      Comunicacion {subcategories.comunicacion}/5
                    </span>
                    <span className="rounded-full border border-[#334155] bg-[#111827] px-2 py-0.5 text-[11px] text-[#d7e7ff]">
                      Limpieza {subcategories.limpieza}/5
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-[#cbd5e1]">{review.comment}</p>
                </article>
              );
            })}
          </div>
        )}

        {reviewsTotalPages > 1 && (
          <div className="mt-6 flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              disabled={reviewsPage <= 1}
              onClick={async () => {
                const token = getToken();
                if (!token) return;
                const response = await apiRequest<PaginatedReviewsResponse>(
                  `/reviews/professional/${params.id}?page=${reviewsPage - 1}&limit=12`,
                  { method: "GET", token },
                );
                setReviews(response.data);
                setReviewsPage(response.page);
                setReviewsTotalPages(response.totalPages);
              }}
              className="premium-btn-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Anterior
            </button>
            <span className="text-brand-muted">
              Pagina {reviewsPage} de {reviewsTotalPages}
            </span>
            <button
              type="button"
              disabled={reviewsPage >= reviewsTotalPages}
              onClick={async () => {
                const token = getToken();
                if (!token) return;
                const response = await apiRequest<PaginatedReviewsResponse>(
                  `/reviews/professional/${params.id}?page=${reviewsPage + 1}&limit=12`,
                  { method: "GET", token },
                );
                setReviews(response.data);
                setReviewsPage(response.page);
                setReviewsTotalPages(response.totalPages);
              }}
              className="premium-btn-secondary px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      <style jsx global>{`
        @keyframes review-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes portfolio-public-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
