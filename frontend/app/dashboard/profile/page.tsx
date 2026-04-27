"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

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
    router.push("/auth/login");
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

  if (loading) {
    return <main className="mx-auto max-w-5xl px-5 py-10 text-brand-muted">Cargando perfil...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">
      <DashboardHeader userName={userName} onLogout={onLogout} />

      <section className="premium-panel p-6 md:p-8">
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-white">{profileTitle}</h1>
        <p className="mt-2 text-brand-muted">Actualiza la informacion de tu cuenta en ITIW Connect.</p>

        {error && <p className="premium-error mt-4">{error}</p>}
        {message && <p className="premium-success mt-4">{message}</p>}

        {role === "CLIENTE" && (
          <form className="mt-6 space-y-4" onSubmit={onSaveClient}>
            <div>
              <label className="mb-1.5 block text-sm text-[#d5dded]">Nombre</label>
              <input
                required
                value={clientForm.name}
                onChange={(e) => setClientForm((prev) => ({ ...prev, name: e.target.value }))}
                className="premium-input"
                placeholder="Nombre completo"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-[#d5dded]">Foto (URL)</label>
              <input
                value={clientForm.photoUrl}
                onChange={(e) => setClientForm((prev) => ({ ...prev, photoUrl: e.target.value }))}
                className="premium-input"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm text-[#d5dded]">Direcciones guardadas</label>
              <textarea
                rows={4}
                value={clientForm.savedAddresses}
                onChange={(e) => setClientForm((prev) => ({ ...prev, savedAddresses: e.target.value }))}
                className="premium-input"
                placeholder="Una direccion por linea"
              />
            </div>

            <button disabled={saving} className="premium-btn-primary w-full md:w-auto">
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </form>
        )}

        {role === "PROFESIONAL" && (
          <>
            <form className="mt-6 space-y-4" onSubmit={onSaveProfessional}>
              <div>
                <label className="mb-1.5 block text-sm text-[#d5dded]">Nombre</label>
                <input
                  required
                  value={professionalForm.name}
                  onChange={(e) => setProfessionalForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="premium-input"
                  placeholder="Nombre o marca personal"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm text-[#d5dded]">
                  <span>Bio</span>
                  <span className={`${bioCount > 300 ? "text-[#ff9bac]" : "text-brand-muted"}`}>{bioCount}/300</span>
                </div>
                <textarea
                  rows={4}
                  maxLength={300}
                  value={professionalForm.bio}
                  onChange={(e) => setProfessionalForm((prev) => ({ ...prev, bio: e.target.value }))}
                  className="premium-input"
                  placeholder="Ej: Electricista con 10 anos de experiencia"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-[#d5dded]">Especialidades (max 5)</label>
                <input
                  value={specialtyInput}
                  onChange={(e) => setSpecialtyInput(e.target.value)}
                  onKeyDown={onSpecialtyKeyDown}
                  onBlur={() => addSpecialty(specialtyInput)}
                  className="premium-input"
                  placeholder="Escribe y presiona Enter"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-[#d5dded]"
                    >
                      {specialty}
                      <button
                        type="button"
                        onClick={() => removeSpecialty(specialty)}
                        className="text-brand-accent transition hover:text-[#ff7d92]"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm text-[#d5dded]">Tarifa por hora (COP)</label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={professionalForm.hourlyRate}
                    onChange={(e) => setProfessionalForm((prev) => ({ ...prev, hourlyRate: e.target.value }))}
                    className="premium-input"
                    placeholder="Ej: 50000"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-[#d5dded]">Zona de cobertura (km)</label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={professionalForm.coverageRadiusKm}
                    onChange={(e) => setProfessionalForm((prev) => ({ ...prev, coverageRadiusKm: e.target.value }))}
                    className="premium-input"
                    placeholder="5"
                  />
                </div>
              </div>

              <button disabled={saving} className="premium-btn-primary w-full md:w-auto">
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>

            <section className="mt-8 rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Portafolio</h2>
                <span className="text-xs text-brand-muted">Maximo 10 fotos</span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div>
                    <p className="text-sm text-[#d5dded]">Agregar foto</p>
                    <label
                      htmlFor="portfolio-file-input"
                      className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#e94560]/45 bg-[#e94560]/8 px-4 py-5 text-sm font-semibold text-[#8dfce8] transition hover:-translate-y-0.5 hover:bg-[#e94560]/15"
                    >
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e94560] text-lg leading-none text-[#042821]">+</span>
                      Seleccionar imagen del portafolio
                    </label>
                    <input
                      id="portfolio-file-input"
                      type="file"
                      accept="image/*"
                      onChange={onPickPortfolioFile}
                      className="hidden"
                    />
                  </div>

                  <label className="block text-sm text-[#d5dded]">
                    Descripcion (opcional)
                    <input
                      value={portfolioDescription}
                      onChange={(event) => setPortfolioDescription(event.target.value)}
                      maxLength={180}
                      className="premium-input mt-1"
                      placeholder="Describe el trabajo mostrado"
                    />
                  </label>

                  {portfolioPreview && (
                    <img src={portfolioPreview} alt="Preview portafolio" className="h-40 w-full rounded-xl border border-white/10 object-cover" />
                  )}

                  <button
                    type="button"
                    onClick={onUploadPortfolio}
                    disabled={portfolioSaving || !portfolioBase64 || portfolioPhotos.length >= 10}
                    className="rounded-xl bg-[#e94560] px-4 py-2 text-sm font-semibold text-[#052920] transition hover:-translate-y-0.5 hover:bg-[#2ce1c2] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {portfolioSaving ? "Subiendo..." : "Subir al portafolio"}
                  </button>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {portfolioPhotos.map((photo, index) => (
                      <article
                        key={photo.id}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] opacity-0"
                        style={{
                          animation: "portfolio-fade-in 360ms ease forwards",
                          animationDelay: `${index * 65}ms`,
                        }}
                      >
                        <img src={photo.photoUrl} alt={photo.description || "Foto de portafolio"} className="h-28 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePhotoId(photo.id)}
                          disabled={portfolioDeletingId === photo.id}
                          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-300/50 bg-rose-500/70 text-xs font-bold text-white transition hover:bg-rose-500"
                        >
                          x
                        </button>
                        {photo.description && (
                          <p className="line-clamp-2 px-2 py-1 text-[11px] text-[#dce6f7]">{photo.description}</p>
                        )}
                      </article>
                    ))}
                    {portfolioPhotos.length === 0 && (
                      <p className="col-span-full text-sm text-brand-muted">Aun no has agregado fotos a tu portafolio.</p>
                    )}
                  </div>
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
            <p className="mt-2 text-sm text-brand-muted">
              Esta accion no se puede deshacer. La foto se eliminara de tu portafolio.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeletePhotoId(null)}
                className="premium-btn-secondary px-4 py-2 text-sm"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeletePortfolio(confirmDeletePhotoId);
                  setConfirmDeletePhotoId(null);
                }}
                disabled={portfolioDeletingId === confirmDeletePhotoId}
                className="rounded-lg border border-rose-400/45 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/25 disabled:opacity-60"
              >
                {portfolioDeletingId === confirmDeletePhotoId ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes portfolio-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}

