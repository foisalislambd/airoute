package openai

import (
	"encoding/json"
	"strings"
)

// ListedModel is one model from a provider list, including modalities when the provider sends them.
type ListedModel struct {
	ID      string
	Inputs  []string
	Outputs []string
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
			ID           string `json:"id"`
			Modality     string `json:"modality"`
			Architecture struct {
				Modality         string   `json:"modality"`
				InputModalities  []string `json:"input_modalities"`
				OutputModalities []string `json:"output_modalities"`
			} `json:"architecture"`
			Modalities struct {
				Input  []string `json:"input"`
				Output []string `json:"output"`
			} `json:"modalities"`
		} `json:"data"`
		Models []struct {
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
	add := func(id string, inputs, outputs []string) {
		id = strings.TrimSpace(id)
		id = strings.TrimPrefix(id, "models/")
		if id == "" || strings.ContainsAny(id, " \t\r\n") || len(id) > 200 || seen[id] {
			return
		}
		seen[id] = true
		ids = append(ids, id)
		models = append(models, ListedModel{ID: id, Inputs: inputs, Outputs: outputs})
	}
	for _, item := range parsed.Data {
		inputs, outputs := listedModalities(item.Architecture.InputModalities, item.Architecture.OutputModalities, item.Modalities.Input, item.Modalities.Output, item.Architecture.Modality, item.Modality)
		add(item.ID, inputs, outputs)
	}
	if len(ids) == 0 {
		for _, item := range parsed.Models {
			if item.ID != "" {
				add(item.ID, nil, nil)
			} else {
				add(item.Name, nil, nil)
			}
		}
	}
	return ModelListPage{IDs: ids, Models: models, HasMore: parsed.HasMore, LastID: parsed.LastID, NextPageToken: parsed.NextPageToken}
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
