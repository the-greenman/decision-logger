import { useEffect, useState } from "react";

interface ThemeToggleProps {
  dark?: boolean; // true when sitting inside a dark header
}

export function ThemeToggle({ dark: inDarkHeader = false }: ThemeToggleProps) {
  const [darkTheme, setDarkTheme] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkTheme) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkTheme]);

  return (
    <button
      onClick={() => setDarkTheme((d) => !d)}
      className="font-mono text-xs uppercase tracking-widest px-2 py-1 border"
      style={
        inDarkHeader
          ? { color: "var(--nav-text-dim)", borderColor: "var(--nav-border)" }
          : { color: "var(--color-text-muted)", borderColor: "var(--color-border)" }
      }
      aria-label="Toggle light/dark theme"
    >
      {darkTheme ? "light" : "dark"}
    </button>
  );
}
