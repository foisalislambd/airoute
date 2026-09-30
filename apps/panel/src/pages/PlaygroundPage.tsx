import { PanelPageHeader } from "@/components/layout/panel-page-header";
import { listActiveModels, type Model } from "@/lib/api";
import { chatDeltaFromSSE, readSSE } from "@airoute/sse";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

export default function PlaygroundPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("Say hello in one sentence.");
  const [output, setOutput] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listActiveModels()
      .then((result) => {
        setModels(result.models);
        setModelId(result.models[0]?.id ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOutput("");
    setReasoning("");
    try {
      const response = await fetch("/api/playground/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          stream: true,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || response.statusText);
      }
      let text = "";
      let thought = "";
      for await (const message of readSSE(response.body)) {
        const delta = chatDeltaFromSSE(message.data);
        if (delta.error) throw new Error(delta.error);
        if (delta.done) break;
        if (delta.reasoning) {
          thought += delta.reasoning;
          setReasoning(thought);
        }
        if (delta.content) {
          text += delta.content;
          setOutput(text);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PanelPageHeader
        title="Playground"
        description="Sends a streaming chat completion through the local router, using the provider key stored on this machine."
      />
      {models.length === 0 ? (
        <div className="panel-card panel-card-body text-sm text-gray-600 dark:text-gray-300">
          No active models yet.{" "}
          <Link to="/providers" className="font-medium text-brand-600">
            Open a provider
          </Link>{" "}
          and turn a model on.
        </div>
      ) : (
        <form onSubmit={send} className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="panel-card panel-card-body space-y-3">
            <label className="block text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-200">Model</span>
              <select
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy || !modelId} className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {busy ? "Streaming…" : "Send"}
            </button>
            {error && <p className="text-sm text-error-500">{error}</p>}
          </div>
          <div className="space-y-4">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              className="panel-card w-full resize-y px-4 py-3 text-sm text-gray-900 outline-none dark:text-white"
            />
            {reasoning && (
              <div className="panel-card whitespace-pre-wrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{reasoning}</div>
            )}
            <div className="panel-card min-h-40 whitespace-pre-wrap px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
              {output || <span className="text-gray-400">The reply will stream here.</span>}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
