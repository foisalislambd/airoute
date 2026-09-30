export type Provider = {
  slug: string
  displayName: string
  protocol: string
  baseUrl: string
  docsUrl: string
  summary: string
  hasApiKey: boolean
  apiKeyHint: string
  enabled: boolean
  activeModels: number
  totalModels: number
  updatedAt: string
}

export type Model = {
  id: string
  providerSlug: string
  upstreamId: string
  displayName: string
  description: string
  contextWindow: number
  maxOutputTokens: number
  inputUsdPerMillion: number
  outputUsdPerMillion: number
  knowledgeCutoff: string
  reasoning: boolean
  active: boolean
}

export type RouterKey = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export type CreatedKey = RouterKey & { secret: string }

export type ActivityItem = {
  id: number
  createdAt: string
  source: string
  modelId: string
  statusCode: number
  latencyMs: number
  promptTokens: number
  completionTokens: number
  errorMessage: string
}

export type Overview = {
  providers: number
  activeModels: number
  routerKeys: number
  endpoint: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  if (response.status === 204) {
    return undefined as T
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string }
  if (!response.ok) {
    throw new Error(data.error || response.statusText)
  }
  return data as T
}

export function getOverview() {
  return request<Overview>("/api/overview")
}

export function listProviders() {
  return request<{ providers: Provider[] }>("/api/providers")
}

export function getProvider(slug: string) {
  return request<Provider>(`/api/providers/${slug}`)
}

export function updateProvider(
  slug: string,
  body: { apiKey?: string; baseUrl?: string; enabled?: boolean },
) {
  return request<Provider>(`/api/providers/${slug}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

export function testProvider(slug: string, body: { apiKey?: string; baseUrl?: string }) {
  return request<{ ok: boolean; upstreamModels: number }>(`/api/providers/${slug}/test`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function listProviderModels(slug: string) {
  return request<{ models: Model[] }>(`/api/providers/${slug}/models`)
}

export function listActiveModels() {
  return request<{ models: Model[] }>("/api/models")
}

export function setModelActive(slug: string, upstreamId: string, active: boolean) {
  return request<Model>(`/api/providers/${slug}/models/${encodeURIComponent(upstreamId)}`, {
    method: "PUT",
    body: JSON.stringify({ active }),
  })
}

export function listKeys() {
  return request<{ keys: RouterKey[] }>("/api/keys")
}

export function createKey(name: string) {
  return request<CreatedKey>("/api/keys", {
    method: "POST",
    body: JSON.stringify({ name }),
  })
}

export function deleteKey(id: string) {
  return request<void>(`/api/keys/${id}`, { method: "DELETE" })
}

export function listActivity() {
  return request<{ activity: ActivityItem[] }>("/api/activity")
}

export function formatTokens(value: number) {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${Number(millions.toFixed(2))}M`
  }
  return `${Math.round(value / 1000)}K`
}

export function formatPrice(value: number) {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: value < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`
}
