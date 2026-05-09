"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken, UserRole } from "@/lib/auth";

type DisputeStatus = "ABIERTA" | "EN_REVISION" | "RESUELTA" | "CERRADA";

type DisputeItem = {
  id: string;
  jobId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  createdAt: string;
  job: {
    request: {
      description: string;
      category: {
        name: string;
      };
    };
  };
};

type ProfileMeResponse = {
  name: string;
  role: UserRole;
};

function statusClass(status: DisputeStatus) {
  if (status === "ABIERTA") return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  if (status === "EN_REVISION") return "border-amber-500/40 bg-amber-500/15 text-amber-200";
  if (status === "RESUELTA") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
  return "border-slate-500/40 bg-slate-500/15 text-slate-200";
}

export default function DisputasPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DisputeItem[]>([]);

  useEffect(() => {
    const authToken = getToken();
    if (!authToken) {
      router.replace("/auth/login");
      return;
    }
    setToken(authToken);

    const init = async () => {
      try {
        const [me, disputes] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: authToken }),
          apiRequest<DisputeItem[]>("/disputes", { method: "GET", token: authToken }),
        ]);
        setUserName(me.name);
        setRole(me.role);
        setItems(disputes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar las disputas.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-5 py-10 text-brand-muted">Cargando disputas...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Mis disputas</h1>
            <p className="mt-2 text-sm text-brand-muted">Seguimiento de casos abiertos, en revision o resueltos.</p>
          </div>
          {role === "ADMIN" && (
            <Link href="/dashboard/admin/disputas" className="premium-btn-secondary px-4 py-2 text-sm">
              Panel admin de disputas
            </Link>
          )}
        </div>

        {error && <p className="premium-error mt-4">{error}</p>}

        <div className="mt-6 space-y-3">
          {items.length === 0 ? (
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-brand-muted">
              Aún no tienes disputas registradas.
            </article>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/disputas/${item.id}`}
                className="block rounded-xl border border-[#263245] bg-[#0A0F1A] p-4 transition hover:-translate-y-0.5 hover:border-white/25"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.job.request.category.name}</p>
                    <p className="mt-1 text-xs text-[#8ea0b9]">{new Date(item.createdAt).toLocaleString("es-CO")}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#d5dded]">{item.reason}</p>
                <p className="mt-1 line-clamp-2 text-sm text-brand-muted">{item.description}</p>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}


