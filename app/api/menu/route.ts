import { NextResponse } from "next/server";
import { getPublicMenuItems } from "@/lib/menu-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getPublicMenuItems();

    return NextResponse.json({ items: rows, source: "database" });
  } catch (error) {
    console.warn("Menu database is unavailable; returning the curated fallback.");
    return NextResponse.json({
      items: [],
      source: "fallback",
      error: process.env.NODE_ENV === "development" ? String(error) : undefined,
    });
  }
}
