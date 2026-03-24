"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clearSession, getToken, UserRole } from "@/lib/auth";
import { DashboardHeader } from "@/components/DashboardHeader";

type ProfileMeResponse = {
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
  } | null;
};

const savedAddressesKey = "itiw_saved_addresses";

export default function ProfilePage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
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
        }
      } catch (err) {
        clearSession();
        setError(err instanceof Error ? err.message : "No fue posible cargar el perfil.");
        router.replace("/auth/login");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
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
                placeholder="Describe tu experiencia profesional"
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
                  placeholder="Tarifa por hora en COP"
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
        )}
      </section>
    </main>
  );
}

