"use client";

import type { ReactNode } from "react";
import ThemeToggle from "../ThemeToggle";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="app-shell relative flex min-h-dvh flex-col overflow-x-hidden bg-gray-50 transition-colors duration-300 selection:bg-brand-500/20 selection:text-brand-600 dark:bg-gray-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-brand-50),_transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(70,95,255,0.12),_transparent_55%)]" />

      <div className="absolute top-6 right-6 z-20">
        <ThemeToggle variant="card" />
      </div>

      <main className="relative z-10 flex h-full w-full flex-1 flex-col items-center justify-center p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
