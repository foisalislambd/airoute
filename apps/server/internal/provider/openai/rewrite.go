package openai

import (
	"bytes"
	"encoding/json"
	"fmt"
)

// RewriteChatModel replaces the public model id with the upstream id and reports stream mode.
func RewriteChatModel(body []byte, upstreamID string) ([]byte, bool, error) {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.UseNumber()
	var payload map[string]any
	if err := decoder.Decode(&payload); err != nil {
		return nil, false, fmt.Errorf("request body must be JSON")
	}
	if err := decoder.Decode(&struct{}{}); err == nil {
		return nil, false, fmt.Errorf("request body must be a single JSON object")
	}
	payload["model"] = upstreamID
	stream, _ := payload["stream"].(bool)
	next, err := json.Marshal(payload)
	if err != nil {
		return nil, false, err
	}
	return next, stream, nil
}

// UsageFromCompletion reads token counts from a non-streaming chat completion.
func UsageFromCompletion(body []byte) (prompt, completion int) {
	var parsed struct {
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return 0, 0
	}
	return parsed.Usage.PromptTokens, parsed.Usage.CompletionTokens
}
