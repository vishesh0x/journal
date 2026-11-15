import { useEffect, useState } from "react";

export function ThemeToggle({ defaultMode = "system" }: { defaultMode?: "system" | "light" | "dark" }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("journal-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    // Precedence: the visitor's own choice (localStorage) always wins.
    // Otherwise fall back to the site owner's configured default, and
    // only fall back to the OS preference when that default is "system".
    const isDark = stored ? stored === "dark" : defaultMode === "system" ? prefers : defaultMode === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, [defaultMode]);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("journal-theme", next ? "dark" : "light");
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={dark} className="nav-btn">
      {dark ? "Light" : "Dark"}
    </button>
  );
}
