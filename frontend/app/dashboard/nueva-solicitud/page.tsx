"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { showToast } from "@/lib/toast";

type Category = { id: string; name: string; iconUrl?: string | null };
type ProfileMeResponse = { name: string };
type PhotoItem = { id: string; preview: string };
type LocationState = { lat: number; lng: number; accuracy: number; label: string };

const scheduleOptions = [
  { value: "MANANA", label: "Manana", detail: "6am - 12pm" },
  { value: "TARDE", label: "Tarde", detail: "12pm - 6pm" },
  { value: "NOCHE", label: "Noche", detail: "6pm - 10pm" },
];

const categoryIcons: Record<string, string> = {
  Electricidad: "⚡",
  Plomeria: "🚰",
  Carpinteria: "🪚",
  Pintura: "🎨",
  "Aires acondicionados": "❄️",
  Cerrajeria: "🔐",
  Reformas: "🏗️",
  Jardineria: "🌿",
  Limpieza: "✨",
  Mudanzas: "📦",
  Fumigacion: "🛡️",
  Impermeabilizacion: "☔",
  "Instalacion de pisos": "🧱",
  "Techos y cubiertas": "🏠",
  Soldadura: "🔥",
  Vidrieria: "🪟",
  "Alarmas y CCTV": "📹",
  Electrodomesticos: "🔌",
  Otro: "🧩",
};

function normalizeKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function todayForInput() {
  return new Date().toISOString().slice(0, 10);
}

function bytesFromDataUrl(value: string) {
  const base64 = value.includes(",") ? value.split(",").pop() || "" : value;
  return Math.ceil((base64.replace(/=+$/, "").length * 3) / 4);
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Solo puedes subir imagenes."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No fue posible leer la imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("La imagen no se pudo procesar."));
      img.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Tu navegador no pudo comprimir la imagen."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let output = canvas.toDataURL("image/jpeg", quality);
        while (bytesFromDataUrl(output) > 2 * 1024 * 1024 && quality > 0.45) {
          quality -= 0.08;
          output = canvas.toDataURL("image/jpeg", quality);
        }

        if (bytesFromDataUrl(output) > 2 * 1024 * 1024) {
          reject(new Error("La foto sigue pesando mas de 2 MB. Usa una imagen mas liviana."));
          return;
        }

        resolve(output);
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <path d="M9 8 10.5 5h3L15 8" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState(todayForInput());
  const [preferredSchedule, setPreferredSchedule] = useState("TARDE");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [locationLabel, setLocationLabel] = useState("Bogota, Colombia");
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setCategoryId(categoryList[0]?.id || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Servicio no disponible, intenta de nuevo en unos minutos.");
      } finally {
        setInitialLoading(false);
      }
    }
    void init();
  }, [router]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId],
  );

  function onLogout() {
    clearSession();
    router.push("/");
  }

  async function onSelectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    const slots = Math.max(0, 5 - photos.length);
    if (slots === 0) {
      setError("Ya alcanzaste el maximo de 5 fotos adjuntas.");
      return;
    }

    try {
      setError(null);
      const selected = files.slice(0, slots);
      const previews = await Promise.all(selected.map(compressImage));
      setPhotos((current) => [
        ...current,
        ...previews.map((preview) => ({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, preview })),
      ].slice(0, 5));
      showToast({ message: "Fotos comprimidas y adjuntadas", kind: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible adjuntar las fotos.");
    }
  }

  function onDetectLocation() {
    if (detectingLocation) return;
    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta ubicacion GPS. Puedes escribir tu ubicacion manualmente.");
      return;
    }
    setDetectingLocation(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          label: locationLabel.trim() || "Bogota, Colombia",
        };
        setLocation(nextLocation);
        setLocationLabel(nextLocation.label);
        setDetectingLocation(false);
        showToast({ message: "Ubicacion guardada", kind: "success" });
      },
      () => {
        setDetectingLocation(false);
        setError("No pudimos leer tu GPS. Escribe la ubicacion manualmente y continua.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!categoryId) {
      setError("Selecciona una categoria para la solicitud.");
      return;
    }
    if (description.trim().length < 20) {
      setError("Describe el problema con al menos 20 caracteres para recibir mejores cotizaciones.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiRequest<{ message: string }>("/requests", {
        method: "POST",
        token,
        body: JSON.stringify({
          categoryId,
          description: description.trim(),
          photosUrls: photos.map((photo) => photo.preview),
          preferredDateTime: preferredDate ? new Date(`${preferredDate}T12:00:00`).toISOString() : undefined,
          preferredSchedule,
          locationLabel: locationLabel.trim() || "Bogota, Colombia",
          location: location ? { ...location, label: locationLabel.trim() || location.label } : undefined,
        }),
      });

      showToast({ message: "Solicitud creada. Los profesionales seran notificados.", kind: "success" });
      router.push("/dashboard/mis-solicitudes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  if (initialLoading) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-5 py-10 text-brand-muted">
        <div className="premium-panel h-40 animate-pulse" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel-strong overflow-hidden p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#171f2f] via-[#111827] to-[#2a1207] p-6">
            <span className="rounded-full border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/12 px-3 py-1 text-xs font-bold text-[#ffd0bd]">
              Solicitud en 3 pasos
            </span>
            <h1 className="mt-5 font-[var(--font-heading)] text-4xl font-extrabold leading-tight text-white md:text-5xl">
              Publica lo que necesitas sin datos tecnicos mezclados.
            </h1>
            <p className="mt-4 text-base text-[#aab8cf]">
              Categoria, descripcion, fotos, fecha y ubicacion quedan ordenados para que el profesional entienda rapido el trabajo.
            </p>
            <div className="mt-8 space-y-3">
              {["Elige una categoria general", "Describe el problema con detalle", "Define fecha, horario y ubicacion"].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-accent)] font-bold text-white">{index + 1}</span>
                  <span className="text-sm font-semibold text-white">{step}</span>
                </div>
              ))}
            </div>
          </aside>

          <form onSubmit={onSubmit} className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-accent)]">Paso 1</p>
                  <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Categoria</h2>
                </div>
                {selectedCategory && <span className="text-2xl">{categoryIcons[normalizeKey(selectedCategory.name)] || "🧩"}</span>}
              </div>
              {categories.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-brand-muted">
                  No pudimos cargar categorias. Revisa la conexion e intenta de nuevo.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {categories.map((category) => {
                    const active = category.id === categoryId;
                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() => setCategoryId(category.id)}
                        className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                          active
                            ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/14 shadow-[0_0_24px_rgba(255,107,44,0.16)]"
                            : "border-white/10 bg-white/[0.035] hover:border-[var(--brand-accent)]/45"
                        }`}
                      >
                        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-[#0A0F1A] text-xl">
                          {categoryIcons[normalizeKey(category.name)] || "🧩"}
                        </div>
                        <p className="font-bold text-white">{category.name}</p>
                        <p className="mt-1 text-xs text-brand-muted">Categoria general</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-accent)]">Paso 2</p>
              <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Descripcion y fotos</h2>
              <p className="mt-1 text-sm text-brand-muted">No pegues coordenadas ni datos tecnicos. La app guarda eso aparte.</p>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="premium-input mt-4 min-h-40 resize-y"
                maxLength={900}
                placeholder="Explica con detalle que necesitas. Ej: necesito instalar 3 tomas nuevas en la sala y revisar el tablero electrico porque falla desde hace una semana..."
              />
              <div className="mt-2 text-right text-xs text-brand-muted">{description.length}/900 caracteres</div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-[#0A0F1A]/55 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">Fotos adjuntas</p>
                    <p className="text-xs text-brand-muted">Hasta 5 fotos, cada una comprimida a maximo 2 MB.</p>
                  </div>
                  <label className="premium-btn-secondary inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm">
                    <CameraIcon /> Agregar fotos
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onSelectPhotos} disabled={photos.length >= 5} />
                  </label>
                </div>
                {photos.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-6 text-center text-sm text-brand-muted">
                    Aun no has subido fotos. Las fotos ayudan a cotizar mejor.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {photos.map((photo) => (
                      <article key={photo.id} className="group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]">
                        <img src={photo.preview} alt="Foto adjunta" loading="lazy" className="h-24 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPhotos((current) => current.filter((item) => item.id !== photo.id))}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm font-bold text-white opacity-90 transition hover:bg-[var(--brand-danger)]"
                        >
                          x
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--brand-accent)]">Paso 3</p>
              <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Fecha, horario y ubicacion</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">Fecha preferida</label>
                  <input type="date" min={todayForInput()} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} className="premium-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">Ubicacion legible</label>
                  <input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} className="premium-input" placeholder="Ej: Bogota, Chapinero" />
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {scheduleOptions.map((option) => {
                  const active = preferredSchedule === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => setPreferredSchedule(option.value)}
                      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                        active ? "border-[var(--brand-accent)] bg-[var(--brand-accent)]/14" : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <p className="font-bold text-white">{option.label}</p>
                      <p className="text-xs text-brand-muted">{option.detail}</p>
                    </button>
                  );
                })}
              </div>

              <button type="button" onClick={onDetectLocation} disabled={detectingLocation} className="mt-4 w-full rounded-2xl border border-white/10 bg-[#0A0F1A]/70 p-4 text-left transition hover:border-[var(--brand-accent)]/45">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 text-[var(--brand-accent)] animate-pin-pulse">
                    <PinIcon />
                  </span>
                  <div>
                    <p className="font-semibold text-white">{detectingLocation ? "Detectando ubicacion..." : "Compartir ubicacion GPS"}</p>
                    <p className="text-xs text-brand-muted">Se guarda aparte de la descripcion. Nunca se muestra como coordenadas al cliente.</p>
                  </div>
                </div>
              </button>
            </section>

            {error && (
              <div className="premium-error flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="underline">Cerrar</button>
              </div>
            )}

            <button disabled={loading} className="premium-btn-primary w-full py-4 text-base">
              {"Publicar solicitud"}
            </button>

            <Link href="/dashboard/mis-solicitudes" className="inline-flex text-sm text-brand-accent hover:underline">
              Ver mis solicitudes
            </Link>
          </form>
        </div>
      </section>
    </main>
  );
}
