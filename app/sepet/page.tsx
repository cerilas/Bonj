import type { Metadata } from "next";
import { CartExperience } from "./CartExperience";
import "./sepet.css";

export const metadata: Metadata = {
  title: "Sepet ve Sipariş",
  description: "Bonj Cake Story siparişinizi oluşturun; masanıza veya seçtiğiniz saate hazırlayalım.",
  alternates: { canonical: "/sepet" },
};

export default function CartPage() {
  return <CartExperience />;
}
