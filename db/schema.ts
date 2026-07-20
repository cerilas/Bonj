import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    description: text("description"),
    imageAlt: varchar("image_alt", { length: 180 }),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("categories_slug_uidx").on(table.slug)],
);

export const categoryImages = pgTable(
  "category_images",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    data: bytea("data").notNull(),
    mimeType: varchar("mime_type", { length: 48 }).notNull(),
    sizeInBytes: integer("size_in_bytes").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("category_images_category_uidx").on(table.categoryId),
  ],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    slug: varchar("slug", { length: 96 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    longDescription: text("long_description"),
    allergenInfo: text("allergen_info"),
    estimatedCalories: integer("estimated_calories"),
    imageAlt: varchar("image_alt", { length: 180 }),
    priceInKurus: integer("price_in_kurus"),
    badge: varchar("badge", { length: 40 }),
    accent: varchar("accent", { length: 24 }).notNull().default("cream"),
    sortOrder: integer("sort_order").notNull().default(0),
    isFeatured: boolean("is_featured").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("menu_items_slug_uidx").on(table.slug),
    index("menu_items_category_idx").on(table.categoryId),
    index("menu_items_active_sort_idx").on(table.isActive, table.sortOrder),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    data: bytea("data").notNull(),
    mimeType: varchar("mime_type", { length: 48 }).notNull(),
    sizeInBytes: integer("size_in_bytes").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("product_images_menu_item_uidx").on(table.menuItemId),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNumber: varchar("order_number", { length: 40 }).notNull(),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    fulfillmentType: varchar("fulfillment_type", { length: 24 }).notNull(),
    tableNumber: varchar("table_number", { length: 20 }),
    pickupAt: timestamp("pickup_at", { withTimezone: true }),
    note: text("note"),
    status: varchar("status", { length: 24 }).notNull().default("new"),
    totalInKurus: integer("total_in_kurus").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_order_number_uidx").on(table.orderNumber),
    index("orders_status_created_idx").on(table.status, table.createdAt),
    index("orders_phone_created_idx").on(table.phone, table.createdAt),
    index("orders_pickup_at_idx").on(table.pickupAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    menuItemId: integer("menu_item_id")
      .references(() => menuItems.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 120 }).notNull(),
    unitPriceInKurus: integer("unit_price_in_kurus").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalInKurus: integer("line_total_in_kurus").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    index("order_items_menu_item_idx").on(table.menuItemId),
  ],
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull().default("Yönetici"),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("admin_users_email_uidx").on(table.email)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("admin_sessions_token_uidx").on(table.tokenHash),
    index("admin_sessions_user_idx").on(table.userId),
    index("admin_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const analyticsVisitors = pgTable(
  "analytics_visitors",
  {
    visitorKey: varchar("visitor_key", { length: 64 }).primaryKey(),
    country: varchar("country", { length: 8 }),
    region: varchar("region", { length: 120 }),
    city: varchar("city", { length: 120 }),
    deviceType: varchar("device_type", { length: 24 }).notNull().default("unknown"),
    browser: varchar("browser", { length: 40 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("analytics_visitors_last_seen_idx").on(table.lastSeenAt)],
);

export const analyticsSessions = pgTable(
  "analytics_sessions",
  {
    id: serial("id").primaryKey(),
    sessionKey: varchar("session_key", { length: 64 }).notNull(),
    visitorKey: varchar("visitor_key", { length: 64 })
      .notNull()
      .references(() => analyticsVisitors.visitorKey, { onDelete: "cascade" }),
    entryPath: varchar("entry_path", { length: 500 }).notNull(),
    exitPath: varchar("exit_path", { length: 500 }).notNull(),
    referrerHost: varchar("referrer_host", { length: 180 }),
    country: varchar("country", { length: 8 }),
    region: varchar("region", { length: 120 }),
    city: varchar("city", { length: 120 }),
    deviceType: varchar("device_type", { length: 24 }).notNull().default("unknown"),
    browser: varchar("browser", { length: 40 }),
    pageViewCount: integer("page_view_count").notNull().default(1),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("analytics_sessions_key_uidx").on(table.sessionKey),
    index("analytics_sessions_started_idx").on(table.startedAt),
    index("analytics_sessions_visitor_idx").on(table.visitorKey),
    index("analytics_sessions_location_idx").on(table.country, table.region, table.city),
  ],
);

export const analyticsPageViews = pgTable(
  "analytics_page_views",
  {
    id: serial("id").primaryKey(),
    viewKey: varchar("view_key", { length: 64 }).notNull(),
    sessionKey: varchar("session_key", { length: 64 })
      .notNull()
      .references(() => analyticsSessions.sessionKey, { onDelete: "cascade" }),
    visitorKey: varchar("visitor_key", { length: 64 })
      .notNull()
      .references(() => analyticsVisitors.visitorKey, { onDelete: "cascade" }),
    path: varchar("path", { length: 500 }).notNull(),
    title: varchar("title", { length: 300 }),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("analytics_page_views_key_uidx").on(table.viewKey),
    index("analytics_page_views_viewed_idx").on(table.viewedAt),
    index("analytics_page_views_path_idx").on(table.path),
    index("analytics_page_views_session_idx").on(table.sessionKey),
    index("analytics_page_views_visitor_idx").on(table.visitorKey),
  ],
);

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    city: varchar("city", { length: 80 }).notNull().default("Gaziantep"),
    address: text("address"),
    mapsUrl: text("maps_url"),
    phone: varchar("phone", { length: 32 }),
    instagramUrl: text("instagram_url"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("locations_active_idx").on(table.isActive)],
);

export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: serial("id").primaryKey(),
    notificationType: varchar("notification_type", { length: 40 }).notNull(),
    phoneNumber: varchar("phone_number", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("notification_settings_type_phone_uidx").on(
      table.notificationType,
      table.phoneNumber,
    ),
    index("notification_settings_type_idx").on(table.notificationType),
  ],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: serial("id").primaryKey(),
    topic: varchar("topic", { length: 32 }).notNull(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    company: varchar("company", { length: 120 }),
    message: text("message").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("new"),
    consent: boolean("consent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("contact_messages_status_created_idx").on(table.status, table.createdAt),
    index("contact_messages_email_created_idx").on(table.email, table.createdAt),
  ],
);

export const cateringRequests = pgTable(
  "catering_requests",
  {
    id: serial("id").primaryKey(),
    requestNumber: varchar("request_number", { length: 40 }).notNull(),
    eventType: varchar("event_type", { length: 48 }).notNull(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    email: varchar("email", { length: 180 }),
    company: varchar("company", { length: 120 }),
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
    guestCount: integer("guest_count").notNull(),
    venueName: varchar("venue_name", { length: 180 }),
    venueAddress: text("venue_address").notNull(),
    venueSetting: varchar("venue_setting", { length: 24 }).notNull(),
    serviceStyle: varchar("service_style", { length: 32 }).notNull(),
    menuInterests: text("menu_interests").notNull(),
    dietaryNeeds: text("dietary_needs"),
    budgetRange: varchar("budget_range", { length: 32 }),
    preferredContact: varchar("preferred_contact", { length: 24 }).notNull(),
    notes: text("notes"),
    status: varchar("status", { length: 24 }).notNull().default("new"),
    consent: boolean("consent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("catering_requests_number_uidx").on(table.requestNumber),
    index("catering_requests_status_created_idx").on(table.status, table.createdAt),
    index("catering_requests_event_at_idx").on(table.eventAt),
    index("catering_requests_phone_created_idx").on(table.phone, table.createdAt),
  ],
);

export type Category = typeof categories.$inferSelect;
export type MenuItemRecord = typeof menuItems.$inferSelect;
export type ContactMessageRecord = typeof contactMessages.$inferSelect;
export type OrderRecord = typeof orders.$inferSelect;
export type CateringRequestRecord = typeof cateringRequests.$inferSelect;
export type NotificationSettingRecord = typeof notificationSettings.$inferSelect;
