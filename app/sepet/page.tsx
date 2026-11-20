import type { Metadata } from "next";
import { CartExperience } from "./CartExperience";
import "./sepet.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sepet ve Sipariş",
  description: "Bonj Cake Story siparişinizi oluşturun; masanıza veya seçtiğiniz saate hazırlayalım.",
  alternates: { canonical: "/sepet" },
};

export default function CartPage() {
  const googleMapsApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    "";
  return <CartExperience googleMapsApiKey={googleMapsApiKey} />;
}
