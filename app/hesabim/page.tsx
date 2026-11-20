import type { Metadata } from "next";
import { HesabimExperience } from "./HesabimExperience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hesabım - Profilim, Adreslerim ve Siparişlerim",
  description: "Bonj Cake Story müşteri paneli: Profil bilgileri, kayıtlı Gaziantep adresleri ve sipariş takibi.",
  alternates: { canonical: "/hesabim" },
};

export default function HesabimPage() {
  const googleMapsApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    "";
  return <HesabimExperience googleMapsApiKey={googleMapsApiKey} />;
}
