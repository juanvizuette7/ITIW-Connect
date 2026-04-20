import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";
import { RouteTransition } from "@/components/RouteTransition";

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500"],
});

const headingFont = Syne({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "ITIW Connect",
    template: "%s | ITIW Connect",
  },
  description: "Marketplace de servicios del hogar en Colombia con pagos seguros en escrow.",
  applicationName: "ITIW Connect",
  openGraph: {
    title: "ITIW Connect",
    description: "Marketplace de servicios del hogar en Colombia con pagos seguros en escrow.",
    siteName: "ITIW Connect",
    locale: "es_CO",
    type: "website",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${headingFont.variable} font-[var(--font-body)]`}>
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  );
}
