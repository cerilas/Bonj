import { NextResponse } from "next/server";

const destinations: Record<string, string> = {
  a: "/admin",
  s: "/admin?view=orders",
  m: "/admin?view=messages",
  c: "/admin?view=catering",
  g: "/admin?view=analytics",
};

export function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  return context.params.then(({ code }) => {
    const destination = new URL(
      destinations[code.toLocaleLowerCase("tr-TR")] ?? "/admin",
      "https://bonj.local",
    );
    const itemId = new URL(request.url).searchParams.get("i");
    if (itemId && /^\d+$/.test(itemId)) destination.searchParams.set("item", itemId);
    return new NextResponse(null, {
      status: 307,
      headers: { Location: `${destination.pathname}${destination.search}` },
    });
  });
}
