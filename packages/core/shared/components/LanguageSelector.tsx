"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import { useLocale } from "next-intl";
import { persistLocale } from "@/shared/lib/persistLocale";

function CountryFlag({ emoji, alt }: { emoji: string; alt: string }) {
  const [error, setError] = useState(false);

  if (!emoji) return null;

  const chars = [...emoji];
  const codePoints = chars.map((c) => c.codePointAt(0) || 0);
  const isRegional = codePoints.every((cp) => cp >= 127462 && cp <= 127487);

  if (!isRegional || codePoints.length !== 2 || error) {
    return <span className="text-base leading-none shrink-0">{emoji}</span>;
  }

  const countryCode = codePoints.map((cp) => String.fromCharCode(cp - 127462 + 97)).join("");

  return (
    <img
      src={`https://flagcdn.com/w40/${countryCode}.png`}
      className="w-4.5 h-3 object-cover rounded-2xs shrink-0 shadow-2xs border border-black/5 dark:border-white/5"
      alt={alt}
      onError={() => setError(true)}
    />
  );
}

export default function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (code: Locale) => {
    if (code === locale) {
      setOpen(false);
      return;
    }

    persistLocale(code);
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        title={currentLang.name}
        aria-label={currentLang.name}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <CountryFlag emoji={currentLang.flag} alt={currentLang.name} />
        <span className="text-xs font-semibold tracking-wide">{currentLang.label}</span>
        <span
          className={`material-symbols-outlined text-[14px] text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={currentLang.name}
          className="absolute end-0 top-full z-50 mt-1 max-h-80 w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-150 dark:border-gray-700 dark:bg-gray-900"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="option"
              aria-selected={lang.code === locale}
              onClick={() => handleSelect(lang.code)}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                lang.code === locale
                  ? "bg-brand-50 font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                  : "text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <CountryFlag emoji={lang.flag} alt={lang.name} />
              <span className="flex-1 text-start">{lang.name}</span>
              {lang.code === locale && (
                <span className="material-symbols-outlined text-[16px] text-brand-500" aria-hidden="true">
                  check
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
