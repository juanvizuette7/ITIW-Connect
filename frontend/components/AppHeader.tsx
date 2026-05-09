import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a1628]/78 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <BrandLogo href="/" imgClassName="h-12 w-auto md:h-[3.45rem]" />
        <nav className="hidden items-center gap-6 text-sm text-[#c5d0e3] md:flex">
          <a href="#como-funciona" className="transition hover:text-white">
            Cómo funciona
          </a>
          <a href="#beneficios" className="transition hover:text-white">
            Beneficios
          </a>
          <Link href="/buscar" className="transition hover:text-white">
            Buscar
          </Link>
          <Link href="/auth/login" className="transition hover:text-white">
            Iniciar sesión
          </Link>
          <Link href="/auth/register" className="premium-btn-primary brand-shine px-4 py-2 text-sm">
            Registrarse
          </Link>
        </nav>
      </div>
    </header>
  );
}
