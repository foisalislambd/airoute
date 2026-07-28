"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/shared/components/ThemeToggle";
import { cn } from "@/shared/utils/cn";

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

function BrandPanel({ className = "" }: { className?: string }) {
  const t = useTranslations("auth");

  const features = [
    t("featureMultiProviderTitle"),
    t("featureLoadBalancingTitle"),
    t("featureUsageTrackingTitle"),
  ];

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden bg-brand-950 px-8 py-12 text-center sm:px-10",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-500/35 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-brand-600/25 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-400/10 blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-xl font-bold text-white shadow-lg shadow-brand-500/25 sm:h-16 sm:w-16 sm:text-2xl">
          A
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          AIRoute
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-brand-100/90 sm:text-base">
          {t("unifiedAiApiProxyDesc")}
        </p>
        <ul className="mt-8 space-y-3 text-left text-sm text-brand-100/85">
          {features.map((item) => (
            <li key={item} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/30 text-xs text-brand-200">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);
  const [setupComplete, setSetupComplete] = useState(null);
  const [oidcEnabled, setOidcEnabled] = useState<boolean | null>(null);
  const [nodeVersion, setNodeVersion] = useState(null);
  const [nodeCompatible, setNodeCompatible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      try {
        const res = await fetch(`${baseUrl}/api/settings/require-login`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.nodeVersion) setNodeVersion(data.nodeVersion);
          if (data.nodeCompatible === false) setNodeCompatible(false);
          if (data.requireLogin === false) {
            router.push("/dashboard");
            router.refresh();
            return;
          }
          setHasPassword(!!data.hasPassword);
          setSetupComplete(!!data.setupComplete);
          setOidcEnabled(!!data.oidcEnabled);
        } else {
          setHasPassword(true);
          setSetupComplete(true);
          setOidcEnabled(false);
        }
      } catch {
        clearTimeout(timeoutId);
        setHasPassword(true);
        setSetupComplete(true);
        setOidcEnabled(false);
      }
    }
    void checkAuth();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        sessionStorage.setItem("airoute_login_time", String(Date.now()));
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        if (data.needsSetup) {
          router.push("/dashboard/onboarding");
          return;
        }
        setError(data.error || t("invalidPassword"));
      }
    } catch {
      setError(t("errorOccurredRetry"));
    } finally {
      setLoading(false);
    }
  };

  const nodeWarning =
    !nodeCompatible && nodeVersion ? (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-left dark:border-red-500/30 dark:bg-red-500/10">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          {t("nodeIncompatibleTitle")}
        </p>
        <p className="mt-1 text-sm text-red-600/90 dark:text-red-200/80">
          {t("nodeIncompatibleDesc", { version: nodeVersion })}
        </p>
        <code className="mt-3 block rounded-lg bg-white/80 px-3 py-2 font-mono text-xs text-amber-700 dark:bg-black/30 dark:text-amber-300">
          nvm install 22 && nvm use 22
        </code>
      </div>
    ) : null;

  if (hasPassword === null || setupComplete === null || oidcEnabled === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <span className="text-sm text-gray-500">{t("loading")}</span>
        </div>
      </div>
    );
  }

  const setupCard = (opts: {
    title: string;
    subtitle: string;
    body: string;
    cta: string;
    icon: string;
  }) => (
    <div className="relative grid min-h-dvh w-full bg-white dark:bg-gray-950 lg:grid-cols-2">
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <div className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10 lg:px-14">
        <div className="mx-auto w-full max-w-[400px]">
          {nodeWarning}
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-base font-bold text-white lg:hidden">
            A
          </div>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <span className="material-symbols-outlined text-[28px]">{opts.icon}</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {opts.title}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{opts.subtitle}</p>
          <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{opts.body}</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/onboarding")}
            className="mt-8 flex h-11 w-full items-center justify-center rounded-lg bg-brand-500 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            {opts.cta}
          </button>
        </div>
      </div>
      <BrandPanel className="hidden min-h-dvh lg:flex" />
    </div>
  );

  if (!hasPassword && !setupComplete) {
    return setupCard({
      title: t("welcome"),
      subtitle: t("configureInstance"),
      body: t("runOnboardingWizard"),
      cta: t("startOnboarding"),
      icon: "rocket_launch",
    });
  }

  if (!hasPassword && setupComplete) {
    return setupCard({
      title: t("secureYourInstance"),
      subtitle: t("passwordNotEnabled"),
      body: t("setPasswordDescription"),
      cta: t("configurePassword"),
      icon: "shield_person",
    });
  }

  return (
    <div className="relative grid min-h-dvh w-full bg-white dark:bg-gray-950 lg:grid-cols-2">
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>

      <div className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-16">
        <div className="mx-auto w-full max-w-[400px]">
          {nodeWarning}

          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-base font-bold text-white lg:hidden">
            A
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-[1.75rem]">
            {t("signIn")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            {t("enterPassword")}
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="airoute-password"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t("password")}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 material-symbols-outlined text-[18px] text-gray-400">
                  lock
                </span>
                <input
                  id="airoute-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("enterPassword")}
                  className={cn(fieldClass, "pl-10 pr-11")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-300"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {error && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-red-500" role="alert">
                  <span className="material-symbols-outlined text-base">error</span>
                  {error}
                </p>
              )}
              <p className="mt-1.5 text-xs text-gray-400">{t("defaultPasswordHint")}</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-brand-500 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t("loading") : t("continue")}
            </button>
          </form>

          {oidcEnabled && (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/auth/oidc/login";
              }}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/5"
            >
              {t("continueWithOidc") || "Continue with OIDC"}
            </button>
          )}

          <div className="mt-8 border-t border-gray-100 pt-6 dark:border-gray-800">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-gray-500 transition hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-300"
            >
              {t("forgotPassword")}
            </Link>
          </div>
        </div>
      </div>

      <BrandPanel className="hidden min-h-dvh lg:flex" />
    </div>
  );
}
