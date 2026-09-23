import type { Metadata } from "next";

import { AdminAuthProvider } from "@/features/admin/AdminAuthProvider";

import "./admin.css";

export const metadata: Metadata = {
  title: "ADM | NUMORA",
  description: "Área interna da NUMORA.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      noarchive: true,
    },
  },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
