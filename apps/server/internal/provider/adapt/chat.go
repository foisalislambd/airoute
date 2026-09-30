package adapt

import (
	"encoding/base64"
	"encoding/json"
	"net/url"
	"strings"
)

// AnthropicURL is the Messages endpoint for a provider base URL.
func AnthropicURL(base string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if strings.HasSuffix(base, "/messages") {
		return base
	}
	if strings.HasSuffix(base, "/v1") {
		return base + "/messages"
	}
	return base + "/v1/messages"
}

// GeminiURL is the generateContent endpoint for one model.
func GeminiURL(base, model string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	base = strings.TrimSuffix(base, "/openai")
	return base + "/models/" + url.PathEscape(model) + ":generateContent"
}

// AnthropicBody converts an OpenAI chat body into an Anthropic Messages body.
func AnthropicBody(openaiBody []byte, model string) ([]byte, error) {
	var in chatBody
	if err := json.Unmarshal(openaiBody, &in); err != nil {
		return nil, err
	}
	out := map[string]any{
		"model":      model,
		"max_tokens": maxTokens(in.MaxTokens),
		"messages":   anthropicMessages(in.Messages),
	}
	if system := systemText(in.Messages); system != "" {
		out["system"] = system
	}
	return json.Marshal(out)
}

// GeminiBody converts an OpenAI chat body into a Gemini generateContent body.
func GeminiBody(openaiBody []byte, model string) ([]byte, error) {
	var in chatBody
	if err := json.Unmarshal(openaiBody, &in); err != nil {
		return nil, err
	}
	_ = model
	contents := make([]any, 0, len(in.Messages))
	var system []any
	for _, message := range in.Messages {
		parts := partsFromContent(message.Content)
		if len(parts) == 0 {
			continue
		}
		if message.Role == "system" {
			system = append(system, parts...)
			continue
		}
		role := "user"
		if message.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, map[string]any{"role": role, "parts": parts})
	}
	out := map[string]any{"contents": contents}
	if len(system) > 0 {
		out["systemInstruction"] = map[string]any{"parts": system}
	}
	return json.Marshal(out)
}

// TextFromAnthropic reads the assistant text and token counts.
func TextFromAnthropic(payload []byte) (string, int, int) {
	var parsed struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return "", 0, 0
	}
	var b strings.Builder
	for _, block := range parsed.Content {
		if block.Type == "text" || block.Type == "" {
			b.WriteString(block.Text)
		}
	}
	return b.String(), parsed.Usage.InputTokens, parsed.Usage.OutputTokens
}

// TextFromGemini reads the candidate text and token counts.
func TextFromGemini(payload []byte) (string, int, int) {
	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
		} `json:"usageMetadata"`
	}
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return "", 0, 0
	}
	var b strings.Builder
	for _, candidate := range parsed.Candidates {
		for _, part := range candidate.Content.Parts {
			b.WriteString(part.Text)
		}
	}
	return b.String(), parsed.UsageMetadata.PromptTokenCount, parsed.UsageMetadata.CandidatesTokenCount
}

type chatBody struct {
	Messages  []chatMessage `json:"messages"`
	MaxTokens int           `json:"max_tokens"`
}

type chatMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

func maxTokens(value int) int {
	if value > 0 {
		return value
	}
	return 4096
}

func systemText(messages []chatMessage) string {
	var b strings.Builder
	for _, message := range messages {
		if message.Role != "system" {
			continue
		}
		if b.Len() > 0 {
			b.WriteByte('\n')
		}
		b.WriteString(textOnly(message.Content))
	}
	return b.String()
}

func anthropicMessages(messages []chatMessage) []any {
	out := make([]any, 0, len(messages))
	for _, message := range messages {
		if message.Role == "system" {
			continue
		}
		role := "user"
		if message.Role == "assistant" {
			role = "assistant"
		}
		out = append(out, map[string]any{
			"role":    role,
			"content": anthropicContent(message.Content),
		})
	}
	return out
}

func anthropicContent(raw json.RawMessage) any {
	if text, ok := asString(raw); ok {
		return text
	}
	var parts []map[string]any
	if err := json.Unmarshal(raw, &parts); err != nil {
		return textOnly(raw)
	}
	blocks := make([]any, 0, len(parts))
	for _, part := range parts {
		switch part["type"] {
		case "text":
			if text, _ := part["text"].(string); text != "" {
				blocks = append(blocks, map[string]any{"type": "text", "text": text})
			}
		case "image_url":
			if block := anthropicImage(part["image_url"]); block != nil {
				blocks = append(blocks, block)
			}
		}
	}
	if len(blocks) == 0 {
		return textOnly(raw)
	}
	return blocks
}

func anthropicImage(value any) map[string]any {
	image, _ := value.(map[string]any)
	if image == nil {
		return nil
	}
	raw, _ := image["url"].(string)
	mediaType, data, ok := dataURL(raw)
	if !ok {
		return nil
	}
	return map[string]any{
		"type": "image",
		"source": map[string]any{
			"type":       "base64",
			"media_type": mediaType,
			"data":       data,
		},
	}
}

func partsFromContent(raw json.RawMessage) []any {
	if text, ok := asString(raw); ok {
		if text == "" {
			return nil
		}
		return []any{map[string]any{"text": text}}
	}
	var parts []map[string]any
	if err := json.Unmarshal(raw, &parts); err != nil {
		text := textOnly(raw)
		if text == "" {
			return nil
		}
		return []any{map[string]any{"text": text}}
	}
	out := make([]any, 0, len(parts))
	for _, part := range parts {
		switch part["type"] {
		case "text":
			if text, _ := part["text"].(string); text != "" {
				out = append(out, map[string]any{"text": text})
			}
		case "image_url":
			image, _ := part["image_url"].(map[string]any)
			raw, _ := image["url"].(string)
			mediaType, data, ok := dataURL(raw)
			if ok {
				out = append(out, map[string]any{
					"inline_data": map[string]any{"mime_type": mediaType, "data": data},
				})
			}
		}
	}
	return out
}

func textOnly(raw json.RawMessage) string {
	if text, ok := asString(raw); ok {
		return text
	}
	var parts []map[string]any
	if err := json.Unmarshal(raw, &parts); err != nil {
		return ""
	}
	var b strings.Builder
	for _, part := range parts {
		if text, _ := part["text"].(string); text != "" {
			b.WriteString(text)
		}
	}
	return b.String()
}

func asString(raw json.RawMessage) (string, bool) {
	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return "", false
	}
	return text, true
}

func dataURL(raw string) (mediaType, data string, ok bool) {
	if !strings.HasPrefix(raw, "data:") {
		return "", "", false
	}
	comma := strings.IndexByte(raw, ',')
	if comma < 0 {
		return "", "", false
	}
	meta := raw[len("data:"):comma]
	payload := raw[comma+1:]
	mediaType = strings.TrimSuffix(meta, ";base64")
	if mediaType == "" || !strings.Contains(meta, ";base64") {
		return "", "", false
	}
	if _, err := base64.StdEncoding.DecodeString(payload); err != nil {
		return "", "", false
	}
	return mediaType, payload, true
}
