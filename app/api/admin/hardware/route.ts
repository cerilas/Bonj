import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import {
  getPosHardwareSettings,
  savePosHardwareSettings,
  type SavedMonitorSnapshot,
  type SavedPrinterSnapshot,
} from "@/lib/pos-hardware";
import { getTableOperator } from "@/lib/staff-auth";

export async function GET() {
  try {
    if (!(await getTableOperator())) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
    const settings = await getPosHardwareSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[admin/hardware] Donanım ayarları alınamadı.", error);
    return NextResponse.json(
      { error: "Donanım ayarları alınamadı." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await getCurrentAdmin())) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as {
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
    };

    const settings = await savePosHardwareSettings({
      cashierScreenIndex:
        typeof body.cashierScreenIndex === "number" ? body.cashierScreenIndex : undefined,
      customerScreenIndex:
        typeof body.customerScreenIndex === "number" ? body.customerScreenIndex : undefined,
      cashierPrinterName:
        body.cashierPrinterName !== undefined ? body.cashierPrinterName : undefined,
      kitchenPrinterName:
        body.kitchenPrinterName !== undefined ? body.kitchenPrinterName : undefined,
      paperWidthMm:
        typeof body.paperWidthMm === "number" ? body.paperWidthMm : undefined,
      autoPrintCashierOnClose:
        typeof body.autoPrintCashierOnClose === "boolean"
          ? body.autoPrintCashierOnClose
          : undefined,
      autoPrintKitchenOnOrder:
        typeof body.autoPrintKitchenOnOrder === "boolean"
          ? body.autoPrintKitchenOnOrder
          : undefined,
      lastKnownMonitors: Array.isArray(body.lastKnownMonitors)
        ? body.lastKnownMonitors
        : undefined,
      lastKnownPrinters: Array.isArray(body.lastKnownPrinters)
        ? body.lastKnownPrinters
        : undefined,
      agentSynced: Boolean(body.agentSynced),
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error("[admin/hardware] Donanım ayarları kaydedilemedi.", error);
    return NextResponse.json(
      { error: "Donanım ayarları kaydedilemedi." },
      { status: 500 },
    );
  }
}
