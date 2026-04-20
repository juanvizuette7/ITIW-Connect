"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

type Category = {
  id: string;
  name: string;
  iconUrl: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const fallbackCategories: Category[] = [
  { id: "fallback-1", name: "Electricidad", iconUrl: null },
  { id: "fallback-2", name: "Plomeria", iconUrl: null },
  { id: "fallback-3", name: "Carpinteria", iconUrl: null },
  { id: "fallback-4", name: "Pintura", iconUrl: null },
  { id: "fallback-5", name: "Aires acondicionados", iconUrl: null },
  { id: "fallback-6", name: "Cerrajeria", iconUrl: null },
  { id: "fallback-7", name: "Reformas", iconUrl: null },
  { id: "fallback-8", name: "Jardineria", iconUrl: null },
  { id: "fallback-9", name: "Limpieza", iconUrl: null },
  { id: "fallback-10", name: "Mudanzas", iconUrl: null },
  { id: "fallback-11", name: "Fumigacion", iconUrl: null },
  { id: "fallback-12", name: "Impermeabilizacion", iconUrl: null },
  { id: "fallback-13", name: "Instalacion de pisos", iconUrl: null },
  { id: "fallback-14", name: "Techos y cubiertas", iconUrl: null },
  { id: "fallback-15", name: "Soldadura", iconUrl: null },
  { id: "fallback-16", name: "Vidrieria", iconUrl: null },
  { id: "fallback-17", name: "Alarmas y CCTV", iconUrl: null },
  { id: "fallback-18", name: "Electrodomesticos", iconUrl: null },
  { id: "fallback-19", name: "Otro", iconUrl: null },
];

const heroSteps = [
  {
    title: "Publica tu solicitud",
    description:
      "Selecciona una categoria general y explica tu problema con fotos y detalles para recibir mejores respuestas.",
  },
  {
    title: "Recibe cotizaciones",
    description:
      "Compara montos, tiempo estimado y experiencia del profesional desde un solo panel claro y ordenado.",
  },
  {
    title: "Paga con escrow",
    description:
      "Tu dinero se mantiene protegido y solo se libera cuando confirmas que el trabajo se completo correctamente.",
  },
];

const trustPoints = [
  "Perfiles con verificacion de identidad.",
  "Comunicacion centralizada dentro de la plataforma.",
  "Historial de solicitudes, cotizaciones y pagos seguros.",
];

const categoryEmojiMap: Record<string, string> = {
  electricidad: "⚡",
  plomeria: "🔧",
  carpinteria: "🪵",
  pintura: "🎨",
  "aires acondicionados": "❄️",
  cerrajeria: "🔐",
  reformas: "🏗️",
  jardineria: "🌿",
  limpieza: "🧼",
  mudanzas: "📦",
  fumigacion: "🛡️",
  impermeabilizacion: "🌧️",
  "instalacion de pisos": "🧱",
  "techos y cubiertas": "🏠",
  soldadura: "🔥",
  vidrieria: "🪟",
  "alarmas y cctv": "📹",
  electrodomesticos: "🔌",
  otro: "✨",
};

const categoryGlowPalette = [
  "from-cyan-400/20 via-sky-400/10 to-transparent",
  "from-fuchsia-400/20 via-rose-400/10 to-transparent",
  "from-emerald-400/20 via-teal-400/10 to-transparent",
  "from-amber-400/20 via-orange-400/10 to-transparent",
];

function normalizeCategoryName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function categoryInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function categoryEmoji(name: string) {
  return categoryEmojiMap[normalizeCategoryName(name)] || "🛠️";
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [usingFallbackCategories, setUsingFallbackCategories] = useState(false);
  const [failedIconIds, setFailedIconIds] = useState<Record<string, true>>({});

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch(`${API_URL}/categories`);
        if (!response.ok) {
          throw new Error("Categorias no disponibles");
        }

        const data = (await response.json()) as Category[];

        if (Array.isArray(data) && data.length > 0) {
          setCategories(data);
          setUsingFallbackCategories(false);
        } else {
          setCategories(fallbackCategories);
          setUsingFallbackCategories(true);
        }
      } catch {
        setCategories(fallbackCategories);
        setUsingFallbackCategories(true);
      } finally {
        setLoadingCategories(false);
      }
    }

    void loadCategories();
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".reveal-item");
    if (!targets.length) return;

    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            entry.target.classList.remove("reveal-pending");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );

    targets.forEach((target) => {
      if (!target.classList.contains("is-visible")) {
        target.classList.add("reveal-pending");
      }
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, [categories.length, loadingCategories]);

  const stats = useMemo(
    () => [
      "18 categorias disponibles",
      "Verificacion de identidad obligatoria",
      "Pagos 100% seguros con escrow",
    ],
    [],
  );

  const orderedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.name === "Otro") return 1;
      if (b.name === "Otro") return -1;
      return a.name.localeCompare(b.name, "es");
    });
  }, [categories]);

  function onIconError(categoryId: string) {
    setFailedIconIds((current) => ({ ...current, [categoryId]: true }));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-bg px-4 pb-14 pt-6 md:px-8 lg:px-12">
      <div className="brand-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#e94560]/20 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#0f3460]/55 blur-3xl animate-float-fast" />
      <div className="pointer-events-none absolute bottom-8 left-1/3 h-72 w-72 rounded-full bg-[#e94560]/10 blur-3xl animate-float-slow" />

      <div className="relative mx-auto max-w-7xl">
        <nav className="intro-reveal premium-panel-strong grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 md:px-5">
          <div className="inline-flex items-center gap-3">
            <BrandLogo href="/" imgClassName="h-12 w-auto md:h-16" />
            <div className="hidden md:block">
              <Link href="/" className="font-[var(--font-heading)] text-lg font-extrabold leading-none text-white">
                ITIW<span className="text-brand-accent">Connect</span>
              </Link>
              <p className="mt-1 text-xs text-brand-muted">Servicios del hogar en Colombia</p>
            </div>
          </div>

          <div className="hidden items-center justify-center gap-8 text-sm text-brand-muted md:flex">
            <a href="#como-funciona" className="transition hover:text-white">
              Como funciona
            </a>
            <a href="#categorias" className="transition hover:text-white">
              Categorias
            </a>
            <Link href="/buscar" className="transition hover:text-white">
              Buscar
            </Link>
            <Link href="/auth/login" className="transition hover:text-white">
              Iniciar sesion
            </Link>
          </div>

          <Link href="/auth/register" className="premium-btn-primary brand-shine px-4 py-2 text-sm">
            Registrarse
          </Link>
        </nav>

        <section className="mt-10 grid gap-8 lg:items-start lg:grid-cols-[1.1fr_0.9fr]">
          <div className="intro-reveal">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e94560]/40 bg-[#e94560]/15 px-3 py-1.5 text-xs font-medium text-[#ffc0ca]">
              Plataforma verificada en Colombia
            </div>

            <h1 className="mt-5 max-w-3xl font-[var(--font-heading)] text-[clamp(2.3rem,6vw,4.3rem)] font-extrabold leading-[1.03] text-white">
              Conecta con expertos de confianza en Colombia
            </h1>

            <p className="mt-5 max-w-2xl text-[1.06rem] text-brand-muted md:text-lg">
              Encuentra electricistas, plomeros, carpinteros y mas profesionales verificados cerca de ti. Publica tu
              solicitud en minutos, recibe varias cotizaciones y elige con informacion clara, sin improvisaciones.
            </p>

            <p className="mt-3 max-w-2xl text-sm text-[#b8c3d7] md:text-base">
              ITIW Connect organiza cada etapa del servicio: solicitud, cotizacion, pago seguro y seguimiento hasta la
              entrega final del trabajo.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/auth/login" className="premium-btn-primary brand-shine">
                Buscar profesional
              </Link>
              <Link href="/auth/register" className="premium-btn-secondary">
                Quiero ofrecer mis servicios
              </Link>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {stats.map((item) => (
                <div key={item} className="premium-panel reveal-item premium-hover-card p-4">
                  <p className="text-sm font-medium text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="intro-reveal premium-panel-strong relative self-start overflow-hidden p-6 md:p-7">
            <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-[#e94560]/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-[#0f3460]/40 blur-3xl" />

            <div className="relative z-10">
              <div className="inline-flex rounded-full border border-emerald-400/35 bg-emerald-400/15 px-3 py-1 text-xs text-emerald-200">
                Pago seguro en escrow
              </div>

              <h2 className="mt-4 font-[var(--font-heading)] text-2xl font-bold text-white md:text-[2rem]">
                Publica mejor, cotiza mejor
              </h2>
              <p className="mt-2 text-sm text-brand-muted">
                Una solicitud clara aumenta la calidad de cotizaciones. Te ayudamos a estructurar la informacion para
                que compares ofertas reales y tomes mejores decisiones.
              </p>

              <div id="como-funciona" className="mt-5 space-y-3">
                {heroSteps.map((step, index) => (
                  <article key={step.title} className="premium-panel reveal-item premium-hover-card p-4">
                    <p className="text-sm font-semibold text-white">
                      {index + 1}. {step.title}
                    </p>
                    <p className="mt-1 text-xs text-brand-muted">{step.description}</p>
                  </article>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-[#0a1628]/55 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#d6deee]">
                  Que ganas con ITIW Connect
                </p>
                <ul className="mt-3 space-y-2 text-sm text-brand-muted">
                  {trustPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#e94560]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </section>

        <section id="categorias" className="mt-12 reveal-item premium-panel-strong p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white md:text-3xl">
                Categorias generales de servicios
              </h2>
              <p className="mt-2 text-sm text-brand-muted md:text-base">
                Selecciona la categoria que mas se acerque al trabajo. Si no aplica, usa "Otro" y especifica el caso
                en la descripcion.
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-[#d5dded]">
              18 principales + Otro
            </span>
          </div>

          {usingFallbackCategories && (
            <p className="mt-3 text-xs text-[#ffb2bf]">
              Mostrando categorias base mientras se restablece la conexion con el backend.
            </p>
          )}

          {loadingCategories ? (
            <p className="mt-6 text-brand-muted">Cargando categorias...</p>
          ) : orderedCategories.length === 0 ? (
            <div className="mt-6 premium-panel p-6 text-center">
              <p className="text-brand-muted">Aun no hay categorias disponibles. Intenta nuevamente.</p>
              <Link href="/auth/register" className="premium-btn-primary mt-4 inline-block">
                Crear cuenta
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {orderedCategories.map((category, index) => {
                const emoji = categoryEmoji(category.name);
                const glowClass = categoryGlowPalette[index % categoryGlowPalette.length];

                return (
                <article
                  key={category.id}
                  className="premium-panel reveal-item premium-hover-card group relative flex items-center gap-3 overflow-hidden p-4"
                >
                  <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${glowClass} opacity-0 transition duration-300 group-hover:opacity-100`} />
                  <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/10 blur-2xl opacity-0 transition duration-300 group-hover:opacity-80" />

                  {category.iconUrl && !failedIconIds[category.id] ? (
                    <div className="relative z-10">
                      <img
                        src={category.iconUrl}
                        alt={category.name}
                        className="h-10 w-10 rounded-md object-cover ring-1 ring-white/20"
                        onError={() => onIconError(category.id)}
                      />
                      <span className="absolute -bottom-2 -right-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-[#0b1323]/90 text-[11px]">
                        {emoji}
                      </span>
                    </div>
                  ) : (
                    <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-[#0f3460]/78 text-lg shadow-[0_0_20px_rgba(15,52,96,0.35)]">
                      <span className="drop-shadow-[0_0_8px_rgba(233,69,96,0.35)]">{emoji}</span>
                    </div>
                  )}

                  <div className="relative z-10 min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{category.name}</p>
                    <p className="text-xs text-brand-muted transition group-hover:text-[#d9e3f7]">Categoria general · {categoryInitials(category.name)}</p>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-white/10 py-6 text-center text-sm text-brand-muted">
          ITIW Connect (c) 2026 - Conectando personas con expertos locales en Colombia
        </footer>
      </div>
    </main>
  );
}
