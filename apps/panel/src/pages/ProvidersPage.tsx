import { PanelPageHeader } from "@/components/layout/panel-page-header";
import { listProviders, type Provider } from "@/lib/api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listProviders()
      .then((result) => setProviders(result.providers))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div>
      <PanelPageHeader
        title="Providers"
        description="Each box is a provider account. Open it to save a key and choose which models this router can call."
      />
      {error && <p className="mb-4 text-sm text-error-500">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {providers.map((provider) => (
          <Link
            key={provider.slug}
            to={`/providers/${provider.slug}`}
            className="panel-card panel-card-body block transition hover:border-brand-300 dark:hover:border-brand-500/40"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-sm font-semibold text-white dark:bg-white dark:text-gray-900">
                {provider.displayName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">{provider.displayName}</h2>
                  <Status ready={provider.enabled && provider.hasApiKey} />
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{provider.summary}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <span>
                {provider.activeModels} active / {provider.totalModels} models
              </span>
              <span>{provider.hasApiKey ? provider.apiKeyHint : "No API key"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Status({ ready }: { ready: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        ready
          ? "bg-success-50 text-success-600 dark:bg-success-500/10"
          : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
      }`}
    >
      {ready ? "Ready" : "Setup"}
    </span>
  );
}
