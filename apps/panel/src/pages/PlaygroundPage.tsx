import { PanelPageHeader } from "@/components/layout/panel-page-header";
import { listActiveModels, type Model } from "@/lib/api";
import { chatDeltaFromSSE, readSSE } from "@airoute/sse";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

type Attachment = { name: string; mime: string; url: string; text: string | null };
type MediaItem = { type: string; src: string };

export default function PlaygroundPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("Say hello in one sentence.");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [output, setOutput] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
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

  const selected = models.find((model) => model.id === modelId);
  const kind = selected?.kind || "chat";
  const mediaKind = kind === "image" || kind === "video" || kind === "audio";

  async function onFiles(list: FileList | null) {
    if (!list) return;
    const next: Attachment[] = [];
    for (const file of Array.from(list)) {
      const mime = file.type || "application/octet-stream";
      const text = isTextFile(file) ? (await file.text()).slice(0, 100_000) : null;
      next.push({ name: file.name, mime, url: await readFile(file), text });
    }
    setFiles((current) => [...current, ...next].slice(0, 8));
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOutput("");
    setReasoning("");
    setMedia([]);
    try {
      if (mediaKind) {
        const image = files.find((file) => file.mime.startsWith("image/"))?.url ?? "";
        const notes = files
          .filter((file) => file.text)
          .map((file) => `File ${file.name}:\n${file.text}`)
          .join("\n\n");
        const response = await fetch("/api/playground/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: modelId,
            prompt: notes ? `${prompt}\n\n${notes}` : prompt,
            image,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string; media?: MediaItem[] };
        if (!response.ok) throw new Error(data.error || response.statusText);
        setMedia(data.media ?? []);
        if ((data.media ?? []).length === 0) {
          setOutput("The provider returned no image or video URL.");
        }
        return;
      }

      const content = files.length === 0 ? prompt : messageContent(prompt, files);
      const response = await fetch("/api/playground/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          stream: true,
          messages: [{ role: "user", content }],
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
      setMedia(mediaInText(text));
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
        description="Chat, image, and video models run through the local router with the provider key stored on this machine."
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
                    {model.kind && model.kind !== "chat" ? ` · ${model.kind}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-200">Attach files</span>
              <input
                type="file"
                multiple
                onChange={(event) => {
                  void onFiles(event.target.files);
                  event.target.value = "";
                }}
                className="mt-1.5 block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 dark:file:bg-white/10 dark:file:text-gray-200"
              />
            </label>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((file) => (
                  <button
                    key={file.url}
                    type="button"
                    onClick={() => setFiles((current) => current.filter((item) => item.url !== file.url))}
                    className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
                    title={`Remove ${file.name}`}
                  >
                    {file.mime.startsWith("image/") ? (
                      <img src={file.url} alt="" className="h-14 w-14 object-cover" />
                    ) : (
                      <span className="flex h-14 max-w-32 items-center px-2 text-left text-[10px] text-gray-600 dark:text-gray-300">{file.name}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button type="submit" disabled={busy || !modelId} className="w-full rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
              {busy ? "Running…" : mediaKind ? "Generate" : "Send"}
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
            <div className="panel-card min-h-40 space-y-3 px-4 py-3 text-sm text-gray-800 dark:text-gray-100">
              {media.map((item) =>
                item.type === "video" ? (
                  <video key={item.src} src={item.src} controls className="max-h-96 max-w-full rounded-lg" />
                ) : item.type === "audio" ? (
                  <audio key={item.src} src={item.src} controls className="w-full" />
                ) : (
                  <img key={item.src} src={item.src} alt="" className="max-h-96 max-w-full rounded-lg" />
                ),
              )}
              {output ? (
                <RichText text={output} hideMedia={media.length > 0} />
              ) : media.length === 0 ? (
                <span className="text-gray-400">The reply, image, or video will show here.</span>
              ) : null}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function RichText({ text, hideMedia }: { text: string; hideMedia: boolean }) {
  if (hideMedia) return <p className="whitespace-pre-wrap">{stripMedia(text)}</p>;
  const parts = text.split(/(!\[[^\]]*\]\([^)]+\))/g);
  return (
    <div className="space-y-3 whitespace-pre-wrap">
      {parts.map((part, index) => {
        const image = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (image) return <img key={index} src={image[2]} alt={image[1]} className="max-h-96 max-w-full rounded-lg" />;
        return <span key={index}>{part}</span>;
      })}
    </div>
  );
}

function mediaInText(text: string): MediaItem[] {
  const found: MediaItem[] = [];
  for (const match of text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const src = match[1];
    if (src.startsWith("http") || src.startsWith("data:image") || src.startsWith("data:video")) {
      found.push({ type: src.includes("video") || src.endsWith(".mp4") || src.endsWith(".webm") ? "video" : "image", src });
    }
  }
  return found;
}

function stripMedia(text: string) {
  return text.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
}

function messageContent(prompt: string, files: Attachment[]) {
  const parts: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const file of files) {
    if (file.mime.startsWith("image/")) {
      parts.push({ type: "image_url", image_url: { url: file.url } });
      continue;
    }
    if (file.text != null) {
      parts.push({ type: "text", text: `File ${file.name}:\n${file.text}` });
      continue;
    }
    parts.push({ type: "file", file: { filename: file.name, file_data: file.url } });
  }
  return parts;
}

function isTextFile(file: File) {
  if (file.type.startsWith("text/") || file.type.includes("json") || file.type.includes("xml") || file.type.includes("javascript")) {
    return true;
  }
  return /\.(txt|md|json|csv|tsv|xml|yaml|yml|js|ts|tsx|jsx|py|go|rs|java|html|css|sql|log)$/i.test(file.name);
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
