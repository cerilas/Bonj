import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "bonj-cake-story" });
}
