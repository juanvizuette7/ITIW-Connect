"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthSplitLayout } from "@/components/AuthSplitLayout";
import { apiRequest } from "@/lib/api";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

type Role = "CLIENTE" | "PROFESIONAL";

interface RegisterResponse {
  message: string;
  requiresVerification?: boolean;
}

function RoleIcon({ type }: { type: Role }) {
  if (type === "CLIENTE") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21a8 8 0 1 0-16 0" />
        <circle cx="12" cy="8" r="4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4" />
      <path d="m15 5 4 4" />
    </svg>
  );
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
      leftDescription="Construimos una red de servicios del hogar confiable, rápida y segura para toda Colombia."
      benefits={[
        "Registro gratis para clientes y profesionales.",
        "Validación de cuentas y reputación por calificaciones.",
        "Pagos protegidos y comunicación centralizada.",
      ]}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 px-3 py-1 text-xs font-semibold text-[#ffd0bd]">
        Registro rápido
      </div>

      <h1 className="mt-4 font-[var(--font-heading)] text-4xl font-extrabold leading-none text-white md:text-[2.8rem]">
        Crear cuenta
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brand-muted">
        Completa tus datos para solicitar servicios o crear tu perfil profesional con pagos seguros,
        reputación verificable y seguimiento completo.
      </p>

      <div className="mt-6 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 sm:grid-cols-2">
        {(["CLIENTE", "PROFESIONAL"] as Role[]).map((roleOption) => {
          const active = form.role === roleOption;
          return (
            <button
              key={roleOption}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, role: roleOption }))}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-brand-accent text-white shadow-[0_12px_28px_rgba(255,107,44,0.30)]"
                  : "bg-transparent text-[#aab7cd] hover:bg-white/6 hover:text-white"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <RoleIcon type={roleOption} />
                <span>{roleOption === "CLIENTE" ? "Soy cliente" : "Soy profesional"}</span>
              </span>
            </button>
          );
        })}
      </div>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
          <label className="mb-1.5 block text-sm text-[#d5dded]">Teléfono</label>
          <input
            required
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            className="premium-input"
            placeholder="3001234567"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[#d5dded]">Contraseña</label>
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            className="premium-input"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-[#7f8ca5]">
            <span className="h-px flex-1 bg-white/10" />
            <span>o continúa con Google</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <GoogleAuthButton onError={setError} role={form.role} />
        </div>

        {error && (
          <p className="premium-error">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#ff9bac]/60 text-xs">
                !
              </span>
              <span>{error}</span>
            </span>
          </p>
        )}
        {message && <p className="premium-success">{message}</p>}

        <button disabled={loading} className="premium-btn-primary w-full">
          Crear cuenta
        </button>
      </form>

      <p className="mt-5 text-sm text-brand-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/auth/login" className="font-medium text-brand-accent hover:underline">
          Inicia sesión
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
