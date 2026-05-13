"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";

type ProfileMeResponse = {
  id: string;
  role: UserRole;
  name: string;
  clientProfile: {
    name: string;
    photoUrl: string | null;
  } | null;
  professionalProfile: {
    name: string;
    bio: string | null;
    specialties: string[];
    hourlyRate: string | number;
    coverageRadiusKm: number;
    onboardingCompleted: boolean;
  } | null;
};

type PortfolioPhoto = {
  id: string;
  professionalId: string;
  photoUrl: string;
  description: string | null;
  createdAt: string;
};

type PortfolioResponse = {
  professional: {
    id: string;
    name: string;
  };
  total: number;
  photos: PortfolioPhoto[];
};

const savedAddressesKey = "itiw_saved_addresses";

export default function ProfilePage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [clientForm, setClientForm] = useState({
    name: "",
    photoUrl: "",
    savedAddresses: "",
  });

  const [professionalForm, setProfessionalForm] = useState({
    name: "",
    bio: "",
    hourlyRate: "",
    coverageRadiusKm: "",
  });
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [specialtyInput, setSpecialtyInput] = useState("");

  const [portfolioPhotos, setPortfolioPhotos] = useState<PortfolioPhoto[]>([]);
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [portfolioPreview, setPortfolioPreview] = useState<string | null>(null);
  const [portfolioBase64, setPortfolioBase64] = useState<string | null>(null);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [portfolioDeletingId, setPortfolioDeletingId] = useState<string | null>(null);
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<string | null>(null);

  useEffect(() => {
    const currentToken = getToken();

    if (!currentToken) {
      router.replace("/auth/login");
      return;
    }

    setToken(currentToken);
  }, [router]);

  useEffect(() => {
    async function loadProfile() {
      if (!token) return;

      setLoading(true);
      setError(null);

      try {
        const profile = await apiRequest<ProfileMeResponse>("/profile/me", {
          method: "GET",
          token,
        });

        setUserId(profile.id);
        setRole(profile.role);
        setUserName(profile.name || "");

        if (profile.role === "CLIENTE" && profile.clientProfile) {
          setClientForm({
            name: profile.clientProfile.name || "",
            photoUrl: profile.clientProfile.photoUrl || "",
            savedAddresses: localStorage.getItem(savedAddressesKey) || "",
          });
        }

        if (profile.role === "PROFESIONAL" && profile.professionalProfile) {
          setProfessionalForm({
            name: profile.professionalProfile.name || "",
            bio: profile.professionalProfile.bio || "",
            hourlyRate: String(profile.professionalProfile.hourlyRate ?? ""),
            coverageRadiusKm: String(profile.professionalProfile.coverageRadiusKm ?? ""),
          });
          setSpecialties(profile.professionalProfile.specialties || []);

          const portfolio = await apiRequest<PortfolioResponse>(`/portfolio/${profile.id}`, {
            method: "GET",
            token,
          });
          setPortfolioPhotos(portfolio.photos);
        }
      } catch (err) {
        clearSession();
        setError(err instanceof Error ? err.message : "No fue posible cargar el perfil.");
        router.replace("/auth/login");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [token, router]);

  const profileTitle = useMemo(() => {
    if (role === "CLIENTE") return "Perfil de Cliente";
    if (role === "PROFESIONAL") return "Perfil Profesional";
    return "Perfil";
  }, [role]);

  const bioCount = professionalForm.bio.length;

  function onLogout() {
    clearSession();
    router.push("/");
  }

  function addSpecialty(rawValue: string) {
    const value = rawValue.trim();

    if (!value) return;

    if (specialties.length >= 5) {
      setError("Solo puedes registrar hasta 5 especialidades.");
      return;
    }

    if (specialties.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setError("Esa especialidad ya fue agregada.");
      return;
    }

    setSpecialties((prev) => [...prev, value]);
    setSpecialtyInput("");
    setError(null);
  }

  function removeSpecialty(value: string) {
    setSpecialties((prev) => prev.filter((item) => item !== value));
  }

  function onSpecialtyKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSpecialty(specialtyInput);
    }
  }

  async function onSaveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const savedAddresses = clientForm.savedAddresses
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const result = await apiRequest<{ message: string }>("/profile/client", {
        method: "PUT",
        token,
        body: JSON.stringify({
          name: clientForm.name,
          photoUrl: clientForm.photoUrl || null,
          savedAddresses,
        }),
      });

      localStorage.setItem(savedAddressesKey, clientForm.savedAddresses);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar tu perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveProfessional(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await apiRequest<{ message: string }>("/profile/professional", {
        method: "PUT",
        token,
        body: JSON.stringify({
          name: professionalForm.name,
          bio: professionalForm.bio,
          specialties,
          hourlyRate: Number(professionalForm.hourlyRate),
          coverageRadiusKm: Number(professionalForm.coverageRadiusKm),
        }),
      });

      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible guardar tu perfil.");
    } finally {
      setSaving(false);
    }
  }

  function onPickPortfolioFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecciona un archivo de imagen valido para el portafolio.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      if (!value.startsWith("data:image/")) {
        setError("No fue posible procesar la imagen seleccionada.");
        return;
      }
      setPortfolioPreview(value);
      setPortfolioBase64(value);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function onUploadPortfolio() {
    if (!token || !portfolioBase64) {
      setError("Selecciona una foto antes de subirla al portafolio.");
      return;
    }

    if (portfolioPhotos.length >= 10) {
      setError("Maximo 10 fotos en tu portafolio.");
      return;
    }

    setPortfolioSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<{ message: string; photo: PortfolioPhoto }>("/portfolio", {
        method: "POST",
        token,
        body: JSON.stringify({
          photoUrl: portfolioBase64,
          description: portfolioDescription.trim() || null,
        }),
      });

      setPortfolioPhotos((current) => [response.photo, ...current]);
      setPortfolioDescription("");
      setPortfolioPreview(null);
      setPortfolioBase64(null);
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible subir la foto al portafolio.");
    } finally {
      setPortfolioSaving(false);
    }
  }

  async function onDeletePortfolio(photoId: string) {
    if (!token) return;

    setPortfolioDeletingId(photoId);
    setError(null);
    setMessage(null);

    try {
      const response = await apiRequest<{ message: string }>(`/portfolio/${photoId}`, {
        method: "DELETE",
        token,
      });

      setPortfolioPhotos((current) => current.filter((photo) => photo.id !== photoId));
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible eliminar la foto.");
    } finally {
      setPortfolioDeletingId(null);
    }
  }

  const visibleName = role === "PROFESIONAL" ? professionalForm.name : clientForm.name || userName;
  const initials = (visibleName || "ITIW")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const professionalProgress = role === "PROFESIONAL"
    ? [professionalForm.name, professionalForm.bio, specialties.length > 0, professionalForm.hourlyRate, professionalForm.coverageRadiusKm, portfolioPhotos.length > 0].filter(Boolean).length
    : 0;

  if (loading) {
    return <ScreenSkeleton />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel-strong relative mb-6 overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--brand-accent)]/18 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 font-[var(--font-heading)] text-2xl font-extrabold text-[#ffd0bd] shadow-[0_0_32px_rgba(255,107,44,0.12)]">
              {initials || "IC"}
            </div>
            <div>
              <span className="inline-flex rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0ca]">
                {role === "PROFESIONAL" ? "Perfil profesional" : "Perfil cliente"}
              </span>
              <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-extrabold text-white md:text-4xl">{profileTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">
                MantÃ©n tu informaciÃ³n lista para que la plataforma pueda conectar solicitudes, cotizaciones y pagos sin fricciÃ³n.
              </p>
            </div>
          </div>

          {role === "PROFESIONAL" && (
            <div className="rounded-2xl border border-[var(--brand-accent)]/25 bg-[var(--brand-accent)]/10 p-4 text-sm text-[#ffd0bd] md:min-w-64">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-white">Progreso del perfil</p>
                <span className="font-[var(--font-heading)] text-2xl font-extrabold text-[var(--brand-accent)]">
                  {Math.round((professionalProgress / 6) * 100)}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[var(--brand-accent)] transition-all" style={{ width: `${Math.round((professionalProgress / 6) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-brand-muted">{professionalProgress}/6 elementos completados. Completa cada seccion para recibir solicitudes mejor filtradas.</p>
            </div>
          )}
        </div>
      </section>

      <section className="premium-panel p-6 md:p-8">
        {error && <p className="premium-error mb-4">{error}</p>}
        {message && <p className="premium-success mb-4">{message}</p>}

        {role === "CLIENTE" && (
          <form className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]" onSubmit={onSaveClient}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Datos personales</h2>
              <p className="mt-2 text-sm text-brand-muted">Estos datos se usan para identificarte dentro de tus solicitudes.</p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm text-[#d5dded]">Nombre</label>
                  <input required value={clientForm.name} onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))} className="premium-input" placeholder="Nombre completo" />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-[#d5dded]">Foto (URL)</label>
                  <input value={clientForm.photoUrl} onChange={(e) => setClientForm((prev) => ({ ...prev, photoUrl: e.target.value }))} className="premium-input" placeholder="https://..." />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-[#d5dded]">Direcciones guardadas</label>
                  <textarea rows={5} value={clientForm.savedAddresses} onChange={(e) => setClientForm((prev) => ({ ...prev, savedAddresses: e.target.value }))} className="premium-input" placeholder="Una direcciÃ³n por lÃ­nea" />
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border border-[var(--brand-accent)]/20 bg-[var(--brand-accent)]/8 p-5">
              <p className="text-sm font-semibold text-white">Vista rÃ¡pida</p>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0A0F1A]/70 p-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-accent)]/15 font-bold text-[#ffd0bd]">{initials || "IC"}</div>
                <div>
                  <p className="font-semibold text-white">{clientForm.name || "Sin nombre"}</p>
                  <p className="text-xs text-brand-muted">Cliente ITIW Connect</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-brand-muted">Guarda varias direcciones para reutilizarlas cuando publiques solicitudes nuevas.</p>
              <button disabled={saving} className="premium-btn-primary mt-5 w-full">{"Guardar cambios"}</button>
            </aside>
          </form>
        )}

        {role === "PROFESIONAL" && (
          <>
            <form className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]" onSubmit={onSaveProfessional}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Perfil pÃºblico</h2>
                <p className="mt-2 text-sm text-brand-muted">Esta informaciÃ³n aparece cuando un cliente revisa tus cotizaciones.</p>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm text-[#d5dded]">Nombre o marca profesional</label>
                    <input required value={professionalForm.name} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, name: e.target.value }))} className="premium-input" placeholder="Ej: Juan Reparaciones" />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-sm text-[#d5dded]">
                      <span>Bio profesional</span>
                      <span className={`${bioCount > 300 ? "text-[#ff9bac]" : "text-brand-muted"}`}>{bioCount}/300</span>
                    </div>
                    <textarea rows={5} maxLength={300} value={professionalForm.bio} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, bio: e.target.value }))} className="premium-input" placeholder="Ej: Electricista certificado con 10 aÃ±os de experiencia en instalaciones residenciales." />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm text-[#d5dded]">Tarifa por hora (COP)</label>
                      <input required type="number" min={0} value={professionalForm.hourlyRate} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, hourlyRate: e.target.value }))} className="premium-input" placeholder="Ej: 50000" />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm text-[#d5dded]">Zona de cobertura (km)</label>
                      <input required type="number" min={1} value={professionalForm.coverageRadiusKm} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, coverageRadiusKm: e.target.value }))} className="premium-input" placeholder="Ej: 10" />
                      <input
                        type="range"
                        min={1}
                        max={50}
                        value={Number(professionalForm.coverageRadiusKm || 1)}
                        onChange={(e) => setProfessionalForm((prev) => ({ ...prev, coverageRadiusKm: e.target.value }))}
                        className="mt-3 h-2 w-full cursor-pointer accent-[var(--brand-accent)]"
                      />
                      <p className="mt-2 text-xs text-brand-muted">
                        Ajusta cuantos kilometros puedes cubrir. Una zona real evita solicitudes que no puedes atender.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="rounded-2xl border border-[var(--brand-accent)]/20 bg-[var(--brand-accent)]/8 p-5 lg:sticky lg:top-6">
                <h3 className="font-[var(--font-heading)] text-xl font-bold text-white">Especialidades</h3>
                <p className="mt-2 text-sm text-brand-muted">Agrega hasta 5 servicios principales. Usa categorÃ­as claras para aparecer mejor en bÃºsqueda.</p>

                <input value={specialtyInput} onChange={(e) => setSpecialtyInput(e.target.value)} onKeyDown={onSpecialtyKeyDown} onBlur={() => addSpecialty(specialtyInput)} className="premium-input mt-4" placeholder="Ej: Electricidad" />

                <div className="mt-4 flex flex-wrap gap-2">
                  {specialties.length === 0 && <p className="text-sm text-brand-muted">AÃºn no agregas especialidades.</p>}
                  {specialties.map((specialty) => (
                    <span key={specialty} className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 px-3 py-1 text-xs text-[#ffd0bd]">
                      {specialty}
                      <button type="button" onClick={() => removeSpecialty(specialty)} className="font-bold text-white/80 transition hover:text-white">Ã—</button>
                    </span>
                  ))}
                </div>

                <button disabled={saving} className="premium-btn-primary mt-6 w-full">{"Guardar perfil profesional"}</button>
              </aside>
            </form>

            <section className="mt-6 rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Portafolio</h2>
                  <p className="mt-1 text-sm text-brand-muted">Sube trabajos reales para que los clientes confÃ­en mÃ¡s rÃ¡pido.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-brand-muted">MÃ¡ximo 10 fotos</span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <label htmlFor="portfolio-file-input" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/8 px-4 py-5 text-sm font-semibold text-[#ffd0bd] transition hover:-translate-y-0.5 hover:bg-[var(--brand-accent)]/15">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-accent)] text-lg leading-none text-[#2a1106]">+</span>
                    Seleccionar imagen del portafolio
                  </label>
                  <input id="portfolio-file-input" type="file" accept="image/*" onChange={onPickPortfolioFile} className="hidden" />

                  <label className="block text-sm text-[#d5dded]">
                    DescripciÃ³n (opcional)
                    <input value={portfolioDescription} onChange={(event) => setPortfolioDescription(event.target.value)} maxLength={180} className="premium-input mt-1" placeholder="Describe el trabajo mostrado" />
                  </label>

                  {portfolioPreview && <img src={portfolioPreview} alt="Preview portafolio" className="h-40 w-full rounded-xl border border-white/10 object-cover" />}

                  <button type="button" onClick={onUploadPortfolio} disabled={portfolioSaving || !portfolioBase64 || portfolioPhotos.length >= 10} className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-[#2a1106] transition hover:-translate-y-0.5 hover:bg-[#ff824d] disabled:cursor-not-allowed disabled:opacity-60">
                    {"Subir al portafolio"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {portfolioPhotos.map((photo, index) => (
                    <article key={photo.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] opacity-0" style={{ animation: "portfolio-fade-in 360ms ease forwards", animationDelay: `${index * 65}ms` }}>
                      <img src={photo.photoUrl} alt={photo.description || "Foto de portafolio"} className="h-28 w-full object-cover" />
                      <button type="button" onClick={() => setConfirmDeletePhotoId(photo.id)} disabled={portfolioDeletingId === photo.id} className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-300/50 bg-rose-500/70 text-xs font-bold text-white transition hover:bg-rose-500">Ã—</button>
                      {photo.description && <p className="line-clamp-2 px-2 py-1 text-[11px] text-[#dce6f7]">{photo.description}</p>}
                    </article>
                  ))}
                  {portfolioPhotos.length === 0 && <p className="col-span-full rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-brand-muted">AÃºn no has agregado fotos a tu portafolio.</p>}
                </div>
              </div>
            </section>
          </>
        )}
      </section>

      {confirmDeletePhotoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#30425a] bg-[#0A0F1A] p-5">
            <h2 className="font-[var(--font-heading)] text-xl font-bold text-white">Eliminar foto</h2>
            <p className="mt-2 text-sm text-brand-muted">Esta acciÃ³n no se puede deshacer. La foto se eliminarÃ¡ de tu portafolio.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeletePhotoId(null)} className="premium-btn-secondary px-4 py-2 text-sm">Volver</button>
              <button type="button" onClick={async () => { await onDeletePortfolio(confirmDeletePhotoId); setConfirmDeletePhotoId(null); }} disabled={portfolioDeletingId === confirmDeletePhotoId} className="rounded-lg border border-rose-400/45 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/25 disabled:opacity-60">
                {portfolioDeletingId === confirmDeletePhotoId ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes portfolio-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}

