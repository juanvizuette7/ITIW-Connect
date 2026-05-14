import type { UserRole } from "@/lib/auth";

type RoleIdentityBadgeProps = {
  role?: UserRole | null;
  compact?: boolean;
  className?: string;
};

const roleContent: Record<UserRole, { label: string; description: string; icon: string }> = {
  CLIENTE: {
    label: "Perfil Cliente",
    description: "Solicitas servicios, recibes cotizaciones y haces seguimiento seguro.",
    icon: "C",
  },
  PROFESIONAL: {
    label: "Perfil Profesional",
    description: "Cotizas solicitudes, gestionas trabajos y construyes reputación.",
    icon: "P",
  },
  ADMIN: {
    label: "Perfil Administrador",
    description: "Supervisas operaciones, profesionales y actividad de la plataforma.",
    icon: "A",
  },
};

function getRoleContent(role?: UserRole | null) {
  if (role && roleContent[role]) return roleContent[role];

  return {
    label: "Perfil de usuario",
    description: "Gestionas tu cuenta dentro de ITIW Connect.",
    icon: "U",
  };
}

export function RoleIdentityBadge({ role, compact = false, className = "" }: RoleIdentityBadgeProps) {
  const content = getRoleContent(role);

  return (
    <div
      className={`group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 px-3 py-2 shadow-[0_0_28px_rgba(255,107,44,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/55 hover:bg-[var(--brand-accent)]/14 hover:shadow-[0_0_32px_rgba(255,107,44,0.14)] ${compact ? "max-w-full" : "max-w-xl"} ${className}`}
    >
      <span className="pointer-events-none absolute inset-y-0 -left-10 w-20 rotate-12 bg-white/10 blur-2xl transition duration-500 group-hover:left-full" />
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--brand-accent)]/40 bg-[#0A0F1A]/75 font-[var(--font-heading)] text-sm font-extrabold text-[#ffd0bd] shadow-[0_0_18px_rgba(255,107,44,0.14)]">
        {content.icon}
      </span>
      <span className="relative min-w-0">
        <span className="block font-[var(--font-heading)] text-sm font-bold text-white">{content.label}</span>
        {!compact && (
          <span className="mt-0.5 block max-w-md text-xs leading-relaxed text-[#a9b7cf]">
            {content.description}
          </span>
        )}
      </span>
    </div>
  );
}
