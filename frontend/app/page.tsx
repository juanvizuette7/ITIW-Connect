"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  iconUrl: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const stats = [
  "18 categorias disponibles",
  "Verificacion de identidad obligatoria",
  "Pagos 100% seguros con escrow",
];

const howItWorks = [
  "1. Publica tu solicitud",
  "2. Recibe cotizaciones",
  "3. Paga seguro",
];

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch(`${API_URL}/categories`);
        const data = (await response.json()) as Category[];
        if (Array.isArray(data)) {
          setCategories(data.slice(0, 18));
        }
      } catch {
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    }

    void loadCategories();
  }, []);

  return (
    <main className="min-h-screen bg-brand-bg px-5 pb-12 pt-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <nav className="premium-panel flex items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="text-xl font-bold text-white">
            ITIW<span className="text-brand-accent">Connect</span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-brand-muted md:flex">
            <a href="#como-funciona" className="transition hover:text-white">
              Como funciona
            </a>
            <a href="#categorias" className="transition hover:text-white">
              Categorias
            </a>
            <Link href="/auth/login" className="transition hover:text-white">
              Iniciar sesion
            </Link>
          </div>

          <Link href="/auth/register" className="premium-btn-primary px-4 py-2 text-sm">
            Registrarse
          </Link>
        </nav>

        <section className="mt-10 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h1 className="mt-2 font-[var(--font-heading)] text-[clamp(2.1rem,5vw,3.3rem)] font-extrabold leading-tight text-white">
              Conecta con expertos de confianza en Colombia
            </h1>

            <p className="mt-5 max-w-2xl text-lg text-brand-muted">
              Encuentra electricistas, plomeros, carpinteros y mas profesionales verificados cerca de ti. Pagos
              seguros, calificaciones reales.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/auth/login" className="premium-btn-primary">
                Buscar profesional
              </Link>
              <Link href="/auth/register" className="premium-btn-secondary">
                Quiero ofrecer mis servicios
              </Link>
            </div>

            <div className="mt-9 grid max-w-3xl gap-3 md:grid-cols-3">
              {stats.map((item) => (
                <div key={item} className="premium-panel p-4 text-center transition duration-200 hover:-translate-y-0.5">
                  <p className="text-sm font-medium text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-panel p-6 shadow-glow md:p-8" id="como-funciona">
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Como funciona</h2>
            <div className="mt-5 space-y-3">
              {howItWorks.map((step) => (
                <div key={step} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[#d5dded]">
                  {step}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="categorias" className="mt-12 premium-panel p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Categorias de servicios</h2>
            <p className="text-sm text-brand-muted">Selecciona una categoria y recibe cotizaciones reales.</p>
          </div>

          {loadingCategories ? (
            <p className="mt-6 text-brand-muted">Cargando categorias...</p>
          ) : categories.length === 0 ? (
            <div className="mt-6 premium-panel p-5 text-center">
              <p className="text-brand-muted">Aun no hay categorias disponibles. Intenta nuevamente.</p>
              <Link href="/auth/register" className="premium-btn-primary mt-4 inline-block">
                Crear cuenta
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <div key={category.id} className="premium-panel flex items-center gap-3 p-4">
                  {category.iconUrl ? (
                    <img src={category.iconUrl} alt={category.name} className="h-8 w-8 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-primary text-xs font-bold text-white">
                      {category.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <p className="text-sm text-white">{category.name}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-white/10 py-6 text-center text-sm text-brand-muted">
          ITIW Connect © 2026 — Conectando personas con expertos locales en Colombia
        </footer>
      </div>
    </main>
  );
}
