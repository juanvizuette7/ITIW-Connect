import Link from "next/link";
import React from "react";

interface AuthSplitLayoutProps {
  leftTitle: string;
  leftDescription: string;
  benefits: string[];
  children: React.ReactNode;
}

export function AuthSplitLayout({ leftTitle, leftDescription, benefits, children }: AuthSplitLayoutProps) {
  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0f3460] via-[#0b2545] to-[#0a1628] px-7 py-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-14">
          <div className="absolute -left-16 top-20 h-52 w-52 rounded-full bg-[#e94560]/20 blur-3xl" />
          <div className="absolute bottom-10 right-0 h-48 w-48 rounded-full bg-[#0f3460]/60 blur-3xl" />

          <div className="relative z-10 mx-auto max-w-md">
            <Link href="/" className="inline-flex text-lg font-bold text-white">
              ITIW<span className="text-brand-accent">Connect</span>
            </Link>

            <h1 className="mt-8 font-[var(--font-heading)] text-4xl font-extrabold leading-tight text-white lg:text-5xl">
              {leftTitle}
            </h1>
            <p className="mt-4 text-base text-[#c5d0e3]">{leftDescription}</p>

            <ul className="mt-8 space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-[#dde6f7]">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-accent" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 lg:px-14">
          <div className="w-full max-w-md premium-panel p-6 shadow-glow md:p-8">{children}</div>
        </section>
      </div>
    </main>
  );
}
