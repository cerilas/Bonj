import { getDb } from "@/db";
import { notificationSettings } from "@/db/schema";
import { inArray } from "drizzle-orm";

export const notificationTypes = [
  "orders",
  "contact",
  "catering",
  "dailySummary",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export type AdminNotificationSettings = Record<NotificationType, string[]>;

export const emptyNotificationSettings: AdminNotificationSettings = {
  orders: [],
  contact: [],
  catering: [],
  dailySummary: [],
};

export async function getAdminNotificationSettings(): Promise<AdminNotificationSettings> {
  const db = getDb();
  const rows = await db
    .select({
      notificationType: notificationSettings.notificationType,
      phoneNumber: notificationSettings.phoneNumber,
    })
    .from(notificationSettings);

  return rows.reduce<AdminNotificationSettings>((settings, row) => {
    if (
      row.phoneNumber
      && notificationTypes.includes(row.notificationType as NotificationType)
    ) {
      settings[row.notificationType as NotificationType].push(row.phoneNumber);
    }
    return settings;
  }, { orders: [], contact: [], catering: [], dailySummary: [] });
}

export async function saveAdminNotificationSettings(settings: AdminNotificationSettings) {
  const db = getDb();
  const now = new Date();

  await db.transaction(async (transaction) => {
    await transaction
      .delete(notificationSettings)
      .where(inArray(notificationSettings.notificationType, [...notificationTypes]));

    const values = notificationTypes.flatMap((notificationType) =>
      settings[notificationType].map((phoneNumber) => ({
        notificationType,
        phoneNumber,
        updatedAt: now,
      })),
    );
    if (values.length) {
      await transaction.insert(notificationSettings).values(values);
    }
  });
}
