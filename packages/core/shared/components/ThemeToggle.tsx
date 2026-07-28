"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";

export default function ThemeToggle({
  className,
  variant = "default",
}: {
  className?: any;
  variant?: string;
}) {
  const { toggleTheme, isDark } = useTheme();
  const t = useTranslations("header");
  const toggleLabel = isDark ? t("switchToLightMode") : t("switchToDarkMode");

  const variants = {
    default: cn(
      "flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition",
      "hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30",
      "dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5"
    ),
    card: cn(
      "flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition",
      "hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30",
      "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
    ),
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(variants[variant] || variants.default, className)}
      aria-label={toggleLabel}
      title={toggleLabel}
    >
      <span className="material-symbols-outlined text-[20px]">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
