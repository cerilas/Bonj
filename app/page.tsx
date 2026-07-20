import { CafeExperience } from "./components/CafeExperience";
import { getPublicMenuWithFallback } from "@/lib/menu-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const items = await getPublicMenuWithFallback();
  return <CafeExperience initialMenuItems={items} />;
}
