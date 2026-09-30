package openai

import (
	"crypto/rand"
	"encoding/json"
	"strings"
)

const opencodeUserAgent = "opencode/1.18.31"

// OpencodeFree reports whether this OpenCode model is on the no-key free tier.
func OpencodeFree(model string) bool {
	return model == "big-pickle" || strings.HasSuffix(model, "-free")
}

// OpencodeResponses reports models served on the Responses API rather than chat completions.
func OpencodeResponses(model string) bool {
	return strings.HasPrefix(model, "muse-spark")
}

// PrepareOpencode adjusts a chat body so the OpenCode free tier accepts it.
// The returned path is /chat/completions or /responses.
func PrepareOpencode(body []byte, model string) ([]byte, string, error) {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, "", err
	}
	delete(payload, "stream_options")
	payload["stream"] = true
	if OpencodeResponses(model) {
		next := map[string]any{
			"model":  payload["model"],
			"input":  payload["messages"],
			"stream": true,
			"tools":  ensureTools(nil, responsesTool),
		}
		encoded, err := json.Marshal(next)
		return encoded, "/responses", err
	}
	tools, _ := payload["tools"].([]any)
	payload["tools"] = ensureTools(tools, chatTool)
	encoded, err := json.Marshal(payload)
	return encoded, "/chat/completions", err
}

// OpencodeHeaders is the client identity the free tier checks.
func OpencodeHeaders(apiKey string) map[string]string {
	headers := map[string]string{
		"Content-Type":       "application/json",
		"Accept":             "text/event-stream",
		"User-Agent":         opencodeUserAgent,
		"x-opencode-client":  "desktop",
		"x-opencode-project": "global",
		"x-opencode-session": newOpencodeID("ses_"),
		"x-opencode-request": newOpencodeID("msg_"),
	}
	if apiKey != "" {
		headers["Authorization"] = "Bearer " + apiKey
	}
	return headers
}

// The free tier refuses a request unless the tool list names both a shell and a read tool.
var opencodeRequiredTools = []string{"shell", "read"}

func ensureTools(existing []any, makeTool func(string) map[string]any) []any {
	have := map[string]bool{}
	for _, item := range existing {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if name, ok := entry["name"].(string); ok {
			have[name] = true
		}
		if fn, ok := entry["function"].(map[string]any); ok {
			if name, ok := fn["name"].(string); ok {
				have[name] = true
			}
		}
	}
	for _, name := range opencodeRequiredTools {
		if !have[name] {
			existing = append(existing, makeTool(name))
		}
	}
	return existing
}

func chatTool(name string) map[string]any {
	return map[string]any{
		"type": "function",
		"function": map[string]any{
			"name":        name,
			"description": "Do not call this tool. It exists only so the free endpoint accepts the request.",
			"parameters":  map[string]any{"type": "object", "properties": map[string]any{}},
		},
	}
}

func responsesTool(name string) map[string]any {
	return map[string]any{
		"type":        "function",
		"name":        name,
		"description": "Do not call this tool. It exists only so the free endpoint accepts the request.",
		"parameters":  map[string]any{"type": "object", "properties": map[string]any{}},
	}
}

// ResponsesText reads assistant text out of a Responses API event stream.
func ResponsesText(body []byte) string {
	text := string(body)
	if !strings.Contains(text, "output_text") && !strings.Contains(text, "data:") {
		return ""
	}
	var b strings.Builder
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" || data == "[DONE]" {
			continue
		}
		var event struct {
			Type  string `json:"type"`
			Delta string `json:"delta"`
		}
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}
		if event.Type == "response.output_text.delta" {
			b.WriteString(event.Delta)
		}
	}
	return b.String()
}

func newOpencodeID(prefix string) string {
	buf := make([]byte, 20)
	_, _ = rand.Read(buf)
	const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	var b strings.Builder
	b.WriteString(prefix)
	const hexdigits = "0123456789abcdef"
	for i := 0; i < 6; i++ {
		b.WriteByte(hexdigits[buf[i]>>4])
		b.WriteByte(hexdigits[buf[i]&0x0f])
	}
	for i := 6; i < 20; i++ {
		b.WriteByte(alphabet[int(buf[i])%len(alphabet)])
	}
	return b.String()
}
