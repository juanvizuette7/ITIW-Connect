"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession } from "@/lib/auth";

export default function OauthSuccessPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Validando autenticación...");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      setMessage("No se recibió token de autenticación.");
      setTimeout(() => router.replace("/auth/login"), 900);
      return;
    }

    saveSession(token);
    setMessage("Autenticacion completada. Redirigiendo...");
    setTimeout(() => router.replace("/dashboard"), 500);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
      <section className="premium-panel max-w-md p-6 text-center">
        <h1 className="font-[var(--font-heading)] text-2xl font-extrabold text-white">Acceso con Google</h1>
        <p className="mt-3 text-sm text-brand-muted">{message}</p>
      </section>
    </main>
  );
}
