import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/staff-auth";

export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return NextResponse.json({ staff: null }, { status: 401 });
  }
  return NextResponse.json({ staff });
}
