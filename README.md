# AIRoute

Local-first AI router. It runs on your PC, stores provider keys in SQLite, and exposes an OpenAI-compatible API at `http://127.0.0.1:8787/v1`.

The panel lives at `/`. The desktop app opens that same panel in a native window.

## Layout

- `apps/server` — Go router, SQLite, OpenAI chat proxy
- `apps/panel` — Vite + React panel
- `apps/desktop` — Windows desktop shell (WebView2) around the same panel
- `packages/sse` — parser for OpenAI server-sent chat streams

## Run the panel and server

From the repo root, in two terminals:

```powershell
npm install
npm run dev:server
npm run dev:panel
```

Open `http://127.0.0.1:5173`.

1. Open **Providers → OpenAI**, paste your OpenAI API key, save, and test the connection.
2. Turn on the models you want.
3. Create a router key under **API keys**.
4. Point any OpenAI client at `http://127.0.0.1:8787/v1` and use that router key.

```powershell
curl http://127.0.0.1:8787/v1/chat/completions `
  -H "Authorization: Bearer sk-airoute-..." `
  -H "Content-Type: application/json" `
  -d "{\"model\":\"openai/gpt-6-luna\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}"
```

Model ids look like `openai/gpt-6-luna`. The router rewrites that to the upstream id before calling OpenAI.

## Desktop

Build the panel, then start the desktop app. It serves the built UI and opens it in a window.

```powershell
npm run build:panel
npm run dev:desktop
```

Data lives in `%AppData%\airoute-router`: `airoute.db` and `secret.key`. Provider keys are encrypted with that local key. The server binds to `127.0.0.1` only.

## Providers

OpenAI is the first provider. Its chat models are a curated catalog from the OpenAI docs (GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna, the GPT-5.6 family, GPT-4o, and GPT-4o mini). Prices shown in the panel are standard-tier USD per 1M tokens.

Later OpenAI-compatible providers can reuse the same `openai_chat` protocol with their own base URL and model catalog.
