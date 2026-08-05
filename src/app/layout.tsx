import type { Metadata, Viewport } from "next";

import "./globals.css";

import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: siteConfig.title,
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: siteConfig.hasConfiguredSiteUrl
    ? { canonical: siteConfig.siteUrl }
    : undefined,
  icons: {
    icon: [{ url: siteConfig.favicon, type: "image/jpeg" }],
    shortcut: [{ url: siteConfig.favicon, type: "image/jpeg" }],
    apple: [{ url: siteConfig.favicon, type: "image/jpeg" }],
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.hasConfiguredSiteUrl ? siteConfig.siteUrl : undefined,
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "NUMORA — Operações melhores. Resultados mensuráveis.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1F33",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={siteConfig.language}>
      <body>{children}</body>
    </html>
  );
}
