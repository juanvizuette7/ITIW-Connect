export function ScreenSkeleton() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <section className="premium-panel-strong p-5 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="h-16 w-32 animate-pulse rounded-2xl bg-white/[0.06]" />
          <div className="hidden h-10 w-56 animate-pulse rounded-xl bg-white/[0.06] md:block" />
        </div>
        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.75fr]">
          <div className="space-y-4">
            <div className="h-10 w-3/4 animate-pulse rounded-xl bg-white/[0.07]" />
            <div className="h-5 w-full animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="h-5 w-5/6 animate-pulse rounded-lg bg-white/[0.05]" />
            <div className="grid gap-4 pt-4 sm:grid-cols-3">
              <div className="h-28 animate-pulse rounded-2xl bg-white/[0.055]" />
              <div className="h-28 animate-pulse rounded-2xl bg-white/[0.055]" />
              <div className="h-28 animate-pulse rounded-2xl bg-white/[0.055]" />
            </div>
          </div>
          <div className="h-72 animate-pulse rounded-3xl border border-white/10 bg-white/[0.045]" />
        </div>
      </section>
    </main>
  );
}
