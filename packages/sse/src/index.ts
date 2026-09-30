export type SSEMessage = {
  event: string
  data: string
}

/** Read an OpenAI-style SSE body. Events are split on a blank line. */
export async function* readSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEMessage> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      buffer = normalizeNewlines(buffer)

      let splitAt = buffer.indexOf("\n\n")
      while (splitAt !== -1) {
        const raw = buffer.slice(0, splitAt)
        buffer = buffer.slice(splitAt + 2)
        const message = parseEventBlock(raw)
        if (message) yield message
        splitAt = buffer.indexOf("\n\n")
      }
    }
  } finally {
    reader.releaseLock()
  }

  const tail = parseEventBlock(buffer)
  if (tail) yield tail
}

function parseEventBlock(block: string): SSEMessage | null {
  let event = "message"
  const data: string[] = []

  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
      continue
    }
    if (line.startsWith("data:")) {
      data.push(line.slice(5).replace(/^ /, ""))
    }
  }

  if (data.length === 0) return null
  return { event, data: data.join("\n") }
}

export type ChatDelta = {
  content: string
  reasoning: string
  error: string
  done: boolean
}

/** Pull text, reasoning, and an error out of one chat.completion.chunk payload. */
export function chatDeltaFromSSE(data: string): ChatDelta {
  const empty = { content: "", reasoning: "", error: "", done: false }
  if (data.trim() === "[DONE]") {
    return { ...empty, done: true }
  }

  let json: {
    error?: { message?: string } | string
    choices?: {
      delta?: {
        content?: string | null
        reasoning_content?: string | null
        reasoning?: string | null
      }
    }[]
  }
  try {
    json = JSON.parse(data) as typeof json
  } catch {
    return empty
  }
  const delta = json.choices?.[0]?.delta
  const error = json.choices?.length ? "" : readError(json.error)
  return {
    content: delta?.content ?? "",
    reasoning: delta?.reasoning_content ?? delta?.reasoning ?? "",
    error,
    done: false,
  }
}

function readError(error: { message?: string } | string | undefined) {
  if (typeof error === "string") return error
  return error?.message ?? ""
}

function normalizeNewlines(buffer: string) {
  const holdCR = buffer.endsWith("\r")
  let text = holdCR ? buffer.slice(0, -1) : buffer
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return holdCR ? text + "\r" : text
}
