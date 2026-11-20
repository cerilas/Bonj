import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing lat or lng" }, { status: 400 });
  }

  const apiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "Google Maps API Key not configured" }, { status: 500 });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=tr`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      // Find the first result that is not a plus code
      let bestResult = data.results[0];
      for (const result of data.results) {
        if (!result.types.includes("plus_code")) {
          bestResult = result;
          break;
        }
      }
      return NextResponse.json({ address: bestResult.formatted_address });
    } else {
      return NextResponse.json({ error: "No address found", details: data }, { status: 404 });
    }
  } catch (error) {
    console.error("Geocode error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
