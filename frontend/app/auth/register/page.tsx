"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";
import { apiRequest } from "@/lib/api";

type Role = "CLIENTE" | "PROFESIONAL";

interface RegisterResponse {
  message: string;
  requiresVerification?: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "CLIENTE" as Role,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const data = await apiRequest<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });

      setMessage(data.message);
      setTimeout(() => {
        router.push(`/auth/verify-otp?email=${encodeURIComponent(form.email)}`);
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible registrarte.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      leftTitle="Empieza hoy en ITIW Connect"
      leftDescription="Construimos una red de servicios del hogar confiable, rapida y segura para toda Colombia."
      benefits={[
        "Registro gratis para clientes y profesionales.",
        "Validacion de cuentas y reputacion por calificaciones.",
        "Pagos protegidos y comunicacion centralizada.",
      ]}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-[#00C9A7]/35 bg-[#00C9A7]/12 px-3 py-1 text-xs font-semibold text-[#9bfde9]">
        Registro rápido
      </div>

      <h1 className="mt-4 font-[var(--font-heading)] text-4xl font-extrabold leading-none text-white md:text-[2.8rem]">
        Crear cuenta
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brand-muted">
        Completa tus datos para empezar a recibir o solicitar servicios con pagos seguros, reputacion verificable y
        seguimiento completo.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-1.5">
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, role: "CLIENTE" }))}
          className={`rounded-lg px-3 py-2.5 text-sm transition ${
            form.role === "CLIENTE"
              ? "bg-brand-accent text-white shadow-[0_12px_24px_rgba(233,69,96,0.25)]"
              : "bg-transparent text-brand-muted hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <span>👤</span>
            <span>Soy cliente</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, role: "PROFESIONAL" }))}
          className={`rounded-lg px-3 py-2.5 text-sm transition ${
            form.role === "PROFESIONAL"
              ? "bg-brand-accent text-white shadow-[0_12px_24px_rgba(233,69,96,0.25)]"
              : "bg-transparent text-brand-muted hover:bg-white/5 hover:text-white"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <span>🛠️</span>
            <span>Soy profesional</span>
          </span>
        </button>
      </div>

      <form className="mt-6 space-y-4.5" onSubmit={onSubmit}>
        <div>
          <label className="mb-1.5 block text-sm text-[#d5dded]">Nombre</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="premium-input"
            placeholder="Tu nombre completo"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[#d5dded]">Correo</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            className="premium-input"
            placeholder="nombre@correo.com"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[#d5dded]">Telefono</label>
          <input
            required
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            className="premium-input"
            placeholder="3001234567"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[#d5dded]">Contrasena</label>
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            className="premium-input"
            placeholder="Minimo 8 caracteres"
          />
        </div>

        {error && <p className="premium-error">{error}</p>}
        {message && <p className="premium-success">{message}</p>}

        <button disabled={loading} className="premium-btn-primary w-full">
          {loading ? "Creando cuenta..." : "Crear cuenta ->"}
        </button>
      </form>

      <p className="mt-5 text-sm text-brand-muted">
        Ya tienes cuenta?{" "}
        <Link href="/auth/login" className="font-medium text-brand-accent hover:underline">
          Inicia sesion
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
