import { LoadingScreen } from "./LoadingScreen";

type ScreenSkeletonProps = {
  variant?: "dashboard" | "list" | "profile" | "form";
  title?: string;
  subtitle?: string;
};

const copyByVariant: Record<NonNullable<ScreenSkeletonProps["variant"]>, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Preparando tu experiencia...",
    subtitle: "Estamos sincronizando tu actividad, accesos y datos recientes.",
  },
  list: {
    title: "Buscando oportunidades...",
    subtitle: "Estamos cargando solicitudes y cotizaciones con la información más reciente.",
  },
  profile: {
    title: "Cargando tu perfil...",
    subtitle: "Espera un momento mientras preparamos tus datos, foto y preferencias.",
  },
  form: {
    title: "Preparando el formulario...",
    subtitle: "Estamos cargando categorías, ubicación y datos necesarios para continuar.",
  },
};

export function ScreenSkeleton({ variant = "dashboard", title, subtitle }: ScreenSkeletonProps) {
  const copy = copyByVariant[variant];

  return (
    <LoadingScreen
      title={title || copy.title}
      subtitle={subtitle || copy.subtitle}
    />
  );
}
