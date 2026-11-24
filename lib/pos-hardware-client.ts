import type {
  SavedMonitorSnapshot,
  SavedPrinterSnapshot,
} from "@/lib/pos-hardware";

export const LOCAL_POS_BRIDGE_URL = "http://127.0.0.1:4895";

export type LocalBridgeHardwareState = {
  ok: boolean;
  hostname?: string;
  os?: string;
  monitors: SavedMonitorSnapshot[];
  printers: SavedPrinterSnapshot[];
  config: {
    cashierScreenIndex: number;
    customerScreenIndex: number;
    cashierPrinterName: string;
    kitchenPrinterName: string;
    paperWidthMm: 58 | 80;
    swapScreens?: boolean;
  };
};

export type LocalReceiptPrintPayload = {
  target: "cashier" | "kitchen";
  printerName?: string;
  paperWidthMm?: 58 | 80;
  tableZone: string;
  tableName: string;
  openedAt: string;
  closedAt: string | null;
  guestCount: number;
  customerName: string | null;
  note: string | null;
  paymentMethod: string | null;
  subtotalInKurus: number;
  discountInKurus: number;
  totalInKurus: number;
  items: Array<{
    productName: string;
    quantity: number;
    unitPriceInKurus: number;
    lineTotalInKurus: number;
    note?: string | null;
  }>;
};

async function bridgeRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 3000);
  try {
    const res = await fetch(`${LOCAL_POS_BRIDGE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      throw new Error(data.error || `Kasa ajanı hatası (${res.status})`);
    }
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchLocalBridgeHardware(): Promise<LocalBridgeHardwareState | null> {
  try {
    return await bridgeRequest<LocalBridgeHardwareState>("/hardware", { timeoutMs: 2200 });
  } catch {
    return null;
  }
}

export async function saveLocalBridgeConfig(config: {
  cashierScreenIndex: number;
  customerScreenIndex: number;
  cashierPrinterName: string;
  kitchenPrinterName: string;
  paperWidthMm: 58 | 80;
}): Promise<boolean> {
  try {
    await bridgeRequest("/config", { method: "POST", body: config, timeoutMs: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function applyLocalBridgeScreens(): Promise<{ ok: boolean; error?: string }> {
  try {
    await bridgeRequest("/screens/apply", { method: "POST", body: {}, timeoutMs: 6000 });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ekranlar yerleştirilemedi.",
    };
  }
}

export async function sendLocalBridgeTestPrint(payload: {
  target: "cashier" | "kitchen";
  printerName?: string;
  paperWidthMm?: 58 | 80;
}): Promise<{ ok: boolean; error?: string; printerName?: string }> {
  try {
    const res = await bridgeRequest<{ ok: boolean; printerName?: string }>("/print/test", {
      method: "POST",
      body: payload,
      timeoutMs: 9000,
    });
    return { ok: true, printerName: res.printerName };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Test yazdırma başarısız.",
    };
  }
}

export async function sendLocalBridgeReceiptPrint(
  payload: LocalReceiptPrintPayload,
): Promise<{ ok: boolean; error?: string; printerName?: string }> {
  try {
    const res = await bridgeRequest<{ ok: boolean; printerName?: string }>("/print/receipt", {
      method: "POST",
      body: payload,
      timeoutMs: 9000,
    });
    return { ok: true, printerName: res.printerName };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fiş yazdırılamadı.",
    };
  }
}

export async function addLocalBridgeNetworkPrinter(payload: {
  name: string;
  host: string;
  port?: number;
  assignRole?: "kitchen" | "cashier";
}): Promise<{ ok: boolean; error?: string; connected?: boolean; name?: string }> {
  try {
    const res = await bridgeRequest<{
      ok: boolean;
      connected?: boolean;
      printer?: { name: string; host: string; port: number };
    }>("/printers/network", {
      method: "POST",
      body: payload,
      timeoutMs: 5000,
    });
    return {
      ok: true,
      connected: Boolean(res.connected),
      name: res.printer?.name ?? payload.name,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ağ yazıcısı eklenemedi.",
    };
  }
}
