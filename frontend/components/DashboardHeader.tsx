import Link from "next/link";

interface DashboardHeaderProps {
  userName?: string;
  onLogout: () => void;
}

export function DashboardHeader({ userName, onLogout }: DashboardHeaderProps) {
  const displayName = userName?.trim() ? userName.trim() : "Bienvenido";

  return (
    <header className="mb-8 premium-panel px-5 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="text-xl font-bold text-white">
          ITIW<span className="text-brand-accent">Connect</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#c5d0e3]">
            {displayName}
          </span>
          <button type="button" onClick={onLogout} className="premium-btn-secondary px-4 py-2 text-sm">
            Cerrar sesion
          </button>
        </div>
      </div>
    </header>
  );
}
