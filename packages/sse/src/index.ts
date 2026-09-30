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
      buffer = buffer.replace(/\r\n/g, "\n")

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
  done: boolean
}

/** Pull assistant text out of one chat.completion.chunk SSE payload. */
export function chatDeltaFromSSE(data: string): ChatDelta {
  if (data.trim() === "[DONE]") {
    return { content: "", done: true }
  }

  const json = JSON.parse(data) as {
    choices?: { delta?: { content?: string | null } }[]
  }
  const content = json.choices?.[0]?.delta?.content ?? ""
  return { content, done: false }
}
