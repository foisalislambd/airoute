package openai

import (
	"encoding/json"
	"strings"
)

// ModelListPage is one page of a provider model list.
type ModelListPage struct {
	IDs           []string
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
			ID string `json:"id"`
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
	add := func(id string) {
		id = strings.TrimSpace(id)
		id = strings.TrimPrefix(id, "models/")
		if id == "" || strings.ContainsAny(id, " \t\r\n") || len(id) > 200 || seen[id] {
			return
		}
		seen[id] = true
		ids = append(ids, id)
	}
	for _, item := range parsed.Data {
		add(item.ID)
	}
	if len(ids) == 0 {
		for _, item := range parsed.Models {
			if item.ID != "" {
				add(item.ID)
			} else {
				add(item.Name)
			}
		}
	}
	return ModelListPage{IDs: ids, HasMore: parsed.HasMore, LastID: parsed.LastID, NextPageToken: parsed.NextPageToken}
}
