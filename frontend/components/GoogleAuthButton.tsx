"use client";

import { useState } from "react";
import { getApiUrl } from "@/lib/api";
import { LoadingDots } from "@/components/LoadingDots";

type GoogleAuthButtonProps = {
  onError: (message: string) => void;
  role?: "CLIENTE" | "PROFESIONAL";
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-1.4 3.5-5.5 3.5a6.1 6.1 0 1 1 0-12.2c2.3 0 3.8 1 4.7 1.9l3.2-3.1C17.8 2.2 15.1 1 12 1 5.9 1 1 5.9 1 12s4.9 11 11 11c6.3 0 10.4-4.4 10.4-10.6 0-.7-.1-1.2-.2-1.7H12Z" />
      <path fill="#34A853" d="M1 7.5 4.7 10A6.6 6.6 0 0 1 12 5.4c2.3 0 3.8 1 4.7 1.8l3.2-3.1A11 11 0 0 0 1 7.5Z" />
      <path fill="#4A90E2" d="M12 23c3 0 5.6-1 7.5-2.8l-3.5-2.8c-.9.7-2.2 1.2-4 1.2a6.6 6.6 0 0 1-6.2-4.5L2 17a11 11 0 0 0 10 6Z" />
      <path fill="#FBBC05" d="M1 12c0 1.8.4 3.5 1.1 5l3.8-2.9a6.6 6.6 0 0 1 0-4.1L2 7A11 11 0 0 0 1 12Z" />
    </svg>
  );
}

export function GoogleAuthButton({ onError, role }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  function onClick() {
    setLoading(true);
    try {
      const apiBase = getApiUrl().replace(/\/api$/, "");
      const params = new URLSearchParams();
      if (role) params.set("role", role);
      const query = params.toString();
      window.location.href = `${apiBase}/api/auth/google${query ? `?${query}` : ""}`;
    } catch {
      setLoading(false);
      onError("No fue posible iniciar OAuth con Google.");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full rounded-xl border border-[#d6dce8] bg-white px-4 py-2.5 text-sm font-semibold text-[#1f2937] transition hover:-translate-y-0.5 hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="inline-flex items-center gap-2">
        <GoogleIcon />
        {loading ? <LoadingDots label="Conectando" /> : <span>{"Continuar con Google"}</span>}
      </span>
    </button>
  );
}
