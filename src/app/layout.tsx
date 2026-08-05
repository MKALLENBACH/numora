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
    icon: [
      { url: siteConfig.favicon16, type: "image/png", sizes: "16x16" },
      { url: siteConfig.favicon32, type: "image/png", sizes: "32x32" },
      { url: siteConfig.favicon, type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: siteConfig.favicon32, type: "image/png" }],
    apple: [{ url: siteConfig.appleTouchIcon, type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.ogTitle,
    description: siteConfig.ogDescription,
    url: siteConfig.hasConfiguredSiteUrl ? siteConfig.siteUrl : undefined,
    images: [
      {
        url: siteConfig.socialImageUrl,
        width: 1200,
        height: 630,
        alt: "NUMORA — Operações melhores. Resultados mensuráveis.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.ogTitle,
    description: siteConfig.ogDescription,
    images: [siteConfig.socialImageUrl],
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
