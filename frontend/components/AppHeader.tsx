import Link from "next/link";

export function AppHeader() {
  return (
    <header className="border-b border-white/10 bg-[#0a1628]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="text-lg font-bold text-white">
          ITIW<span className="text-brand-accent">Connect</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-[#c5d0e3] md:flex">
          <a href="#como-funciona" className="hover:text-white">
            Como funciona
          </a>
          <a href="#beneficios" className="hover:text-white">
            Beneficios
          </a>
          <Link href="/auth/login" className="hover:text-white">
            Iniciar sesion
          </Link>
          <Link href="/auth/register" className="premium-btn-primary px-4 py-2 text-sm">
            Registrarse
          </Link>
        </nav>
      </div>
    </header>
  );
}
