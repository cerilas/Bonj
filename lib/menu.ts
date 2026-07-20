export type MenuCategory =
  | "signature"
  | "tatli"
  | "kahvalti"
  | "bowl"
  | "kahve"
  | "soguk-kahve"
  | "ferah";

export type MenuItem = {
  id?: number;
  slug: string;
  name: string;
  description: string;
  longDescription?: string | null;
  allergenInfo?: string | null;
  estimatedCalories?: number | null;
  imageAlt?: string | null;
  imageUrl?: string | null;
  priceInKurus?: number | null;
  category: MenuCategory;
  categoryName: string;
  badge?: string;
  accent: "berry" | "cream" | "coffee" | "citrus" | "avocado";
};

export const categoryLabels: Array<{
  id: "all" | MenuCategory;
  label: string;
}> = [
  { id: "all", label: "Hepsi" },
  { id: "signature", label: "Cheesecake & İmza" },
  { id: "tatli", label: "Tatlı & Fırın" },
  { id: "kahvalti", label: "Brunch & Kruvasan" },
  { id: "bowl", label: "Bowl & Hafif" },
  { id: "kahve", label: "Sıcak Kahveler" },
  { id: "soguk-kahve", label: "Soğuk Kahveler" },
  { id: "ferah", label: "Soğuk İçecekler" },
];

export const menuItems: MenuItem[] = [
  {
    slug: "san-sebastian",
    name: "San Sebastian",
    description:
      "Karamelize üst, akışkan merkez ve bitter çikolata dokunuşu.",
    category: "signature",
    categoryName: "İmza Tatlı",
    badge: "Bonj favorisi",
    accent: "cream",
  },
  {
    slug: "lotus-cheesecake",
    name: "Lotus Cheesecake",
    description:
      "Baharatlı bisküvi katmanı, ipeksi peynir kreması ve karamel.",
    category: "signature",
    categoryName: "Cheesecake",
    accent: "coffee",
  },
  {
    slug: "avokadolu-brunch-kruvasan",
    name: "Avokadolu Brunch Kruvasan",
    description:
      "Tereyağlı çıtır katlar; avokado, kremsi scrambled egg, roka ve otlu labne.",
    category: "kahvalti",
    categoryName: "Bonj Brunch",
    badge: "Yeni",
    accent: "avocado",
  },
  {
    slug: "cilekli-limonata",
    name: "Çilekli Limonata",
    description:
      "Taze çilek, limon kabuğu ve dengeli ekşilikle buz gibi.",
    category: "ferah",
    categoryName: "Ev Yapımı",
    badge: "Taze",
    accent: "berry",
  },
  {
    slug: "flat-white",
    name: "Flat White",
    description:
      "Çift shot espresso ve kadifemsi mikro köpüğün dengesi.",
    category: "kahve",
    categoryName: "Sıcak Kahve",
    accent: "coffee",
  },
  {
    slug: "iced-latte",
    name: "Iced Latte",
    description:
      "Yoğun espresso, soğuk süt ve her yudumda pürüzsüz bitiş.",
    category: "soguk-kahve",
    categoryName: "Soğuk Kahve",
    accent: "cream",
  },
  {
    slug: "limon-cheesecake",
    name: "Limon Cheesecake",
    description:
      "Canlı narenciye notaları, hafif krema ve gevrek taban.",
    category: "signature",
    categoryName: "Cheesecake",
    accent: "citrus",
  },
];
