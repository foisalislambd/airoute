import { PanelPageHeader } from "@/components/layout/panel-page-header";
import { listProviders, type Provider } from "@/lib/api";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    listProviders()
      .then((result) => setProviders(result.providers))
      .catch((err: Error) => setError(err.message));
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return providers;
    return providers.filter((provider) =>
      [provider.displayName, provider.slug, provider.summary].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [providers, query]);

  return (
    <div>
      <PanelPageHeader
        title="Providers"
        actions={
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search providers"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-brand-400 dark:border-gray-700 dark:bg-white/5 dark:text-white"
              aria-label="Search providers"
            />
          </label>
        }
      />
      {error && <p className="mb-4 text-sm text-error-500">{error}</p>}
      {query.trim() && (
        <p className="mb-4 text-sm text-gray-500">
          {visible.length} of {providers.length}
        </p>
      )}
      {visible.length === 0 ? (
        <div className="panel-card panel-card-body text-sm text-gray-500">No providers match that search.</div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((provider) => (
          <Link
            key={provider.slug}
            to={`/providers/${provider.slug}`}
            className="panel-card panel-card-body flex h-full flex-col transition hover:border-brand-300 dark:hover:border-brand-500/40"
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
                <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-gray-500 dark:text-gray-400">
                  {provider.summary}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500">
              <span className="truncate">
                {provider.activeModels} active / {provider.totalModels} models
              </span>
              <span className="shrink-0">{provider.hasApiKey ? provider.apiKeyHint : "No API key"}</span>
            </div>
          </Link>
        ))}
      </div>
      )}
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
