"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getRole, getToken } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { showToast } from "@/lib/toast";

type Category = {
  id: string;
  name: string;
};

type ProfileMeResponse = {
  name: string;
};

type PhotoItem = {
  id: string;
  preview: string;
};

type LocationState = {
  lat: number;
  lng: number;
  accuracy: number;
  detectedAt: string;
};

const scheduleOptions = [
  "Ma�ana (8am-12pm)",
  "Tarde (12pm-6pm)",
  "Noche (6pm-10pm)",
] as const;

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <path d="M9 8 10.5 5h3L15 8" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function LocationPin() {
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
  const [preferredSchedule, setPreferredSchedule] = useState<string>(scheduleOptions[0]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationMessage, setLocationMessage] = useState("Toca para compartir tu ubicaci�n");
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
        if (categoryList.length > 0) {
          setCategoryId(categoryList[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No fue posible cargar la informaci�n inicial.");
      } finally {
        setInitialLoading(false);
      }
    }

    void init();
  }, [router]);

  function onLogout() {
    clearSession();
    router.push("/");
  }

  const encodedPhotos = useMemo(() => photos.map((item) => item.preview), [photos]);

  function onSelectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const availableSlots = Math.max(0, 5 - photos.length);
    const selected = files.slice(0, availableSlots);

    if (selected.length === 0) {
      setError("Ya alcanzaste el m�ximo de 5 fotos adjuntas.");
      return;
    }

    Promise.all(
      selected.map(
        (file) =>
          new Promise<PhotoItem>((resolve, reject) => {
            if (!file.type.startsWith("image/")) {
              reject(new Error("Solo se permiten im�genes."));
              return;
            }

            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                preview: String(reader.result || ""),
              });
            };
            reader.onerror = () => reject(new Error("No fue posible procesar una de las im�genes."));
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((items) => {
        setPhotos((current) => [...current, ...items].slice(0, 5));
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No fue posible adjuntar las fotos.");
      });
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
  }

  function formatLocationLabel(value: LocationState | null) {
    if (!value) return "Ubicaci�n no compartida";
    return `Lat ${value.lat.toFixed(5)}, Lng ${value.lng.toFixed(5)} � �${Math.round(value.accuracy)}m`;
  }

  function onDetectLocation() {
    if (detectingLocation) return;

    if (!("geolocation" in navigator)) {
      setError("Tu navegador no soporta geolocalizaci�n.");
      return;
    }

    setDetectingLocation(true);
    setError(null);
    setLocationMessage("Detectando ubicaci�n...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation: LocationState = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          detectedAt: new Date().toISOString(),
        };
        setLocation(nextLocation);
        setLocationMessage("Ubicaci�n compartida correctamente");
        showToast({ message: "Ubicaci�n detectada", kind: "success" });
        setDetectingLocation(false);
      },
      (geoError) => {
        if (geoError.code === 1) {
          setError("Permiso de ubicaci�n denegado. Habil�talo para compartir tu ubicaci�n.");
        } else if (geoError.code === 2) {
          setError("No fue posible obtener tu ubicaci�n. Revisa tu conexi�n y GPS.");
        } else {
          setError("La detecci�n de ubicaci�n tard� demasiado. Int�ntalo de nuevo.");
        }
        setLocationMessage("Toca para compartir tu ubicaci�n");
        setDetectingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const locationLabel = formatLocationLabel(location);
      const fullDescription = `${description.trim()}\n\nHorario preferido: ${preferredSchedule}\nUbicaci�n detectada: ${locationLabel}${location ? `\nFecha detecci�n: ${new Date(location.detectedAt).toLocaleString("es-CO")}` : ""}`;

      await apiRequest<{ message: string }>("/requests", {
        method: "POST",
        token,
        body: JSON.stringify({ categoryId, description: fullDescription, photosUrls: encodedPhotos }),
      });

      setDescription("");
      setPhotos([]);
      setLocation(null);
      setLocationMessage("Toca para compartir tu ubicaci�n");
      setPreferredSchedule(scheduleOptions[0]);
      showToast({ message: "Solicitud creada con �xito", kind: "success" });
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
          Cuanto m�s detalle incluyas, m�s precisas ser�n las cotizaciones de los profesionales.
        </p>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="mb-1.5 block text-sm text-[#d5dded]">Categor�a</label>
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
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[#d5dded]">Descripci�n</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="premium-input"
              rows={5}
              required
              placeholder="Explica con detalle qu� necesitas. Cuanto m�s detalle, mejores cotizaciones recibir�s..."
            />
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Fotos adjuntas (hasta 5)</p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/12 px-3 py-2 text-xs font-semibold text-[#8dffea] transition hover:bg-[var(--brand-accent)]/18">
                <CameraIcon />
                Subir fotos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onSelectPhotos}
                  disabled={photos.length >= 5}
                />
              </label>
            </div>

            {photos.length === 0 ? (
              <p className="mt-3 text-xs text-brand-muted">No has adjuntado im�genes a�n.</p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-5">
                {photos.map((photo) => (
                  <article key={photo.id} className="relative overflow-hidden rounded-xl border border-white/15">
                    <img src={photo.preview} alt="Foto adjunta" className="h-16 w-full object-cover md:h-20" />
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white"
                    >
                      �
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#0f2034] to-[#0b1a2c] p-4">
            <p className="mb-2 text-sm font-semibold text-white">Ubicaci�n</p>
            <button
              type="button"
              onClick={onDetectLocation}
              disabled={detectingLocation}
              className="group w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-[var(--brand-accent)]/45"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 text-[var(--brand-accent)] animate-pin-pulse">
                  <LocationPin />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {detectingLocation ? "Detectando ubicaci�n..." : locationMessage}
                  </p>
                  <p className="text-xs text-[var(--brand-accent)]">
                    {location ? formatLocationLabel(location) : "Toca para compartir tu ubicaci�n"}
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-[#d5dded]">Horario preferido</label>
            <select
              value={preferredSchedule}
              onChange={(event) => setPreferredSchedule(event.target.value)}
              className="premium-input"
            >
              {scheduleOptions.map((option) => (
                <option key={option} value={option} className="bg-[#0f1f35] text-white">
                  {option}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="premium-error">{error}</p>}

          <button disabled={loading} className="premium-btn-primary w-full py-3.5 text-base">
            {loading ? "Publicando solicitud..." : "Publicar solicitud"}
          </button>
        </form>

        <Link href="/dashboard/mis-solicitudes" className="mt-5 inline-block text-sm text-brand-accent hover:underline">
          Ver mis solicitudes
        </Link>
      </section>
    </main>
  );
}


