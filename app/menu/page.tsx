import type { Metadata } from "next";
import { MenuExperience } from "./MenuExperience";
import { getPublicMenuWithFallback } from "@/lib/menu-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dijital Menü",
  description: "Bonj Cake Story güncel dijital menüsü.",
};

export default async function MenuPage() {
  const items = await getPublicMenuWithFallback();
  return <MenuExperience items={items} />;
}
