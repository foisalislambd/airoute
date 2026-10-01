import { PanelPageHeader } from "@/components/layout/panel-page-header";
import { ProviderMark } from "@/components/provider-mark";
import {
  formatPrice,
  formatTokens,
  getProvider,
  listProviderModels,
  setModelActive,
  loadProviderModels,
  testProvider,
  updateProvider,
  type Model,
  type Provider,
} from "@/lib/api";
import { ArrowLeft, AudioLines, Braces, ExternalLink, Image, Scale, Search, Type, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

const MODEL_PAGE = 24;

export default function ProviderPage() {
  const { slug = "" } = useParams();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [modelTotal, setModelTotal] = useState(0);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsPaging, setModelsPaging] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [modelReload, setModelReload] = useState(0);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);

  useEffect(() => {
    let cancel = false;
    getProvider(slug)
      .then((nextProvider) => {
        if (cancel) return;
        setProvider(nextProvider);
        setBaseUrl(nextProvider.baseUrl);
        setEnabled(nextProvider.enabled);
      })
      .catch((err: Error) => {
        if (!cancel) setError(err.message);
      });
    return () => {
      cancel = true;
    };
  }, [slug]);

  useEffect(() => {
    setQuery("");
    setDebounced("");
  }, [slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const request = ++generation.current;
    setModelsLoading(true);
    setModelsPaging(false);
    listProviderModels(slug, { q: debounced, limit: MODEL_PAGE, offset: 0 })
      .then((page) => {
        if (generation.current !== request) return;
        setModels(page.models);
        setModelTotal(page.total);
      })
      .catch((err: Error) => {
        if (generation.current === request) setError(err.message);
      })
      .finally(() => {
        if (generation.current === request) setModelsLoading(false);
      });
  }, [slug, debounced, modelReload]);

  useEffect(() => {
    const node = bottomRef.current;
    if (!node || modelsLoading || models.length === 0 || models.length >= modelTotal) return;
    const root = node.closest("main");
    const request = generation.current;
    let started = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((entry) => entry.isIntersecting)) return;
        started = true;
        observer.disconnect();
        setModelsPaging(true);
        listProviderModels(slug, { q: debounced, limit: MODEL_PAGE, offset: models.length })
          .then((page) => {
            if (generation.current !== request) return;
            setModels((current) => appendModels(current, page.models));
            setModelTotal(page.total);
          })
          .catch((err: Error) => {
            if (generation.current === request) setError(err.message);
          })
          .finally(() => {
            if (generation.current === request) setModelsPaging(false);
          });
      },
      { root, rootMargin: "280px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [debounced, modelTotal, models.length, modelsLoading, slug]);

  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await updateProvider(slug, {
        baseUrl,
        enabled,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setProvider(next);
      setApiKey("");
      setNotice("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await testProvider(slug, {
        baseUrl,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setNotice(`Key works. OpenAI listed ${result.upstreamModels} models.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadModels() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await loadProviderModels(slug, {
        baseUrl,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      const nextProvider = await getProvider(slug);
      setProvider(nextProvider);
      setModelReload((current) => current + 1);
      setNotice(`Loaded ${result.models} models.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load models");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(model: Model) {
    setError("");
    try {
      const next = await setModelActive(slug, model.upstreamId, !model.active);
      setModels((current) => current.map((item) => (item.id === next.id ? next : item)));
      setProvider((current) =>
        current
          ? {
              ...current,
              activeModels: current.activeModels + (next.active ? 1 : -1),
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update model");
    }
  }

  if (!provider && !error) {
    return <p className="text-sm text-gray-500">Loading provider…</p>;
  }

  return (
    <div>
      <Link to="/providers" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Providers
      </Link>
      <PanelPageHeader
        title={provider?.displayName ?? "Provider"}
        leading={provider ? <ProviderMark slug={provider.slug} name={provider.displayName} /> : undefined}
        actions={
          provider?.docsUrl ? (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
            >
              Docs
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null
        }
      />
      {error && <p className="mb-4 text-sm text-error-500">{error}</p>}
      {notice && <p className="mb-4 text-sm text-success-600">{notice}</p>}

      <section className="panel-card panel-card-body">
        <div className={`grid gap-4 ${provider?.keyOptional ? "" : "lg:grid-cols-2"}`}>
          <label className="block text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Base URL</span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-white/5 dark:text-white"
            />
          </label>
          {provider?.keyOptional ? null : (
            <label className="block text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {provider?.category === "Web Cookie" ? "Session cookie" : "API key"}
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  provider?.hasApiKey
                    ? `Saved ${provider.apiKeyHint}`
                    : provider?.category === "Web Cookie"
                      ? "Paste the session cookie"
                      : "sk-..."
                }
                autoComplete="off"
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-white/5 dark:text-white"
              />
            </label>
          )}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Provider enabled
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
            Save
          </button>
          <button type="button" onClick={test} disabled={busy} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5">
            Test connection
          </button>
          <button type="button" onClick={loadModels} disabled={busy} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5">
            Load models
          </button>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Models</h2>
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search models"
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pr-3 pl-9 text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-white/5 dark:text-white"
            />
          </label>
        </div>
        <p className="mb-3 text-sm text-gray-500">
          {models.length} of {modelTotal}
        </p>
        <div className="panel-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-200 text-xs tracking-wide text-gray-500 uppercase dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">I/O</th>
                  <th className="px-4 py-3 font-medium">Context</th>
                  <th className="px-4 py-3 font-medium">Price / 1M</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {modelsLoading && models.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-gray-500">
                      Loading models…
                    </td>
                  </tr>
                ) : models.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-gray-500">
                      {debounced ? "No models match that search." : "This provider has no models yet."}
                    </td>
                  </tr>
                ) : null}
                {models.map((model) => (
                  <tr key={model.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {model.displayName}
                        {model.kind && model.kind !== "chat" && (
                          <span className="ml-2 align-middle rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-gray-500 uppercase dark:bg-white/10 dark:text-gray-300">
                            {model.kind}
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-xs text-gray-500">{model.id}</p>
                      <p className="mt-1 max-w-md text-xs text-gray-500">{model.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Modalities inputs={model.inputs} outputs={model.outputs} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {formatTokens(model.contextWindow)}
                      <span className="block text-xs text-gray-400">out {formatTokens(model.maxOutputTokens)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {formatPrice(model.inputUsdPerMillion)} in
                      <span className="block">{formatPrice(model.outputUsdPerMillion)} out</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        aria-pressed={model.active}
                        onClick={() => toggle(model)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          model.active
                            ? "bg-brand-500 text-white"
                            : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                        }`}
                      >
                        {model.active ? "On" : "Off"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div ref={bottomRef} className="h-8" />
        {modelsPaging && <p className="text-sm text-gray-500">Loading more models…</p>}
      </section>
    </div>
  );
}

const modalityMeta = {
  text: { icon: Type, label: "Text" },
  image: { icon: Image, label: "Image" },
  audio: { icon: AudioLines, label: "Audio" },
  video: { icon: Video, label: "Video" },
  embedding: { icon: Braces, label: "Embedding" },
  decisions: { icon: Scale, label: "Decisions" },
} as const

function Modalities({ inputs, outputs }: { inputs: string; outputs: string }) {
  return (
    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-300">
      <ModalityIcons value={inputs} />
      <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">→</span>
      <ModalityIcons value={outputs} />
    </div>
  )
}

function ModalityIcons({ value }: { value: string }) {
  const names = (value || "text").split(",").filter(Boolean)
  return (
    <span className="inline-flex items-center gap-1">
      {names.map((name) => {
        const meta = modalityMeta[name as keyof typeof modalityMeta] ?? modalityMeta.text
        const Icon = meta.icon
        return (
          <span key={name} title={meta.label} className="inline-flex">
            <Icon className="h-3.5 w-3.5" />
            <span className="sr-only">{meta.label}</span>
          </span>
        )
      })}
    </span>
  )
}

function appendModels(current: Model[], next: Model[]) {
  const seen = new Set(current.map((model) => model.id));
  const added = next.filter((model) => !seen.has(model.id));
  return added.length === 0 ? current : [...current, ...added];
}
