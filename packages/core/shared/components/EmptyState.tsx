"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/shared/utils/cn";

/**
 * EmptyState — ZenPanel-style empty placeholder for dashboard sections.
 */

interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: (() => void) | null;
  className?: string;
}

export default function EmptyState({
  icon = "inbox",
  title,
  description = "",
  actionLabel = "",
  onAction = null,
  className,
}: EmptyStateProps) {
  const t = useTranslations("common");
  const resolvedTitle = title ?? t("nothingHere");
  const usesMaterialSymbol = /^[a-z][a-z0-9_]*$/.test(icon);

  return (
    <div
      className={cn(
        "app-card flex flex-col items-center px-6 py-12 text-center sm:py-16",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5">
        {usesMaterialSymbol ? (
          <span className="material-symbols-outlined text-[28px] text-gray-400 dark:text-gray-500">
            {icon}
          </span>
        ) : (
          <span className="text-2xl" role="img" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">{resolvedTitle}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {description}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
