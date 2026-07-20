import type { Metadata } from "next";
import { headers } from "next/headers";
import { AdminDashboard, type AdminView } from "./AdminDashboard";
import { AdminLogin } from "./AdminLogin";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdminCategories, getAdminProducts } from "@/lib/admin-data";
import { getAdminNotificationSettings } from "@/lib/admin-notification-settings";
import { getAdminOrder } from "@/lib/admin-orders";
import { getAdminMessage } from "@/lib/admin-messages";
import { getAdminCateringRequest } from "@/lib/admin-catering";
import { getAdminUsers } from "@/lib/admin-users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yönetim Paneli",
  robots: { index: false, follow: false },
};

const adminViews = new Set<AdminView>(["analytics", "products", "categories", "orders", "messages", "catering", "users", "notifications"]);

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; item?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) return <AdminLogin />;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const siteBaseUrl = (process.env.NEXT_PUBLIC_SITE_URL || (host ? `${protocol}://${host}` : "http://localhost:3000"))
    .replace(/\/+$/, "");

  const query = await searchParams;
  const requestedView = query.view as AdminView;
  const initialView = adminViews.has(requestedView) ? requestedView : "products";
  const parsedItemId = Number(query.item);
  const itemId = Number.isInteger(parsedItemId) && parsedItemId > 0 ? parsedItemId : null;

  const [
    productPage,
    categories,
    notificationSettings,
    adminUsers,
    selectedOrder,
    selectedMessage,
    selectedCatering,
  ] = await Promise.all([
    getAdminProducts(),
    getAdminCategories(),
    getAdminNotificationSettings(),
    getAdminUsers(),
    initialView === "orders" && itemId ? getAdminOrder(itemId) : Promise.resolve(null),
    initialView === "messages" && itemId ? getAdminMessage(itemId) : Promise.resolve(null),
    initialView === "catering" && itemId ? getAdminCateringRequest(itemId) : Promise.resolve(null),
  ]);

  return (
    <AdminDashboard
      adminId={admin.id}
      adminName={admin.name}
      adminEmail={admin.email}
      initialProductPage={productPage}
      categories={categories}
      initialNotificationSettings={notificationSettings}
      dailySummaryCronUrl={`${siteBaseUrl}/api/cron/daily-summary`}
      initialUsers={adminUsers}
      initialView={initialView}
      initialSelectedOrder={selectedOrder}
      initialSelectedMessage={selectedMessage}
      initialSelectedCatering={selectedCatering}
    />
  );
}
