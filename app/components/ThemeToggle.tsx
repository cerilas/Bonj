"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { UiIcon } from "./UiIcon";

type Theme = "light" | "dark";

const storageKey = "bonj-theme";
const periodStorageKey = "bonj-theme-manual-period";

function getClockSchedule(): { theme: Theme; period: "day" | "night" } {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 19) {
    return { theme: "light", period: "day" };
  }
  return { theme: "dark", period: "night" };
}

function resolveCurrentTheme(pathname: string): Theme {
  const { theme: clockTheme, period } = getClockSchedule();
  if (pathname.startsWith("/musteri-ekrani")) {
    return clockTheme;
  }
  try {
    const manual = window.localStorage.getItem(storageKey);
    const manualPeriod = window.localStorage.getItem(periodStorageKey);
    if ((manual === "light" || manual === "dark") && manualPeriod === period) {
      return manual;
    }
  } catch {
    // ignore storage access issues
  }
  return clockTheme;
}

export function ThemeToggle() {
  const pathname = usePathname() || "";
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const applyTheme = () => {
      const next = resolveCurrentTheme(pathname);
      if (document.documentElement.dataset.theme !== next) {
        document.documentElement.dataset.theme = next;
      }
      setTheme(next);
    };

    const rafId = window.requestAnimationFrame(applyTheme);
    const timer = window.setInterval(applyTheme, 30_000);
    const onWake = () => {
      if (document.visibilityState === "visible") applyTheme();
    };

    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [pathname]);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    const { period } = getClockSchedule();
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(storageKey, next);
      window.localStorage.setItem(periodStorageKey, period);
    } catch {
      // ignore
    }
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      aria-pressed={isDark}
      title={isDark ? "Açık tema" : "Koyu tema"}
    >
      <span aria-hidden="true"><UiIcon name={isDark ? "sun" : "moon"} /></span>
      <b>{isDark ? "Açık" : "Koyu"}</b>
    </button>
  );
}
