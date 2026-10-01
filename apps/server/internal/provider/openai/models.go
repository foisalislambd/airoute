package openai

import (
	"bytes"
	"encoding/json"
	"strconv"
	"strings"
)

// ListedModel is one model from a provider list, including modalities when the provider sends them.
type ListedModel struct {
	ID                  string
	Inputs              []string
	Outputs             []string
	ContextWindow       int
	MaxOutput           int
	InputUSDPerMillion  float64
	OutputUSDPerMillion float64
}

// ModelListPage is one page of a provider model list.
type ModelListPage struct {
	IDs           []string
	Models        []ListedModel
	HasMore       bool
	LastID        string
	NextPageToken string
}

// ParseListedModels reads model ids from an OpenAI, Anthropic, Gemini, Ollama, or Cohere list body.
func ParseListedModels(payload []byte) []string {
	return ParseModelListPage(payload).IDs
}

// ParseModelListPage reads one page, including the cursor for the next page.
func ParseModelListPage(payload []byte) ModelListPage {
	var parsed struct {
		Data []struct {
			listedFields
		} `json:"data"`
		Models []struct {
			listedFields
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"models"`
		HasMore       bool   `json:"has_more"`
		LastID        string `json:"last_id"`
		NextPageToken string `json:"nextPageToken"`
	}
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return ModelListPage{}
	}
	seen := map[string]bool{}
	var ids []string
	var models []ListedModel
	add := func(id string, fields listedFields) {
		id = strings.TrimSpace(id)
		id = strings.TrimPrefix(id, "models/")
		if id == "" || strings.ContainsAny(id, " \t\r\n") || len(id) > 200 || seen[id] {
			return
		}
		seen[id] = true
		ids = append(ids, id)
		inputs, outputs := listedModalities(fields.Architecture.InputModalities, fields.Architecture.OutputModalities, fields.Modalities.Input, fields.Modalities.Output, fields.Architecture.Modality, fields.Modality)
		models = append(models, ListedModel{
			ID:                  id,
			Inputs:              inputs,
			Outputs:             outputs,
			ContextWindow:       fields.contextWindow(),
			MaxOutput:           fields.maxOutput(),
			InputUSDPerMillion:  fields.inputPrice(),
			OutputUSDPerMillion: fields.outputPrice(),
		})
	}
	for _, item := range parsed.Data {
		add(item.ID, item.listedFields)
	}
	if len(ids) == 0 {
		for _, item := range parsed.Models {
			if item.ID != "" {
				add(item.ID, item.listedFields)
			} else {
				add(item.Name, item.listedFields)
			}
		}
	}
	return ModelListPage{IDs: ids, Models: models, HasMore: parsed.HasMore, LastID: parsed.LastID, NextPageToken: parsed.NextPageToken}
}

type listedFields struct {
	ID               string `json:"id"`
	Modality         string `json:"modality"`
	ContextLength    int    `json:"context_length"`
	ContextWindow    int    `json:"context_window"`
	MaxContext       int    `json:"max_context_length"`
	MaxInputTokens   int    `json:"max_input_tokens"`
	MaxModelLen      int    `json:"max_model_len"`
	InputTokenLimit  int    `json:"inputTokenLimit"`
	MaxOutputTokens  int    `json:"max_output_tokens"`
	MaxTokens        int    `json:"max_tokens"`
	MaxCompletion    int    `json:"max_completion_tokens"`
	OutputTokenLimit int    `json:"outputTokenLimit"`
	Architecture     struct {
		Modality         string   `json:"modality"`
		InputModalities  []string `json:"input_modalities"`
		OutputModalities []string `json:"output_modalities"`
	} `json:"architecture"`
	Modalities struct {
		Input  []string `json:"input"`
		Output []string `json:"output"`
	} `json:"modalities"`
	TopProvider struct {
		ContextLength int `json:"context_length"`
		MaxCompletion int `json:"max_completion_tokens"`
	} `json:"top_provider"`
	Pricing struct {
		Prompt     flexFloat `json:"prompt"`
		Completion flexFloat `json:"completion"`
		Input      flexFloat `json:"input"`
		Output     flexFloat `json:"output"`
	} `json:"pricing"`
}

func (f listedFields) contextWindow() int {
	context, _ := f.limits()
	return context
}

func (f listedFields) maxOutput() int {
	_, maxOut := f.limits()
	return maxOut
}

func (f listedFields) limits() (int, int) {
	context := firstPositive(f.ContextLength, f.ContextWindow, f.MaxContext, f.MaxInputTokens, f.MaxModelLen, f.InputTokenLimit, f.TopProvider.ContextLength)
	maxOut := firstPositive(f.MaxCompletion, f.MaxOutputTokens, f.OutputTokenLimit, f.TopProvider.MaxCompletion)
	if f.MaxTokens > 0 {
		if context == 0 && maxOut == 0 && f.MaxTokens >= 16_384 {
			return f.MaxTokens, 0
		}
		if maxOut == 0 {
			maxOut = f.MaxTokens
		}
	}
	return context, maxOut
}

func (f listedFields) inputPrice() float64 {
	price := float64(f.Pricing.Prompt)
	if price == 0 {
		price = float64(f.Pricing.Input)
	}
	return perMillionUSD(price)
}

func (f listedFields) outputPrice() float64 {
	price := float64(f.Pricing.Completion)
	if price == 0 {
		price = float64(f.Pricing.Output)
	}
	return perMillionUSD(price)
}

// perMillionUSD accepts either USD per token (OpenRouter) or USD per million tokens.
func perMillionUSD(value float64) float64 {
	if value <= 0 {
		return 0
	}
	if value < 0.01 {
		return value * 1_000_000
	}
	return value
}

func firstPositive(values ...int) int {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}

// flexFloat reads a JSON number or numeric string.
type flexFloat float64

func (f *flexFloat) UnmarshalJSON(raw []byte) error {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	if raw[0] == '"' {
		var text string
		if err := json.Unmarshal(raw, &text); err != nil {
			return nil
		}
		text = strings.TrimSpace(text)
		if text == "" {
			return nil
		}
		value, err := strconv.ParseFloat(text, 64)
		if err != nil {
			return nil
		}
		*f = flexFloat(value)
		return nil
	}
	var value float64
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil
	}
	*f = flexFloat(value)
	return nil
}

func listedModalities(archIn, archOut, modalIn, modalOut []string, archLabel, label string) ([]string, []string) {
	if len(archIn) > 0 || len(archOut) > 0 {
		return archIn, archOut
	}
	if len(modalIn) > 0 || len(modalOut) > 0 {
		return modalIn, modalOut
	}
	raw := archLabel
	if raw == "" {
		raw = label
	}
	raw = strings.ReplaceAll(raw, "→", "->")
	left, right, ok := strings.Cut(raw, "->")
	if !ok {
		return nil, nil
	}
	return splitPlus(left), splitPlus(right)
}

func splitPlus(value string) []string {
	parts := strings.FieldsFunc(value, func(r rune) bool {
		return r == '+' || r == ',' || r == ' '
	})
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}
