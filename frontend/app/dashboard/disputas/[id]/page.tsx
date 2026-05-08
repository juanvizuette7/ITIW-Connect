"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken } from "@/lib/auth";

type DisputeDetail = {
  id: string;
  jobId: string;
  reason: string;
  description: string;
  status: "ABIERTA" | "EN_REVISION" | "RESUELTA" | "CERRADA";
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  job: {
    status: string;
    paymentStatus: string;
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
};

function statusClass(status: DisputeDetail["status"]) {
  if (status === "ABIERTA") return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  if (status === "EN_REVISION") return "border-amber-500/40 bg-amber-500/15 text-amber-200";
  if (status === "RESUELTA") return "border-emerald-500/40 bg-emerald-500/15 text-emerald-200";
  return "border-slate-500/40 bg-slate-500/15 text-slate-200";
}

export default function DisputaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispute, setDispute] = useState<DisputeDetail | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    const init = async () => {
      try {
        const [me, detail] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token }),
          apiRequest<DisputeDetail>(`/disputes/${params.id}`, { method: "GET", token }),
        ]);
        setUserName(me.name);
        setDispute(detail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar la disputa.");
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [params.id, router]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando detalle de disputa...</main>;
  }

  if (!dispute) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">{error || "No encontramos la disputa."}</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="rounded-2xl border border-[#1f2a3a] bg-[#111827] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Detalle de disputa</h1>
          <span className={`rounded-full border px-3 py-1 text-xs ${statusClass(dispute.status)}`}>{dispute.status}</span>
        </div>

        <div className="mt-6 space-y-3 text-sm text-[#d5dded]">
          <p><span className="text-brand-muted">ID:</span> {dispute.id}</p>
          <p><span className="text-brand-muted">Trabajo:</span> {dispute.job.request.category.name}</p>
          <p><span className="text-brand-muted">Motivo:</span> {dispute.reason}</p>
          <p><span className="text-brand-muted">Descripcion:</span> {dispute.description}</p>
          <p><span className="text-brand-muted">Solicitud:</span> {dispute.job.request.description}</p>
          <p><span className="text-brand-muted">Estado del pago:</span> {dispute.job.paymentStatus}</p>
          <p><span className="text-brand-muted">Creada:</span> {new Date(dispute.createdAt).toLocaleString("es-CO")}</p>
          <p><span className="text-brand-muted">Ultima actualizacion:</span> {new Date(dispute.updatedAt).toLocaleString("es-CO")}</p>
          <p><span className="text-brand-muted">Resolucion:</span> {dispute.resolution || "Aun sin resolucion"}</p>
        </div>
      </section>
    </main>
  );
}

