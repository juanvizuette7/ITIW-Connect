export function LoadingDots({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2 text-sm font-semibold">
      {label ? <span className="text-current">{label}</span> : null}
      <span className="inline-flex items-center gap-1.5" aria-hidden="true">
        <span className="loading-dot" />
        <span className="loading-dot [animation-delay:150ms]" />
        <span className="loading-dot [animation-delay:300ms]" />
      </span>
    </span>
  );
}
