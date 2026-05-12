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

function stars(value: number) {
  const amount = Math.max(0, Math.min(5, Math.round(value)));
  return amount > 0 ? "★".repeat(amount) : "Sin calificaciones";
}

function badgeClass(type: string) {
  if (type === "VERIFICADO") return "border-emerald-400/40 bg-emerald-400/15 text-emerald-200";
  if (type === "TOP_RATED") return "border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/15 text-[#7cfce6]";
  if (type === "EXPERTO") return "border-amber-300/40 bg-amber-300/15 text-amber-200";
  return "border-sky-400/40 bg-sky-400/15 text-sky-200";
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
  const [activeTab, setActiveTab] = useState<"sobre" | "portafolio" | "resenas">("sobre");
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
          apiRequest<PaginatedReviewsResponse>(`/reviews/professional/${params.id}?page=1&limit=8`, {
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
    router.push("/");
  }

  const average = useMemo(() => (profile ? toNumber(profile.professionalProfile.avgRating) : 0), [profile]);
  const fee = useMemo(() => (profile ? toNumber(profile.professionalProfile.hourlyRate) : 0), [profile]);
  const yearsExp = useMemo(() => {
    if (!profile) return 0;
    return Math.max(1, Math.floor(profile.professionalProfile.totalJobs / 15));
  }, [profile]);

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

      <section className="premium-panel p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 text-2xl font-extrabold text-[#89ffe9]">
            {profile.professionalProfile.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">{profile.professionalProfile.name}</h1>
            {(profile.isIdentityVerified || profile.professionalProfile.verifiedBadge) && (
              <span className="mt-2 inline-flex rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                Verificado
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-[var(--border)] bg-[#0f1d2e] p-4">
            <p className="text-xs uppercase tracking-wide text-[#9cb0cd]">Calificación promedio</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-extrabold text-[var(--brand-accent)]">{average.toFixed(1)}</p>
            <p className="text-sm text-[#f5cf7a]">{stars(average)}</p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[#0f1d2e] p-4">
            <p className="text-xs uppercase tracking-wide text-[#9cb0cd]">Trabajos completados</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-extrabold text-[var(--brand-accent)]">{profile.professionalProfile.totalJobs}</p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[#0f1d2e] p-4">
            <p className="text-xs uppercase tracking-wide text-[#9cb0cd]">Años de experiencia</p>
            <p className="mt-2 font-[var(--font-heading)] text-3xl font-extrabold text-[var(--brand-accent)]">{yearsExp}</p>
            <p className="text-xs text-[#8ea3bf]">Estimado por historial</p>
          </article>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {profile.professionalProfile.badges.map((badge) => (
            <span
              key={badge}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(badge)}`}
              title={badge}
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("sobre")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "sobre" ? "bg-[var(--brand-accent)] text-[#2a1106]" : "text-[#c8d6eb] hover:bg-white/5"
            }`}
          >
            Sobre mí
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("portafolio")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "portafolio" ? "bg-[var(--brand-accent)] text-[#2a1106]" : "text-[#c8d6eb] hover:bg-white/5"
            }`}
          >
            Portafolio
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("resenas")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              activeTab === "resenas" ? "bg-[var(--brand-accent)] text-[#2a1106]" : "text-[#c8d6eb] hover:bg-white/5"
            }`}
          >
            Reseñas
          </button>
        </div>

        {activeTab === "sobre" && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-[#d6e1f4]">{profile.professionalProfile.bio || "Este profesional aún no agregó una biografía."}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-white">Especialidades</p>
              <div className="flex flex-wrap gap-2">
                {profile.professionalProfile.specialties.length === 0 ? (
                  <span className="text-sm text-brand-muted">Aún no registra especialidades.</span>
                ) : (
                  profile.professionalProfile.specialties.map((specialty) => (
                    <span key={specialty} className="rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 px-3 py-1 text-xs text-[#84ffe8]">
                      {specialty}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wide text-[#8ea3bf]">Tarifa por hora</p>
                <p className="mt-1 font-semibold text-white">{formatCop(fee)}</p>
              </article>
              <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wide text-[#8ea3bf]">Zona de cobertura</p>
                <p className="mt-1 font-semibold text-white">{profile.professionalProfile.coverageRadiusKm} km</p>
              </article>
            </div>
          </div>
        )}

        {activeTab === "portafolio" && (
          <div className="mt-5">
            {portfolioPhotos.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-brand-muted">
                Este profesional aún no tiene fotos en su portafolio.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {portfolioPhotos.map((photo) => (
                  <article key={photo.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                    <img src={photo.photoUrl} alt={photo.description || "Foto de portafolio"} className="h-48 w-full object-cover" />
                    {photo.description && <p className="px-3 py-2 text-xs text-[#d6e1f4]">{photo.description}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "resenas" && (
          <div className="mt-5 space-y-3">
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-brand-muted">
                Este profesional aún no tiene reseñas públicas.
              </div>
            ) : (
              reviews.map((review, index) => {
                const subcategories = safeSubcategoryRatings(review.subcategoryRatings);
                return (
                  <article
                    key={review.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4 opacity-0"
                    style={{
                      animation: "review-stagger 360ms ease forwards",
                      animationDelay: `${index * 75}ms`,
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-bold text-white">
                          {review.reviewer.name.slice(0, 1).toUpperCase()}
                        </span>
                        <p className="text-sm font-semibold text-white">{review.reviewer.name}</p>
                      </div>
                      <p className="text-xs text-[#8ea3bf]">{new Date(review.createdAt).toLocaleDateString("es-CO")}</p>
                    </div>
                    <p className="mt-2 text-sm text-[#f7d07c]">{stars(review.rating)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/12 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#d6e1f4]">Puntualidad {subcategories.puntualidad}/5</span>
                      <span className="rounded-full border border-white/12 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#d6e1f4]">Calidad {subcategories.calidad}/5</span>
                      <span className="rounded-full border border-white/12 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#d6e1f4]">Comunicación {subcategories.comunicacion}/5</span>
                      <span className="rounded-full border border-white/12 bg-white/[0.03] px-2 py-0.5 text-[11px] text-[#d6e1f4]">Limpieza {subcategories.limpieza}/5</span>
                    </div>
                    <p className="mt-3 text-sm text-[#c8d6eb]">{review.comment}</p>
                  </article>
                );
              })
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
                      `/reviews/professional/${params.id}?page=${reviewsPage - 1}&limit=8`,
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
                  Página {reviewsPage} de {reviewsTotalPages}
                </span>
                <button
                  type="button"
                  disabled={reviewsPage >= reviewsTotalPages}
                  onClick={async () => {
                    const token = getToken();
                    if (!token) return;
                    const response = await apiRequest<PaginatedReviewsResponse>(
                      `/reviews/professional/${params.id}?page=${reviewsPage + 1}&limit=8`,
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
          </div>
        )}
      </section>

      <style jsx global>{`
        @keyframes review-stagger {
          from {
            opacity: 0;
            transform: translateY(8px);
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

