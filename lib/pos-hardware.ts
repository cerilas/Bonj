import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { posHardwareSettings } from "@/db/schema";

export type SavedMonitorSnapshot = {
  index: number;
  deviceName: string;
  primary: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
  label: string;
};

export type SavedPrinterSnapshot = {
  name: string;
  isDefault: boolean;
  portName: string;
  driverName: string;
  isOnline: boolean;
  statusText: string;
  isThermalLikely: boolean;
};

export type PosHardwareSettingsDTO = {
  terminalKey: string;
  cashierScreenIndex: number;
  customerScreenIndex: number;
  cashierPrinterName: string;
  kitchenPrinterName: string;
  paperWidthMm: 58 | 80;
  autoPrintCashierOnClose: boolean;
  autoPrintKitchenOnOrder: boolean;
  lastAgentSyncAt: string | null;
  lastKnownMonitors: SavedMonitorSnapshot[];
  lastKnownPrinters: SavedPrinterSnapshot[];
  updatedAt: string | null;
};

let hardwareTableReady = false;

async function ensurePosHardwareTable() {
  if (hardwareTableReady) return;
  const db = getDb();
  await db.execute(sql`
    create table if not exists pos_hardware_settings (
      id serial primary key,
      terminal_key varchar(40) not null default 'main',
      cashier_screen_index integer not null default 0,
      customer_screen_index integer not null default 1,
      cashier_printer_name varchar(160),
      kitchen_printer_name varchar(160),
      paper_width_mm integer not null default 80,
      auto_print_cashier_on_close boolean not null default true,
      auto_print_kitchen_on_order boolean not null default false,
      last_agent_sync_at timestamptz,
      last_known_monitors_json text,
      last_known_printers_json text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await db.execute(sql`
    create unique index if not exists pos_hardware_settings_terminal_uidx
    on pos_hardware_settings (terminal_key)
  `);
  hardwareTableReady = true;
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function getPosHardwareSettings(terminalKey = "main"): Promise<PosHardwareSettingsDTO> {
  await ensurePosHardwareTable();
  const db = getDb();
  let [row] = await db
    .select()
    .from(posHardwareSettings)
    .where(eq(posHardwareSettings.terminalKey, terminalKey))
    .limit(1);

  if (!row) {
    [row] = await db
      .insert(posHardwareSettings)
      .values({ terminalKey })
      .onConflictDoNothing({ target: posHardwareSettings.terminalKey })
      .returning();

    if (!row) {
      [row] = await db
        .select()
        .from(posHardwareSettings)
        .where(eq(posHardwareSettings.terminalKey, terminalKey))
        .limit(1);
    }
  }

  return {
    terminalKey: row.terminalKey,
    cashierScreenIndex: row.cashierScreenIndex,
    customerScreenIndex: row.customerScreenIndex,
    cashierPrinterName: row.cashierPrinterName ?? "",
    kitchenPrinterName: row.kitchenPrinterName ?? "",
    paperWidthMm: row.paperWidthMm === 58 ? 58 : 80,
    autoPrintCashierOnClose: row.autoPrintCashierOnClose,
    autoPrintKitchenOnOrder: row.autoPrintKitchenOnOrder,
    lastAgentSyncAt: row.lastAgentSyncAt ? row.lastAgentSyncAt.toISOString() : null,
    lastKnownMonitors: parseJsonArray<SavedMonitorSnapshot>(row.lastKnownMonitorsJson),
    lastKnownPrinters: parseJsonArray<SavedPrinterSnapshot>(row.lastKnownPrintersJson),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

export async function savePosHardwareSettings(input: {
  terminalKey?: string;
  cashierScreenIndex?: number;
  customerScreenIndex?: number;
  cashierPrinterName?: string | null;
  kitchenPrinterName?: string | null;
  paperWidthMm?: number;
  autoPrintCashierOnClose?: boolean;
  autoPrintKitchenOnOrder?: boolean;
  lastKnownMonitors?: SavedMonitorSnapshot[];
  lastKnownPrinters?: SavedPrinterSnapshot[];
  agentSynced?: boolean;
}): Promise<PosHardwareSettingsDTO> {
  await ensurePosHardwareTable();
  const db = getDb();
  const terminalKey = (input.terminalKey || "main").trim().slice(0, 40) || "main";
  const current = await getPosHardwareSettings(terminalKey);

  const cashierScreenIndex =
    typeof input.cashierScreenIndex === "number" && Number.isInteger(input.cashierScreenIndex) && input.cashierScreenIndex >= 0
      ? input.cashierScreenIndex
      : current.cashierScreenIndex;
  const customerScreenIndex =
    typeof input.customerScreenIndex === "number" && Number.isInteger(input.customerScreenIndex) && input.customerScreenIndex >= 0
      ? input.customerScreenIndex
      : current.customerScreenIndex;

  const cashierPrinterName =
    input.cashierPrinterName !== undefined
      ? (String(input.cashierPrinterName ?? "").trim().slice(0, 160) || null)
      : (current.cashierPrinterName || null);

  const kitchenPrinterName =
    input.kitchenPrinterName !== undefined
      ? (String(input.kitchenPrinterName ?? "").trim().slice(0, 160) || null)
      : (current.kitchenPrinterName || null);

  const paperWidthMm = input.paperWidthMm === 58 ? 58 : input.paperWidthMm === 80 ? 80 : current.paperWidthMm;
  const autoPrintCashierOnClose =
    typeof input.autoPrintCashierOnClose === "boolean"
      ? input.autoPrintCashierOnClose
      : current.autoPrintCashierOnClose;
  const autoPrintKitchenOnOrder =
    typeof input.autoPrintKitchenOnOrder === "boolean"
      ? input.autoPrintKitchenOnOrder
      : current.autoPrintKitchenOnOrder;

  const now = new Date();
  const monitorsJson =
    input.lastKnownMonitors !== undefined
      ? JSON.stringify(input.lastKnownMonitors.slice(0, 8))
      : undefined;
  const printersJson =
    input.lastKnownPrinters !== undefined
      ? JSON.stringify(input.lastKnownPrinters.slice(0, 30))
      : undefined;

  await db
    .update(posHardwareSettings)
    .set({
      cashierScreenIndex,
      customerScreenIndex,
      cashierPrinterName,
      kitchenPrinterName,
      paperWidthMm,
      autoPrintCashierOnClose,
      autoPrintKitchenOnOrder,
      ...(monitorsJson !== undefined ? { lastKnownMonitorsJson: monitorsJson } : {}),
      ...(printersJson !== undefined ? { lastKnownPrintersJson: printersJson } : {}),
      ...(input.agentSynced ? { lastAgentSyncAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(posHardwareSettings.terminalKey, terminalKey));

  return getPosHardwareSettings(terminalKey);
}
