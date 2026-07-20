import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { PublicHeader } from "./components/PublicHeader";
import { PublicFooter } from "./components/PublicFooter";
import { ThemeToggle } from "./components/ThemeToggle";
import { AnalyticsTracker } from "./components/AnalyticsTracker";
import "./globals.css";
import "./theme.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const fallbackUrl = host ? `${protocol}://${host}` : "http://localhost:3000";
  const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? fallbackUrl);
  const description =
    "Gaziantep Şehitkamil'de San Sebastian cheesecake, brunch kruvasanları, yeni nesil kahve, soğuk içecekler ve catering deneyimi.";

  return {
    metadataBase,
    title: {
      default: "Bonj Cake Story: Gaziantep",
      template: "Bonj Cake Story: %s",
    },
    applicationName: "Bonj Cake Story",
    description,
    keywords: [
      "Gaziantep kafe",
      "Gaziantep kafeler",
      "Şehitkamil kafe",
      "Gaziantep San Sebastian",
      "Gaziantep San Sebastian cheesecake",
      "Gaziantep San Sebastian sipariş",
      "Gaziantep cheesecake",
      "Gaziantep cheesecake sipariş",
      "Gaziantep Lotus cheesecake",
      "Gaziantep frambuaz cheesecake",
      "Gaziantep Antep fıstıklı cheesecake",
      "Gaziantep kahvaltı",
      "Gaziantep kahvaltı mekanları",
      "Şehitkamil kahvaltı",
      "Gaziantep brunch",
      "Şehitkamil brunch",
      "Gaziantep kruvasan",
      "Gaziantep avokadolu kruvasan",
      "Gaziantep kahve",
      "Gaziantep kahveci",
      "Gaziantep üçüncü nesil kahve",
      "Gaziantep espresso",
      "Gaziantep latte",
      "Gaziantep filtre kahve",
      "Gaziantep soğuk kahve",
      "Gaziantep Cold Brew",
      "Gaziantep Iced Latte",
      "Gaziantep Matcha Latte",
      "Gaziantep tatlı",
      "Gaziantep tatlıcı",
      "Gaziantep pasta",
      "Gaziantep limonata",
      "Gaziantep catering",
      "Gaziantep catering firması",
      "Gaziantep kurumsal catering",
      "Gaziantep etkinlik catering",
      "Gaziantep kurumsal ikram",
      "Gaziantep doğum günü pastası",
      "Gaziantep özel gün pastası",
      "Gaziantep butik pasta",
    ],
    robots: { index: true, follow: true },
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      siteName: "Bonj Cake Story",
      title: "Bonj Cake Story: Tatlıya yeni bir boyut.",
      description,
      url: "/",
      images: [{ url: "/og.jpg", width: 1734, height: 907, alt: "Bonj Cake Story" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Bonj Cake Story: Tatlıya yeni bir boyut.",
      description,
      images: ["/og.jpg"],
    },
    manifest: "/site.webmanifest",
    icons: {
      icon: [
        { url: "/bonj-logo2.svg", type: "image/svg+xml" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
      shortcut: "/favicon-32x32.png",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      other: [{ rel: "mask-icon", url: "/bonj-logo2.svg", color: "#a91940" }],
    },
    appleWebApp: {
      capable: true,
      title: "Bonj Cake Story",
      statusBarStyle: "black-translucent",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#100d0f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (host ? `${protocol}://${host}` : "http://localhost:3000");

  return (
    <html lang="tr" data-theme="light" suppressHydrationWarning>
      <head>
        <Script id="bonj-theme-init" strategy="beforeInteractive">
          {"try { const theme = localStorage.getItem('bonj-theme'); if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme; } catch {}"}
        </Script>
      </head>
      <body>
        <Script
          id="bonj-local-business-schema"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CafeOrCoffeeShop",
              sameAs: ["https://www.instagram.com/bonjcakestory/"],
              name: "Bonj Cake Story",
              description: "Gaziantep Şehitkamil'de San Sebastian cheesecake, brunch ve yeni nesil kahve deneyimi.",
              image: `${siteUrl}/og.jpg`,
              url: siteUrl,
              telephone: "+9050764477985",
              servesCuisine: ["Kahve", "Tatlı", "Brunch", "Cheesecake"],
              address: {
                "@type": "PostalAddress",
                streetAddress: "Osmangazi, Ahmet Şireci Blv. Riva Apt. No: 18/I-E",
                addressLocality: "Şehitkamil",
                addressRegion: "Gaziantep",
                postalCode: "27000",
                addressCountry: "TR",
              },
              hasMenu: `${siteUrl}/menu`,
            }),
          }}
        />
        {children}
        <PublicHeader />
        <PublicFooter />
        <ThemeToggle />
        <AnalyticsTracker />
      </body>
    </html>
  );
}
