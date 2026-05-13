"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";
import { LoadingDots } from "@/components/LoadingDots";

type Category = {
  id: string;
  name: string;
};

type SearchProfessional = {
  id: string;
  name: string;
  bio: string | null;
  specialties: string[];
  hourlyRate: number;
  coverageRadiusKm: number;
  avgRating: number;
  reviewCount: number;
  totalJobs: number;
  verifiedBadge: boolean;
  badges: string[];
};

type PaginatedSearchResponse = {
  data: SearchProfessional[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ProfileMeResponse = {
  name: string;
};

function formatCop(value: number) {
  return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
}

function stars(value: number) {
  const total = Math.max(0, Math.min(5, Math.round(value)));
  if (total === 0) return "Sin calificaciones";
  return "★".repeat(total);
}

function SearchSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <article
          key={index}
          className="rounded-2xl border border-[#263245] bg-[#111827] p-4"
        >
          <div className="h-4 w-2/3 skeleton-shimmer rounded bg-white/10" />
          <div className="mt-3 h-3 w-full skeleton-shimmer rounded bg-white/10" />
          <div className="mt-2 h-3 w-4/5 skeleton-shimmer rounded bg-white/10" />
          <div className="mt-4 h-9 w-28 skeleton-shimmer rounded bg-white/10" />
        </article>
      ))}
    </div>
  );
}

export default function BuscarPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<SearchProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [ratingMin, setRatingMin] = useState("");
  const [coverageKm, setCoverageKm] = useState("");

  async function loadSearch(authToken: string, params: URLSearchParams, firstLoad = false) {
    if (firstLoad) setLoading(true);
    else setSearching(true);

    try {
      const response = await apiRequest<PaginatedSearchResponse>(`/buscar?${params.toString()}`, {
        method: "GET",
        token: authToken,
      });
      setItems(response.data);
      setTotal(response.total);
      setError(null);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "No fue posible buscar profesionales.");
    } finally {
      if (firstLoad) setLoading(false);
      else setSearching(false);
    }
  }

  useEffect(() => {
    const authToken = getToken();
    if (!authToken) {
      router.replace("/auth/login");
      return;
    }

    setToken(authToken);

    const init = async () => {
      try {
        const [profile, categoryList] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: authToken }),
          apiRequest<Category[]>("/categories", { method: "GET" }),
        ]);

        setUserName(profile.name);
        setCategories(categoryList);

        const initialParams = new URLSearchParams();
        initialParams.set("page", "1");
        initialParams.set("limit", "18");
        await loadSearch(authToken, initialParams, true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar la busqueda.");
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  useEffect(() => {
    if (!token) return;

    const handler = setTimeout(() => {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "18");
      if (query.trim()) params.set("q", query.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (ratingMin) params.set("ratingMin", ratingMin);
      if (coverageKm) params.set("coverageKm", coverageKm);
      void loadSearch(token, params);
    }, 300);

    return () => clearTimeout(handler);
  }, [token, query, categoryId, ratingMin, coverageKm]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  const hasFilters = useMemo(
    () => Boolean(query.trim() || categoryId || ratingMin || coverageKm),
    [query, categoryId, ratingMin, coverageKm],
  );

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
        <SearchSkeleton />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Buscar profesionales</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Filtra por nombre, especialidad, categoría, calificacion y radio de cobertura.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="premium-input"
            placeholder="Nombre o especialidad"
          />

          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="premium-input"
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id} className="bg-[#0f1f35] text-white">
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={ratingMin}
            onChange={(event) => setRatingMin(event.target.value)}
            className="premium-input"
          >
            <option value="">Calificacion minima</option>
            <option value="1">1 estrella</option>
            <option value="2">2 estrellas</option>
            <option value="3">3 estrellas</option>
            <option value="4">4 estrellas</option>
            <option value="5">5 estrellas</option>
          </select>

          <input
            type="number"
            min={1}
            value={coverageKm}
            onChange={(event) => setCoverageKm(event.target.value)}
            className="premium-input"
            placeholder="Cobertura minima (km)"
          />
        </div>

        {error && (
          <p className="premium-error mt-4">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#ff9bac]/60 text-xs">
                !
              </span>
              <span>{error}</span>
            </span>
          </p>
        )}

        <div className="mt-4 text-sm text-[#9cb0cd]">
          {searching ? <LoadingDots label="Buscando" /> : `Resultados: ${total}`}
        </div>

        <div className="mt-5">
          {searching ? (
            <SearchSkeleton />
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="text-brand-muted">
                No encontramos profesionales con esos filtros. Intenta con otros criterios.
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategoryId("");
                    setRatingMin("");
                    setCoverageKm("");
                  }}
                  className="premium-btn-secondary mt-4"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((professional) => (
                <article key={professional.id} className="premium-panel premium-hover-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-[var(--font-heading)] text-xl font-bold text-white">
                        {professional.name}
                      </p>
                      {professional.verifiedBadge && (
                        <span className="mt-1 inline-flex rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2 py-0.5 text-[11px] text-emerald-200">
                          Verificado
                        </span>
                      )}
                    </div>
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg">
                      {professional.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-[#f5c96a]">{stars(professional.avgRating)}</p>
                  <p className="mt-1 text-xs text-brand-muted">
                    {professional.avgRating.toFixed(1)} · {professional.reviewCount} resenas · {professional.totalJobs} trabajos
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {professional.specialties.slice(0, 4).map((specialty) => (
                      <span
                        key={`${professional.id}-${specialty}`}
                        className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-[#d5deee]"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 space-y-1 text-sm text-[#c6d3e8]">
                    <p>Tarifa: {formatCop(professional.hourlyRate)}</p>
                    <p>Cobertura: {professional.coverageRadiusKm} km</p>
                  </div>

                  <Link
                    href={`/dashboard/profesional/${professional.id}`}
                    className="premium-btn-primary mt-4 inline-flex px-4 py-2 text-sm"
                  >
                    Ver perfil
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}


