export type CustomerDisplayItem = {
  productName: string;
  quantity: number;
  unitPriceInKurus: number;
  lineTotalInKurus: number;
};

export type CustomerDisplayState =
  | {
      mode: "idle";
      updatedAt: number;
    }
  | {
      mode: "checkout";
      sourceLabel: string;
      customerName: string | null;
      items: CustomerDisplayItem[];
      subtotalInKurus: number;
      discountInKurus: number;
      totalInKurus: number;
      paymentMethod: "cash" | "card" | "split" | "free" | null;
      cashTenderedInKurus: number;
      changeInKurus: number;
      splitCashInKurus: number;
      splitCardInKurus: number;
      updatedAt: number;
    }
  | {
      mode: "paid";
      sourceLabel: string;
      totalInKurus: number;
      paymentMethod: "cash" | "card" | "split" | "free";
      changeInKurus: number;
      itemCount: number;
      updatedAt: number;
    };

export const CUSTOMER_DISPLAY_CHANNEL = "bonj-customer-display";
export const CUSTOMER_DISPLAY_STORAGE_KEY = "bonj_customer_display_state";

export function publishCustomerDisplayState(state: CustomerDisplayState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOMER_DISPLAY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
  if ("BroadcastChannel" in window) {
    try {
      const ch = new BroadcastChannel(CUSTOMER_DISPLAY_CHANNEL);
      ch.postMessage(state);
      ch.close();
    } catch {
      // ignore channel errors
    }
  }
}

export function readCustomerDisplayState(): CustomerDisplayState {
  if (typeof window === "undefined") {
    return { mode: "idle", updatedAt: 0 };
  }
  try {
    const raw = window.localStorage.getItem(CUSTOMER_DISPLAY_STORAGE_KEY);
    if (!raw) return { mode: "idle", updatedAt: 0 };
    const parsed = JSON.parse(raw) as CustomerDisplayState;
    if (parsed && typeof parsed === "object" && "mode" in parsed) {
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return { mode: "idle", updatedAt: 0 };
}
