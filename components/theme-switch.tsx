"use client";
import {t as ui,useLocale} from "@/lib/locale";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
type Theme = "system" | "light" | "dark";
export default function ThemeSwitch() {
  useLocale();
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("icpc-theme");
        if (["light", "dark", "system"].includes(saved || ""))
          return saved as Theme;
      }
    } catch {/* intentionally ignored */}
    return "system";
  });
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("icpc-theme", theme);
    } catch {/* intentionally ignored */}
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;
  return (
    <label className="theme-switch" title={ui("外观主题：{0}",[theme === "system" ? ui("跟随系统") : theme === "dark" ? ui("深色模式") : ui("浅色模式")])}>
      <Icon size={16} />
      <select
        aria-label={ui("外观主题")}
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
      >
        <option value="system">{ui("跟随系统")}</option>
        <option value="light">{ui("浅色模式")}</option>
        <option value="dark">{ui("深色模式")}</option>
      </select>
    </label>
  );
}
