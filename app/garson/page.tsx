import type { Metadata } from "next";
import "../admin/admin.css";
import "../admin/admin-v2.css";
import { getCurrentStaff } from "@/lib/staff-auth";
import { GarsonExperience } from "./GarsonExperience";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Garson & Komi Paneli | Bonj Cake Story",
  robots: { index: false, follow: false },
};

export default async function GarsonPage() {
  const staff = await getCurrentStaff();
  return <GarsonExperience initialStaff={staff} />;
}
