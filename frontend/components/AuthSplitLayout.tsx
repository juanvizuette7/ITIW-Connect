import React from "react";
import { BrandLogo } from "./BrandLogo";

interface AuthSplitLayoutProps {
  leftTitle: string;
  leftDescription: string;
  benefits: string[];
  children: React.ReactNode;
}

export function AuthSplitLayout({ leftTitle, leftDescription, benefits, children }: AuthSplitLayoutProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-brand-bg">
      <div className="pointer-events-none absolute -left-20 top-16 h-80 w-80 rounded-full bg-[#e94560]/20 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#0f3460]/45 blur-3xl animate-float-fast" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#7f5cff]/12 blur-3xl animate-float-slow" />
      <div className="brand-grid pointer-events-none absolute inset-0 opacity-25" />

      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_15%_10%,rgba(233,69,96,0.24),transparent_35%),linear-gradient(160deg,#0f3460_0%,#0a1f3d_55%,#070f1d_100%)] px-7 py-10 lg:border-b-0 lg:border-r lg:px-16 lg:py-16">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />

          <div className="relative z-10 mx-auto max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e94560]/40 bg-[#e94560]/15 px-3 py-1 text-xs font-semibold tracking-wide text-[#ffc5cf]">
              Plataforma verificada en Colombia
            </div>

            <div className="mt-4">
              <BrandLogo href="/" imgClassName="h-20 w-auto md:h-24" />
            </div>

            <h1 className="mt-8 font-[var(--font-heading)] text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.04] text-white">
              {leftTitle}
            </h1>
            <p className="mt-5 max-w-lg text-[1.04rem] leading-relaxed text-[#d2ddf2]">{leftDescription}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <article className="rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
                <p className="text-xs text-[#92a3be]">Confianza</p>
                <p className="mt-1 text-sm font-semibold text-white">Perfiles validados</p>
              </article>
              <article className="rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
                <p className="text-xs text-[#92a3be]">Control</p>
                <p className="mt-1 text-sm font-semibold text-white">Escrow seguro</p>
              </article>
              <article className="rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
                <p className="text-xs text-[#92a3be]">Reputación</p>
                <p className="mt-1 text-sm font-semibold text-white">Calificaciones reales</p>
              </article>
            </div>

            <ul className="mt-8 space-y-3.5">
              {benefits.map((benefit, index) => (
                <li key={benefit} className="group flex items-start gap-3 rounded-lg border border-transparent bg-white/[0.03] px-3 py-2 text-sm text-[#dde6f7] transition hover:border-[#e94560]/30 hover:bg-white/[0.06]">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#e94560]/20 text-[11px] font-bold text-[#ffb7c4]">
                    {index + 1}
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-6 py-10 lg:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(233,69,96,0.18),transparent_36%)]" />
          <div className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-white/[0.06] p-1 shadow-[0_35px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <div className="rounded-[1.3rem] border border-white/10 bg-[#0d182b]/88 p-6 md:p-8">
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
