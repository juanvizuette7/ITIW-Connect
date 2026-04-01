"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type Category = {
  id: string;
  name: string;
};

type ProfileMeResponse = {
  name: string;
};

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const savedToken = getToken();
      const role = getRole();

      if (!savedToken || role !== "CLIENTE") {
        router.replace("/auth/login");
        return;
      }

      setToken(savedToken);

      try {
        const [profile, categoryList] = await Promise.all([
          apiRequest<ProfileMeResponse>("/profile/me", { method: "GET", token: savedToken }),
          apiRequest<Category[]>("/categories", { method: "GET" }),
        ]);

        setUserName(profile.name);
        setCategories(categoryList);
        if (categoryList.length > 0) {
          setCategoryId(categoryList[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar la informacion inicial.");
      } finally {
        setInitialLoading(false);
      }
    }

    init();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/auth/login");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await apiRequest<{ message: string }>("/requests", {
        method: "POST",
        token,
        body: JSON.stringify({ categoryId, description }),
      });

      setDescription("");
      setMessage("\u00A1Solicitud creada! Los profesionales de tu zona ser\u00E1n notificados");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando formulario...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">Nueva solicitud</h1>
        <p className="mt-2 text-brand-muted">
          Selecciona una categoria general y describe el problema con detalle para recibir mejores cotizaciones.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1.5 block text-sm text-[#d5dded]">Categoria general</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="premium-input"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id} className="bg-[#0f1f35] text-white">
                  {category.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-brand-muted">
              Si tu caso no encaja exactamente, elige <strong>Otro</strong> y especifica todo en la descripcion.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[#d5dded]">Descripcion</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="premium-input"
              rows={5}
              required
              placeholder="Describe el problema, ubicacion y cualquier detalle clave del servicio"
            />
          </div>

          {error && <p className="premium-error">{error}</p>}
          {message && <p className="premium-success">{message}</p>}

          <button disabled={loading} className="premium-btn-primary">
            {loading ? "Creando solicitud..." : "Enviar solicitud"}
          </button>
        </form>

        <Link href="/dashboard/mis-solicitudes" className="mt-5 inline-block text-sm text-brand-accent hover:underline">
          Ver mis solicitudes
        </Link>
      </section>
    </main>
  );
}
