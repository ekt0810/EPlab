"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const key = "ep-lab-theme";
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const sync = () =>
      setTheme(
        document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      );
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(key);
      } catch {}
      document.documentElement.dataset.theme =
        saved === "light" || saved === "dark"
          ? saved
          : media.matches
            ? "dark"
            : "light";
      sync();
    };
    sync();
    window.addEventListener("storage", update);
    media.addEventListener("change", update);
    return () => {
      window.removeEventListener("storage", update);
      media.removeEventListener("change", update);
    };
  }, []);
  function choose(value: Theme) {
    document.documentElement.dataset.theme = value;
    setTheme(value);
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
  return (
    <div className="theme-switch" role="group" aria-label="Chế độ giao diện">
      <button
        type="button"
        aria-label="Chế độ sáng"
        aria-pressed={theme === "light"}
        title="Chế độ sáng"
        onClick={() => choose("light")}
      >
        <Sun size={16} />
        <span>Sáng</span>
      </button>
      <button
        type="button"
        aria-label="Chế độ tối"
        aria-pressed={theme === "dark"}
        title="Chế độ tối"
        onClick={() => choose("dark")}
      >
        <Moon size={16} />
        <span>Tối</span>
      </button>
    </div>
  );
}
