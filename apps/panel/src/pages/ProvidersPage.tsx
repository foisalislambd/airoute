import { PanelPageHeader } from "@/components/layout/panel-page-header";
import { listProviders, type Provider, type ProviderCategory } from "@/lib/api";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 18;

export default function ProvidersPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("all");
  const [categories, setCategories] = useState<ProviderCategory[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const request = ++generation.current;
    setLoading(true);
    setPaging(false);
    setError("");
    listProviders({ q: debounced, category, limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        if (generation.current !== request) return;
        setProviders(page.providers);
        setCategories(page.categories ?? []);
        setTotal(page.total);
      })
      .catch((err: Error) => {
        if (generation.current === request) setError(err.message);
      })
      .finally(() => {
        if (generation.current === request) setLoading(false);
      });
  }, [debounced, category]);

  useEffect(() => {
    const node = bottomRef.current;
    if (!node || loading || providers.length === 0 || providers.length >= total) return;
    const root = node.closest("main");
    const request = generation.current;
    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((entry) => entry.isIntersecting)) return;
        started = true;
        observer.disconnect();
        setPaging(true);
        listProviders({ q: debounced, category, limit: PAGE_SIZE, offset: providers.length })
          .then((page) => {
            if (generation.current !== request) return;
            setProviders((current) => appendUnique(current, page.providers));
            setTotal(page.total);
          })
          .catch((err: Error) => {
            if (generation.current === request) setError(err.message);
          })
          .finally(() => {
            if (generation.current === request) setPaging(false);
          });
      },
      { root, rootMargin: "280px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [category, debounced, loading, providers.length, total]);

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
      {categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {categories.map((item) => {
            const active = category === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300"
                }`}
              >
                {item.label}
                <span className={active ? "text-white/80" : "text-gray-400"}>
                  {item.ready}/{item.total}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mb-4 text-sm text-error-500">{error}</p>}
      {(debounced || total > 0) && (
        <p className="mb-4 text-sm text-gray-500">
          {providers.length} of {total}
        </p>
      )}
      {loading && providers.length === 0 ? (
        <div className="panel-card panel-card-body text-sm text-gray-500">Loading providers…</div>
      ) : providers.length === 0 ? (
        <div className="panel-card panel-card-body text-sm text-gray-500">
          {debounced ? "No providers match that search." : "No providers in this category."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {providers.map((provider) => (
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
      <div ref={bottomRef} className="h-8" />
      {paging && <p className="pb-4 text-center text-sm text-gray-400">Loading more…</p>}
    </div>
  );
}

function appendUnique(current: Provider[], next: Provider[]) {
  const seen = new Set(current.map((provider) => provider.slug));
  const added = next.filter((provider) => !seen.has(provider.slug));
  return added.length === 0 ? current : [...current, ...added];
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
