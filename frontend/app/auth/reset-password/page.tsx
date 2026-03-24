"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

interface MessageResponse {
  message: string;
}

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!token) {
      setError("El enlace de recuperacion no contiene token.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contrasenas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest<MessageResponse>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setMessage(data.message);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cambiar la contrasena.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="premium-panel w-full max-w-lg p-6 shadow-glow md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Nueva contrasena</h1>
        <p className="mt-3 text-sm text-brand-muted">Define una contrasena segura para recuperar el acceso.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1.5 block text-sm text-[#d5dded]">Nueva contrasena</label>
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 8 caracteres"
              className="premium-input"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[#d5dded]">Confirmar contrasena</label>
            <input
              required
              minLength={8}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contrasena"
              className="premium-input"
            />
          </div>

          {error && <p className="premium-error">{error}</p>}
          {message && <p className="premium-success">{message}</p>}

          <button disabled={loading} className="premium-btn-primary w-full">
            {loading ? "Actualizando..." : "Guardar contrasena"}
          </button>
        </form>

        <p className="mt-5 text-sm text-brand-muted">
          <Link href="/auth/login" className="text-brand-accent hover:underline">
            Ir a iniciar sesion
          </Link>
        </p>
      </section>
    </main>
  );
}
