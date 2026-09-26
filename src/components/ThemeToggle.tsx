"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ initial }: { initial: "light" | "dark" }) {
  const [theme, setTheme] = useState(initial);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.cookie = `fin_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  };
  return (
    <div className="side-foot">
      <button onClick={toggle} aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
      </button>
    </div>
  );
}
