import type { Metadata } from "next";
import { HesabimExperience } from "./HesabimExperience";

export const metadata: Metadata = {
  title: "Hesabım - Profilim, Adreslerim ve Siparişlerim",
  description: "Bonj Cake Story müşteri paneli: Profil bilgileri, kayıtlı Gaziantep adresleri ve sipariş takibi.",
  alternates: { canonical: "/hesabim" },
};

export default function HesabimPage() {
  return <HesabimExperience />;
}
