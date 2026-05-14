"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { LoadingDots } from "@/components/LoadingDots";

interface MessageResponse {
  message: string;
}

export default function VerifyOtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlEmail = params.get("email");
    if (urlEmail) {
      setEmail(urlEmail);
    }
  }, []);

  const otpCode = digits.join("");

  function onDigitChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (clean && index < 5) {
      refs.current[index + 1]?.focus();
    }
  }

  function onKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (otpCode.length !== 6) {
      setError("Ingresa el código completo de 6 dígitos.");
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest<MessageResponse>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otpCode }),
      });
      setMessage(data.message);
      setTimeout(() => router.push("/auth/login"), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible validar el código.");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setResending(true);
    setError(null);
    setMessage(null);

    try {
      const data = await apiRequest<MessageResponse>("/auth/resend-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible reenviar el código.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="premium-panel w-full max-w-lg p-6 text-center shadow-glow md:p-10">
        <h1 className="font-[var(--font-heading)] text-4xl font-extrabold text-white">Verificar OTP</h1>
        <p className="mt-3 text-brand-muted">Ingresa el código de seguridad enviado a tu correo.</p>

        <form className="mt-7 space-y-6" onSubmit={onVerify}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo asociado"
            className="premium-input text-center"
            required
          />

          <div className="flex justify-center gap-2 sm:gap-3">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  refs.current[index] = element;
                }}
                value={digit}
                onChange={(e) => onDigitChange(index, e.target.value)}
                onKeyDown={(e) => onKeyDown(index, e)}
                inputMode="numeric"
                maxLength={1}
                className={`h-[60px] w-[52px] rounded-xl border text-center font-[var(--font-heading)] text-3xl font-bold text-white outline-none transition ${
                  digit
                    ? "border-brand-accent bg-brand-accent/25"
                    : "border-white/15 bg-white/[0.04] focus:border-brand-accent"
                }`}
              />
            ))}
          </div>

          {error && <p className="premium-error text-left">{error}</p>}
          {message && <p className="premium-success text-left">{message}</p>}

          <button disabled={loading} className="premium-btn-primary w-full">
            {loading ? <LoadingDots label="Validando" /> : "Confirmar código"}
          </button>
        </form>

        <button
          type="button"
          onClick={onResend}
          disabled={resending}
          className="mt-5 text-sm font-medium text-brand-accent transition hover:underline disabled:opacity-60"
        >
          {resending ? <LoadingDots label="Reenviando" /> : "¿No llegó? Reenviar código"}
        </button>

        <p className="mt-5 text-sm text-brand-muted">
          <Link href="/auth/login" className="text-brand-accent hover:underline">
            Volver al login
          </Link>
        </p>
      </section>
    </main>
  );
}
