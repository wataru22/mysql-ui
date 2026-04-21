import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "mysql-ui-theme";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function subscribeDocumentDark(callback: () => void) {
  const obs = new MutationObserver(callback);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => {
    obs.disconnect();
    mq.removeEventListener("change", callback);
  };
}

function snapshotDocumentDark() {
  return document.documentElement.classList.contains("dark");
}

/** Matches the active UI theme via `<html class="dark">` (same source as `applyTheme`). */
export function useResolvedTheme(): "light" | "dark" {
  const dark = useSyncExternalStore(subscribeDocumentDark, snapshotDocumentDark, () => false);
  return dark ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? "system";
  });

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
    applyTheme(t);
  }, []);

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return { theme, setTheme } as const;
}
