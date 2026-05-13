type ScreenSkeletonProps = {
  variant?: "dashboard" | "list" | "profile" | "form";
};

function Block({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer ${className}`} />;
}

export function ScreenSkeleton({ variant = "dashboard" }: ScreenSkeletonProps) {
  const cardCount = variant === "list" ? 4 : 3;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <section className="premium-panel-strong p-5 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <Block className="h-16 w-32 rounded-2xl" />
          <Block className="hidden h-10 w-56 rounded-xl md:block" />
        </div>

        {variant === "profile" ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
            <div className="space-y-4">
              <Block className="h-28 w-28 rounded-full" />
              <Block className="h-8 w-2/3 rounded-xl" />
              <Block className="h-4 w-full rounded-lg" />
              <Block className="h-4 w-4/5 rounded-lg" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <Block className="h-4 w-40 rounded-lg" />
                  <Block className="mt-3 h-12 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ) : variant === "form" ? (
          <div className="mt-8 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <Block className="h-80 rounded-3xl" />
            <div className="space-y-4">
              <Block className="h-20 rounded-2xl" />
              <Block className="h-40 rounded-2xl" />
              <Block className="h-14 rounded-xl" />
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            <div className="space-y-3">
              <Block className="h-10 w-3/4 rounded-xl" />
              <Block className="h-5 w-full rounded-lg" />
              <Block className="h-5 w-5/6 rounded-lg" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: cardCount }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <Block className="h-10 w-10 rounded-xl" />
                  <Block className="mt-5 h-5 w-2/3 rounded-lg" />
                  <Block className="mt-3 h-4 w-full rounded-lg" />
                  <Block className="mt-2 h-4 w-4/5 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
