"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const visitorStorageKey = "bonj-analytics-visitor";
const sessionStorageKey = "bonj-analytics-session";
const sessionDurationKey = "bonj-analytics-session-duration";

function storedIdentifier(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  storage.setItem(key, created);
  return created;
}

function sendAnalytics(payload: Record<string, unknown>, beacon = false) {
  const serialized = JSON.stringify(payload);
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/track", new Blob([serialized], { type: "application/json" }));
    return;
  }
  void fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: serialized,
    keepalive: true,
  }).catch(() => undefined);
}

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;

    let visitorId: string;
    let sessionId: string;
    try {
      visitorId = storedIdentifier(localStorage, visitorStorageKey);
      sessionId = storedIdentifier(sessionStorage, sessionStorageKey);
    } catch {
      return;
    }

    const viewId = crypto.randomUUID();
    let pageActiveSeconds = 0;
    let sessionActiveSeconds = Number(sessionStorage.getItem(sessionDurationKey) ?? 0) || 0;
    let lastActiveAt: number | null = document.visibilityState === "visible" ? Date.now() : null;
    let sentLeave = false;
    const basePayload = {
      visitorId,
      sessionId,
      viewId,
      path: pathname,
    };

    sendAnalytics({
      ...basePayload,
      event: "pageview",
      title: document.title,
      referrer: document.referrer,
    });

    const captureActiveTime = () => {
      if (lastActiveAt === null) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - lastActiveAt) / 1000));
      pageActiveSeconds += elapsed;
      sessionActiveSeconds += elapsed;
      lastActiveAt = Date.now();
      sessionStorage.setItem(sessionDurationKey, String(sessionActiveSeconds));
    };

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      captureActiveTime();
      sendAnalytics({
        ...basePayload,
        event: "heartbeat",
        pageDurationSeconds: pageActiveSeconds,
        sessionDurationSeconds: sessionActiveSeconds,
      });
    }, 15_000);

    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") {
        captureActiveTime();
        lastActiveAt = null;
      } else {
        lastActiveAt = Date.now();
      }
    };
    document.addEventListener("visibilitychange", visibilityChanged);

    const leave = () => {
      if (sentLeave) return;
      sentLeave = true;
      captureActiveTime();
      sendAnalytics({
        ...basePayload,
        event: "leave",
        pageDurationSeconds: pageActiveSeconds,
        sessionDurationSeconds: sessionActiveSeconds,
      }, true);
    };
    window.addEventListener("pagehide", leave);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", visibilityChanged);
      leave();
    };
  }, [pathname]);

  return null;
}
