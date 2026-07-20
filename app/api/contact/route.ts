import { and, count, eq, gte } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import { contactMessages } from "@/db/schema";
import {
  reportNotificationError,
  sendConfiguredAdminNotification,
} from "@/lib/admin-notifications";

const topics = new Set(["collaboration", "question", "suggestion", "complaint"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const topicLabels: Record<string, string> = {
  collaboration: "iş birliği",
  question: "soru",
  suggestion: "öneri",
  complaint: "şikâyet",
};

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 415 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (clean(body.website, 200)) {
      return NextResponse.json({ ok: true, reference: "BONJ-ALINDI" });
    }

    const topic = clean(body.topic, 32);
    const fullName = clean(body.fullName, 120);
    const email = clean(body.email, 180).toLocaleLowerCase("tr-TR");
    const phone = clean(body.phone, 32);
    const company = clean(body.company, 120);
    const message = clean(body.message, 5000);

    if (!topics.has(topic)) throw new Error("Lütfen bir konu seçin.");
    if (fullName.length < 2) throw new Error("Adınızı ve soyadınızı yazın.");
    if (!emailPattern.test(email)) throw new Error("Geçerli bir e-posta adresi yazın.");
    if (message.length < 20) throw new Error("Mesajınız en az 20 karakter olmalı.");
    if (body.consent !== true) throw new Error("İletişim iznini onaylamalısınız.");

    const db = getDb();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const [recent] = await db
      .select({ value: count(contactMessages.id) })
      .from(contactMessages)
      .where(
        and(
          eq(contactMessages.email, email),
          gte(contactMessages.createdAt, tenMinutesAgo),
        ),
      );
    if (Number(recent?.value ?? 0) >= 3) {
      return NextResponse.json(
        { error: "Çok kısa sürede çok sayıda mesaj gönderdiniz. Lütfen biraz bekleyin." },
        { status: 429 },
      );
    }

    const [saved] = await db
      .insert(contactMessages)
      .values({
        topic,
        fullName,
        email,
        phone: phone || null,
        company: company || null,
        message,
        consent: true,
      })
      .returning({ id: contactMessages.id });

    after(async () => {
      try {
        await sendConfiguredAdminNotification({
          type: "contact",
          request,
          itemId: saved.id,
          message: `BONJ | Yeni ${topicLabels[topic]} mesajı. Gönderen: ${fullName}.`,
        });
      } catch (error) {
        reportNotificationError("contact", error);
      }
    });

    return NextResponse.json(
      { ok: true, reference: `BONJ-${String(saved.id).padStart(5, "0")}` },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mesajınız gönderilemedi." },
      { status: 400 },
    );
  }
}
