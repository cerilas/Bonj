import type { Metadata } from "next";
import { GirisExperience } from "./GirisExperience";

export const metadata: Metadata = {
  title: "Giriş Yap / Üye Ol",
  description: "Bonj Cake Story şifresiz SMS doğrulamalı müşteri girişi ve üyelik.",
  alternates: { canonical: "/giris" },
};

export default function GirisPage() {
  return <GirisExperience />;
}
