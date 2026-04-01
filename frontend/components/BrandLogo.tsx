import Link from "next/link";

interface BrandLogoProps {
  href?: string;
  className?: string;
  imgClassName?: string;
}

export function BrandLogo({ href = "/", className = "", imgClassName = "h-12 w-auto md:h-14" }: BrandLogoProps) {
  return (
    <Link href={href} className={`group inline-flex items-center ${className}`.trim()}>
      <span className="inline-flex items-center rounded-xl border border-white/10 bg-black/25 px-1.5 py-1 shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition duration-300 group-hover:border-[#e94560]/55 group-hover:shadow-[0_14px_30px_rgba(233,69,96,0.2)]">
        <img
          src="/brand-logo.png"
          alt="ITIW Connect"
          className={`${imgClassName} drop-shadow-[0_0_18px_rgba(233,69,96,0.35)] transition duration-300 group-hover:scale-[1.02]`}
        />
      </span>
    </Link>
  );
}
