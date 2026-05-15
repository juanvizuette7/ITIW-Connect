"use client";

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, invalidateApiCache } from "@/lib/api";
import { clearSession, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader, invalidateDashboardHeaderProfileCache } from "@/components/DashboardHeader";
import { ScreenSkeleton } from "@/components/ScreenSkeleton";
import { LoadingDots } from "@/components/LoadingDots";
import { RoleIdentityBadge } from "@/components/RoleIdentityBadge";
import { getStoredProfilePhoto, setStoredProfilePhoto } from "@/lib/profilePhoto";

type ProfileMeResponse = {
  id: string;
  email: string;
  phone: string;
  isEmailVerified: boolean;
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
const maxProfilePhotoSizeBytes = 2_000_000;

type ClientProfileSaveResponse = {
  message: string;
  profile: {
    name: string;
    photoUrl: string | null;
  };
  user: {
    email: string;
    phone: string;
    isEmailVerified: boolean;
  };
};

function getSavedAddressesKey(userId: string) {
  return `${savedAddressesKey}:${userId}`;
}

export default function ProfilePage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState("");
  const [accountInfo, setAccountInfo] = useState({ email: "", phone: "", isEmailVerified: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [clientForm, setClientForm] = useState({
    name: "",
    photoUrl: "",
    savedAddresses: "",
  });
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [clientImageOk, setClientImageOk] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

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
        setAccountInfo({
          email: profile.email || "",
          phone: profile.phone || "",
          isEmailVerified: Boolean(profile.isEmailVerified),
        });
        const storedPhotoUrl = getStoredProfilePhoto(profile.id);

        if (profile.role === "CLIENTE") {
          const clientProfile = profile.clientProfile;
          const userAddressesKey = getSavedAddressesKey(profile.id);
          const savedAddresses =
            localStorage.getItem(userAddressesKey) || localStorage.getItem(savedAddressesKey) || "";
          const photoUrl = clientProfile?.photoUrl || storedPhotoUrl || "";
          setClientForm({
            name: clientProfile?.name || profile.name || "",
            photoUrl,
            savedAddresses,
          });
          setProfilePhotoUrl(photoUrl);
        }

        if (profile.role === "PROFESIONAL" && profile.professionalProfile) {
          setProfilePhotoUrl(storedPhotoUrl);
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

  useEffect(() => {
    setClientImageOk(Boolean(profilePhotoUrl.trim()));
  }, [profilePhotoUrl]);

  const profileTitle = useMemo(() => {
    if (role === "CLIENTE") return "Perfil de Cliente";
    if (role === "PROFESIONAL") return "Perfil Profesional";
    return "Perfil";
  }, [role]);

  const bioCount = professionalForm.bio.length;

  function clearStatusForEdit() {
    if (message) setMessage(null);
    if (error) setError(null);
  }

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

  async function compressProfilePhoto(file: File) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Selecciona un archivo de imagen válido.");
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error("La imagen es demasiado grande. Usa una foto menor a 10 MB.");
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No fue posible leer la imagen seleccionada."));
        img.src = objectUrl;
      });

      const attempts = [
        { maxSide: 960, quality: 0.8 },
        { maxSide: 800, quality: 0.74 },
        { maxSide: 640, quality: 0.68 },
        { maxSide: 520, quality: 0.62 },
        { maxSide: 420, quality: 0.56 },
        { maxSide: 360, quality: 0.5 },
      ];

      let lastDataUrl = "";

      for (const attempt of attempts) {
        const scale = Math.min(1, attempt.maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("No fue posible procesar la imagen seleccionada.");
        }

        context.drawImage(image, 0, 0, width, height);
        lastDataUrl = canvas.toDataURL("image/jpeg", attempt.quality);

        if (lastDataUrl.length <= maxProfilePhotoSizeBytes) {
          return lastDataUrl;
        }
      }

      if (lastDataUrl) {
        return lastDataUrl;
      }

      throw new Error("No fue posible comprimir la foto seleccionada.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function onPickProfilePhotoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPhotoUploading(true);
    setError(null);
    setMessage(null);

    try {
      const dataUrl = await compressProfilePhoto(file);
      setProfilePhotoUrl(dataUrl);
      setClientImageOk(true);

      if (role === "CLIENTE") {
        setClientForm((prev) => ({ ...prev, photoUrl: dataUrl }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar la foto.");
    } finally {
      setPhotoUploading(false);
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

      const cleanName = clientForm.name.trim();
      const cleanPhotoUrl = (profilePhotoUrl || clientForm.photoUrl).trim();
      const cleanEmail = accountInfo.email.trim().toLowerCase();
      const cleanPhone = accountInfo.phone.trim();

      const result = await apiRequest<ClientProfileSaveResponse>("/profile/client", {
        method: "PUT",
        token,
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          photoUrl: cleanPhotoUrl || null,
          savedAddresses,
        }),
      });

      if (userId) {
        localStorage.setItem(getSavedAddressesKey(userId), clientForm.savedAddresses);
        localStorage.removeItem(savedAddressesKey);
        setStoredProfilePhoto(userId, result.profile.photoUrl || "");
      }

      invalidateDashboardHeaderProfileCache();
      invalidateApiCache("/profile/me");
      setProfilePhotoUrl(result.profile.photoUrl || "");
      setClientImageOk(Boolean(result.profile.photoUrl));
      setClientForm((prev) => ({
        ...prev,
        name: result.profile.name,
        photoUrl: result.profile.photoUrl || "",
        savedAddresses: clientForm.savedAddresses,
      }));
      setAccountInfo((prev) => ({
        ...prev,
        email: result.user.email,
        phone: result.user.phone,
        isEmailVerified: result.user.isEmailVerified,
      }));
      setUserName(result.profile.name);
      setMessage(result.message || "Perfil actualizado correctamente.");
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

      setUserName(professionalForm.name.trim());
      setStoredProfilePhoto(userId, profilePhotoUrl);
      invalidateDashboardHeaderProfileCache();
      invalidateApiCache("/profile/me");
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
      setError("Selecciona un archivo de imagen válido para el portafolio.");
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
      setError("Máximo 10 fotos en tu portafolio.");
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
    return <ScreenSkeleton variant="profile" title="Cargando perfil..." subtitle="Estamos preparando tus datos y preferencias." />;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-5 sm:py-8">
      <DashboardHeader
        userName={visibleName || userName}
        userPhotoUrl={profilePhotoUrl}
        onLogout={onLogout}
      />

      <section className="premium-panel-strong relative mb-6 overflow-hidden p-5 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--brand-accent)]/18 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 font-[var(--font-heading)] text-xl font-extrabold text-[#ffd0bd] shadow-[0_0_32px_rgba(255,107,44,0.12)] sm:h-20 sm:w-20 sm:rounded-3xl sm:text-2xl">
              {profilePhotoUrl && clientImageOk ? (
                <img
                  src={profilePhotoUrl}
                  alt={visibleName || "Foto de perfil"}
                  loading="lazy"
                  onError={() => setClientImageOk(false)}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials || "IC"
              )}
            </div>
            <div>
              <RoleIdentityBadge role={role} compact />
              <h1 className="mt-2 font-[var(--font-heading)] text-3xl font-extrabold text-white md:text-4xl">{profileTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">
                Mantén tu información lista para que la plataforma pueda conectar solicitudes, cotizaciones y pagos sin fricción.
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
              <p className="mt-2 text-xs text-brand-muted">{professionalProgress}/6 elementos completados. Completa cada sección para recibir solicitudes mejor filtradas.</p>
            </div>
          )}
        </div>
      </section>

      <section className="premium-panel p-4 sm:p-6 md:p-8">
        {error && <p className="premium-error mb-4">{error}</p>}
        {message && <p className="premium-success mb-4">{message}</p>}

        {role === "CLIENTE" && (
          <form className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]" onSubmit={onSaveClient}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Datos personales</h2>
              <p className="mt-2 text-sm text-brand-muted">Estos datos se usan para identificarte dentro de tus solicitudes.</p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm text-[#d5dded]">Nombre</label>
                  <input
                    required
                    value={clientForm.name}
                    onChange={(e) => {
                      clearStatusForEdit();
                      setClientForm((prev) => ({ ...prev, name: e.target.value }));
                    }}
                    className="premium-input"
                    placeholder="Nombre completo"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm text-[#d5dded]">Correo</label>
                    <input
                      required
                      type="email"
                      value={accountInfo.email}
                      onChange={(event) => {
                        clearStatusForEdit();
                        setAccountInfo((prev) => ({ ...prev, email: event.target.value }));
                      }}
                      className="premium-input"
                      placeholder="nombre@correo.com"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm text-[#d5dded]">Teléfono</label>
                    <input
                      required
                      value={accountInfo.phone}
                      onChange={(event) => {
                        clearStatusForEdit();
                        setAccountInfo((prev) => ({ ...prev, phone: event.target.value }));
                      }}
                      className="premium-input"
                      placeholder="3001234567"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-[#d5dded]">Foto (URL)</label>
                  <input
                    value={clientForm.photoUrl}
                    onChange={(e) => {
                      clearStatusForEdit();
                      const value = e.target.value;
                      setClientForm((prev) => ({ ...prev, photoUrl: value }));
                      setProfilePhotoUrl(value);
                    }}
                    className="premium-input"
                    placeholder="https://ejemplo.com/mi-foto.jpg"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-sm font-semibold text-white">Subir foto desde tu computador</p>
                  <p className="mt-1 text-xs leading-relaxed text-brand-muted">
                    Puedes usar una imagen JPG, PNG o WEBP. La optimizamos antes de guardarla.
                  </p>
                  <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/10 px-4 py-3 text-sm font-semibold text-[#ffd0bd] transition hover:-translate-y-0.5 hover:bg-[var(--brand-accent)]/16">
                    {photoUploading ? <LoadingDots label="Procesando" /> : "Elegir imagen"}
                    <input type="file" accept="image/*" onChange={onPickProfilePhotoFile} className="hidden" />
                  </label>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-[#d5dded]">Direcciones guardadas</label>
                  <textarea
                    rows={5}
                    value={clientForm.savedAddresses}
                    onChange={(e) => {
                      clearStatusForEdit();
                      setClientForm((prev) => ({ ...prev, savedAddresses: e.target.value }));
                    }}
                    className="premium-input min-h-36 resize-y leading-relaxed"
                    placeholder="Una dirección por línea"
                  />
                </div>
              </div>
            </div>

            <aside className="h-fit rounded-2xl border border-[var(--brand-accent)]/20 bg-[var(--brand-accent)]/8 p-4 sm:p-5">
              <p className="text-sm font-semibold text-white">Vista rápida</p>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0A0F1A]/70 p-4">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[var(--brand-accent)]/15 font-bold text-[#ffd0bd]">
                  {profilePhotoUrl && clientImageOk ? (
                    <img
                      src={profilePhotoUrl}
                      alt={clientForm.name || "Foto de perfil"}
                      loading="lazy"
                      onError={() => setClientImageOk(false)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials || "IC"
                  )}
                </div>
                <div>
                  <p className="font-semibold text-white">{clientForm.name || "Sin nombre"}</p>
                  <p className="text-xs text-brand-muted">Cliente ITIW Connect</p>
                </div>
              </div>
              <RoleIdentityBadge role={role} compact className="mt-4 w-full" />
              <p className="mt-4 text-sm leading-relaxed text-brand-muted">Guarda varias direcciones para reutilizarlas cuando publiques solicitudes nuevas.</p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-[#0A0F1A]/65 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Información de cuenta</p>
                  <p className="mt-2 break-all text-sm text-white">{accountInfo.email || "Correo no disponible"}</p>
                  <p className="mt-1 text-xs text-brand-muted">Teléfono: {accountInfo.phone || "No registrado"}</p>
                  <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${accountInfo.isEmailVerified ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200" : "border-amber-400/35 bg-amber-400/10 text-amber-200"}`}>
                    {accountInfo.isEmailVerified ? "Correo verificado" : "Verificación pendiente"}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0A0F1A]/65 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Preferencias de contacto</p>
                  <p className="mt-2 text-sm leading-relaxed text-white">Recibirás avisos por correo cuando haya cotizaciones, pagos o mensajes importantes.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-[#0A0F1A]/65 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Seguridad básica</p>
                  <p className="mt-2 text-sm leading-relaxed text-white">Tu sesión se protege con token seguro y puedes cerrar sesión desde la barra superior.</p>
                </div>
              </div>

              <button disabled={saving || photoUploading} className="premium-btn-primary mt-5 w-full">
                {saving ? <LoadingDots label="Guardando" /> : "Guardar cambios"}
              </button>
            </aside>
          </form>
        )}

        {role === "PROFESIONAL" && (
          <>
            <form className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]" onSubmit={onSaveProfessional}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
                <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Perfil público</h2>
                <p className="mt-2 text-sm text-brand-muted">Esta información aparece cuando un cliente revisa tus cotizaciones.</p>

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
                    <textarea rows={5} maxLength={300} value={professionalForm.bio} onChange={(e) => setProfessionalForm((prev) => ({ ...prev, bio: e.target.value }))} className="premium-input min-h-36 resize-y leading-relaxed" placeholder="Ej: Electricista certificado con 10 años de experiencia en instalaciones residenciales." />
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
                        Ajusta cuántos kilómetros puedes cubrir. Una zona real evita solicitudes que no puedes atender.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="h-fit rounded-2xl border border-[var(--brand-accent)]/20 bg-[var(--brand-accent)]/8 p-4 sm:p-5 lg:sticky lg:top-6">
                <div className="mb-6 rounded-2xl border border-white/10 bg-[#0A0F1A]/70 p-4">
                <h3 className="font-[var(--font-heading)] text-xl font-bold text-white">Foto de perfil</h3>
                <RoleIdentityBadge role={role} compact className="mt-3 w-full" />
                <p className="mt-2 text-sm text-brand-muted">
                  Una foto clara ayuda a que los clientes identifiquen tu perfil profesional.
                  </p>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/12 font-bold text-[#ffd0bd]">
                      {profilePhotoUrl && clientImageOk ? (
                        <img
                          src={profilePhotoUrl}
                          alt={professionalForm.name || "Foto de perfil"}
                          loading="lazy"
                          onError={() => setClientImageOk(false)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials || "IC"
                      )}
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/10 px-4 py-3 text-sm font-semibold text-[#ffd0bd] transition hover:-translate-y-0.5 hover:bg-[var(--brand-accent)]/16">
                      {photoUploading ? <LoadingDots label="Procesando" /> : "Cambiar foto"}
                      <input type="file" accept="image/*" onChange={onPickProfilePhotoFile} className="hidden" />
                    </label>
                  </div>

                  <label className="mt-4 block text-sm text-[#d5dded]">
                    Foto (URL)
                    <input
                      value={profilePhotoUrl}
                      onChange={(event) => {
                        setProfilePhotoUrl(event.target.value);
                        setClientImageOk(Boolean(event.target.value.trim()));
                      }}
                      className="premium-input mt-1"
                      placeholder="https://ejemplo.com/mi-foto.jpg"
                    />
                  </label>
                </div>

                <h3 className="font-[var(--font-heading)] text-xl font-bold text-white">Especialidades</h3>
                <p className="mt-2 text-sm text-brand-muted">Agrega hasta 5 servicios principales. Usa categorías claras para aparecer mejor en búsqueda.</p>

                <input value={specialtyInput} onChange={(e) => setSpecialtyInput(e.target.value)} onKeyDown={onSpecialtyKeyDown} onBlur={() => addSpecialty(specialtyInput)} className="premium-input mt-4" placeholder="Ej: Electricidad" />

                <div className="mt-4 flex flex-wrap gap-2">
                  {specialties.length === 0 && <p className="text-sm text-brand-muted">Aún no agregas especialidades.</p>}
                  {specialties.map((specialty) => (
                    <span key={specialty} className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/35 bg-[var(--brand-accent)]/12 px-3 py-1 text-xs text-[#ffd0bd]">
                      {specialty}
                      <button type="button" onClick={() => removeSpecialty(specialty)} className="font-bold text-white/80 transition hover:text-white">×</button>
                    </span>
                  ))}
                </div>

                <button disabled={saving} className="premium-btn-primary mt-6 w-full">{saving ? <LoadingDots label="Guardando" /> : "Guardar perfil profesional"}</button>
              </aside>
            </form>

            <section className="mt-6 rounded-2xl border border-[#263245] bg-[#0A0F1A] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-[var(--font-heading)] text-2xl font-bold text-white">Portafolio</h2>
                  <p className="mt-1 text-sm text-brand-muted">Sube trabajos reales para que los clientes confíen más rápido.</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-brand-muted">Máximo 10 fotos</span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <label htmlFor="portfolio-file-input" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/8 px-4 py-5 text-sm font-semibold text-[#ffd0bd] transition hover:-translate-y-0.5 hover:bg-[var(--brand-accent)]/15">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-accent)] text-lg leading-none text-[#2a1106]">+</span>
                    Seleccionar imagen del portafolio
                  </label>
                  <input id="portfolio-file-input" type="file" accept="image/*" onChange={onPickPortfolioFile} className="hidden" />

                  <label className="block text-sm text-[#d5dded]">
                    Descripción (opcional)
                    <input value={portfolioDescription} onChange={(event) => setPortfolioDescription(event.target.value)} maxLength={180} className="premium-input mt-1" placeholder="Describe el trabajo mostrado" />
                  </label>

                  {portfolioPreview && <img src={portfolioPreview} alt="Preview portafolio" className="h-40 w-full rounded-xl border border-white/10 object-cover" />}

                  <button type="button" onClick={onUploadPortfolio} disabled={portfolioSaving || !portfolioBase64 || portfolioPhotos.length >= 10} className="rounded-xl bg-[var(--brand-accent)] px-4 py-2 text-sm font-semibold text-[#2a1106] transition hover:-translate-y-0.5 hover:bg-[#ff824d] disabled:cursor-not-allowed disabled:opacity-60">
                    {portfolioSaving ? <LoadingDots label="Subiendo" /> : "Subir al portafolio"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {portfolioPhotos.map((photo, index) => (
                    <article key={photo.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] opacity-0" style={{ animation: "portfolio-fade-in 360ms ease forwards", animationDelay: `${index * 65}ms` }}>
                      <img src={photo.photoUrl} alt={photo.description || "Foto de portafolio"} className="h-28 w-full object-cover" />
                      <button type="button" onClick={() => setConfirmDeletePhotoId(photo.id)} disabled={portfolioDeletingId === photo.id} className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-300/50 bg-rose-500/70 text-xs font-bold text-white transition hover:bg-rose-500">×</button>
                      {photo.description && <p className="line-clamp-2 px-2 py-1 text-[11px] text-[#dce6f7]">{photo.description}</p>}
                    </article>
                  ))}
                  {portfolioPhotos.length === 0 && <p className="col-span-full rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-brand-muted">Aún no has agregado fotos a tu portafolio.</p>}
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
            <p className="mt-2 text-sm text-brand-muted">Esta acción no se puede deshacer. La foto se eliminará de tu portafolio.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeletePhotoId(null)} className="premium-btn-secondary px-4 py-2 text-sm">Volver</button>
              <button type="button" onClick={async () => { await onDeletePortfolio(confirmDeletePhotoId); setConfirmDeletePhotoId(null); }} disabled={portfolioDeletingId === confirmDeletePhotoId} className="rounded-lg border border-rose-400/45 bg-rose-400/15 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/25 disabled:opacity-60">
                {portfolioDeletingId === confirmDeletePhotoId ? <LoadingDots label="Eliminando" /> : "Eliminar"}
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
