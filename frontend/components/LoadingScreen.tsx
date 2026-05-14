import type { CSSProperties } from "react";

type LoadingScreenProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function LoadingCore({ compact = false }: { compact?: boolean }) {
  const particleClass = compact ? "loader-particle loader-particle-compact" : "loader-particle";

  return (
    <div className={`itiw-loader-core ${compact ? "itiw-loader-core-compact" : ""}`} aria-hidden="true">
      <span className="loader-orbit loader-orbit-one" />
      <span className="loader-orbit loader-orbit-two" />
      <span className="loader-orbit loader-orbit-three" />
      <span className="loader-center-glow" />
      <span className={particleClass} style={{ "--x": "-46px", "--y": "-34px", "--d": "0ms" } as CSSProperties} />
      <span className={particleClass} style={{ "--x": "44px", "--y": "-28px", "--d": "170ms" } as CSSProperties} />
      <span className={particleClass} style={{ "--x": "54px", "--y": "34px", "--d": "320ms" } as CSSProperties} />
      <span className={particleClass} style={{ "--x": "-38px", "--y": "42px", "--d": "490ms" } as CSSProperties} />
    </div>
  );
}

export function InlineLoader({ label = "Cargando información..." }: { label?: string }) {
  return (
    <div className="inline-loader-card">
      <LoadingCore compact />
      <span className="text-sm font-semibold text-white">{label}</span>
    </div>
  );
}

export function LoadingScreen({
  title = "Cargando información...",
  subtitle = "Espera un momento mientras terminamos de cargar los datos.",
  compact = false,
}: LoadingScreenProps) {
  if (compact) {
    return <InlineLoader label={title} />;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-6 sm:px-5 sm:py-8">
      <section className="loader-stage relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#0A0F1A]/88 p-6 shadow-[0_30px_110px_rgba(0,0,0,0.42)] backdrop-blur-xl md:p-10">
        <div className="loader-grid" aria-hidden="true" />
        <div className="loader-aurora loader-aurora-one" aria-hidden="true" />
        <div className="loader-aurora loader-aurora-two" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex min-h-[420px] max-w-3xl flex-col items-center justify-center text-center">
          <LoadingCore />

          <div className="mt-8 overflow-hidden">
            <h1 className="loader-title font-[var(--font-heading)] text-3xl font-extrabold text-white md:text-5xl">
              {title}
            </h1>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-brand-muted md:text-base">{subtitle}</p>

          <div className="mt-8 flex w-full max-w-md flex-col gap-3">
            <span className="loader-lightbar" />
            <div className="flex justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ffd0bd]/80">
              <span>Conectando</span>
              <span className="loader-text-pulse">datos</span>
              <span>seguros</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
