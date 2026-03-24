import React from "react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="premium-panel w-full max-w-xl p-8 shadow-glow">
      <h1 className="font-[var(--font-heading)] text-3xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-sm text-brand-muted">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
