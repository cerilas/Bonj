import type { Metadata } from "next";
import { CustomerDisplayExperience } from "./CustomerDisplayExperience";
import "./musteri-ekrani.css";

export const metadata: Metadata = {
  title: "Müşteri Ekranı | bonj",
  robots: { index: false, follow: false },
};

export default function CustomerDisplayPage() {
  return <CustomerDisplayExperience />;
}
