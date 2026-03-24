import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import "./globals.css";

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
  title: "ITIW Connect",
  description: "Marketplace de servicios del hogar en Colombia",
  applicationName: "ITIW Connect",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${bodyFont.variable} ${headingFont.variable} font-[var(--font-body)]`}>{children}</body>
    </html>
  );
}
