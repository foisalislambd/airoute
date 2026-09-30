package sse

import (
	"encoding/json"
	"strings"
)

// ToolCall is one function call assembled from streamed tool-call deltas.
type ToolCall struct {
	ID        string
	Name      string
	Arguments string
}

// OpenAIChat reads an OpenAI chat.completion.chunk stream.
// It keeps assistant text, reasoning, tool calls, the last usage object,
// and an error that arrived with no choices.
type OpenAIChat struct {
	content    strings.Builder
	reasoning  strings.Builder
	tools      []ToolCall
	prompt     int
	completion int
	err        string
	done       bool
}

// Content returns the assistant text collected from the stream.
func (c *OpenAIChat) Content() string { return c.content.String() }

// Reasoning returns thinking text from reasoning_content or reasoning deltas.
func (c *OpenAIChat) Reasoning() string { return c.reasoning.String() }

// ToolCalls returns function calls in index order.
func (c *OpenAIChat) ToolCalls() []ToolCall { return c.tools }

// Done reports whether the stream sent the OpenAI [DONE] marker.
func (c *OpenAIChat) Done() bool { return c.done }

// Usage returns prompt and completion token counts from the stream.
func (c *OpenAIChat) Usage() (int, int) { return c.prompt, c.completion }

// Err returns an upstream error message carried inside the stream.
func (c *OpenAIChat) Err() string { return c.err }

// Observe decodes one SSE event.
func (c *OpenAIChat) Observe(ev Event) {
	data := strings.TrimSpace(ev.Data)
	if data == "" {
		return
	}
	if data == "[DONE]" {
		c.done = true
		return
	}

	var chunk struct {
		Error   json.RawMessage `json:"error"`
		Choices []struct {
			Delta struct {
				Content          *string `json:"content"`
				ReasoningContent *string `json:"reasoning_content"`
				Reasoning        *string `json:"reasoning"`
				ToolCalls        []struct {
					Index    int    `json:"index"`
					ID       string `json:"id"`
					Function struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"delta"`
		} `json:"choices"`
		Usage *struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal([]byte(data), &chunk); err != nil {
		return
	}
	if chunk.Usage != nil {
		c.prompt = chunk.Usage.PromptTokens
		c.completion = chunk.Usage.CompletionTokens
	}
	if len(chunk.Choices) == 0 {
		if message := errorMessage(chunk.Error); message != "" {
			c.err = message
		}
	}
	for _, choice := range chunk.Choices {
		if choice.Delta.Content != nil {
			c.content.WriteString(*choice.Delta.Content)
		}
		switch {
		case choice.Delta.ReasoningContent != nil:
			c.reasoning.WriteString(*choice.Delta.ReasoningContent)
		case choice.Delta.Reasoning != nil:
			c.reasoning.WriteString(*choice.Delta.Reasoning)
		}
		c.addTools(choice.Delta.ToolCalls)
	}
}

func errorMessage(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var text string
	if err := json.Unmarshal(raw, &text); err == nil {
		return text
	}
	var object struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(raw, &object); err == nil {
		return object.Message
	}
	return ""
}

func (c *OpenAIChat) addTools(calls []struct {
	Index    int    `json:"index"`
	ID       string `json:"id"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}) {
	for _, call := range calls {
		if call.Index < 0 || call.Index > 31 {
			continue
		}
		for len(c.tools) <= call.Index {
			c.tools = append(c.tools, ToolCall{})
		}
		item := &c.tools[call.Index]
		if call.ID != "" {
			item.ID = call.ID
		}
		if call.Function.Name != "" {
			item.Name = call.Function.Name
		}
		item.Arguments += call.Function.Arguments
	}
}
