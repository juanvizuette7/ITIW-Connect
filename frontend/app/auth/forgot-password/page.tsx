"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

interface MessageResponse {
  message: string;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const data = await apiRequest<MessageResponse>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="premium-panel w-full max-w-lg p-6 shadow-glow md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Recuperar contrasena</h1>
        <p className="mt-3 text-sm text-brand-muted">
          Ingresa tu correo y te enviaremos un enlace seguro para crear una nueva contrasena.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1.5 block text-sm text-[#d5dded]">Correo electronico</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.com"
              className="premium-input"
            />
          </div>

          {error && <p className="premium-error">{error}</p>}
          {message && <p className="premium-success">{message}</p>}

          <button disabled={loading} className="premium-btn-primary w-full">
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <p className="mt-5 text-sm text-brand-muted">
          <Link href="/auth/login" className="text-brand-accent hover:underline">
            Volver al login
          </Link>
        </p>
      </section>
    </main>
  );
}
