import { PanelPageHeader } from "@/components/layout/panel-page-header";
import { ProviderMark } from "@/components/provider-mark";
import {
  formatPrice,
  formatTokens,
  getProvider,
  listProviderModels,
  setModelActive,
  testProvider,
  updateProvider,
  type Model,
  type Provider,
} from "@/lib/api";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function ProviderPage() {
  const { slug = "" } = useParams();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    Promise.all([getProvider(slug), listProviderModels(slug)])
      .then(([nextProvider, nextModels]) => {
        if (cancel) return;
        setProvider(nextProvider);
        setModels(nextModels.models);
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
        description={provider?.summary}
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
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">Base URL</span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-white/5 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-200">API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={provider?.hasApiKey ? `Saved ${provider.apiKeyHint}` : "sk-..."}
              autoComplete="off"
              className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-white/5 dark:text-white"
            />
          </label>
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
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Models</h2>
        <div className="panel-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/80 text-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Model</th>
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 text-right font-medium">Context</th>
                  <th className="px-4 py-2.5 text-right font-medium">Output</th>
                  <th className="px-4 py-2.5 text-right font-medium">Input</th>
                  <th className="px-4 py-2.5 text-right font-medium">Output price</th>
                  <th className="px-4 py-2.5 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => (
                  <tr key={model.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5">
                    <td className="max-w-[220px] truncate px-4 py-2.5 font-medium text-gray-900 dark:text-white" title={model.displayName}>
                      {model.displayName}
                    </td>
                    <td className="max-w-[240px] truncate px-4 py-2.5 font-mono text-xs text-gray-500" title={model.id}>
                      {model.id}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-gray-500" title={model.description}>
                      {model.description || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                      {model.contextWindow > 0 ? formatTokens(model.contextWindow) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                      {model.maxOutputTokens > 0 ? formatTokens(model.maxOutputTokens) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                      {model.inputUsdPerMillion > 0 ? formatPrice(model.inputUsdPerMillion) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                      {model.outputUsdPerMillion > 0 ? formatPrice(model.outputUsdPerMillion) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
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
      </section>
    </div>
  );
}
