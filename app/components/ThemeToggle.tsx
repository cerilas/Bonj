"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const storageKey = "bonj-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(storageKey, next);
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
      <span aria-hidden="true">{isDark ? "☼" : "☾"}</span>
      <b>{isDark ? "Açık" : "Koyu"}</b>
    </button>
  );
}
