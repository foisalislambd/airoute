package openai

import (
	"strings"
	"testing"
)

func TestParseListedModels(t *testing.T) {
	openai := ParseListedModels([]byte(`{"data":[{"id":"gpt-4o"},{"id":"gpt-4o"},{"id":"ba d"}]}`))
	if len(openai) != 1 || openai[0] != "gpt-4o" {
		t.Fatal(openai)
	}
	gemini := ParseListedModels([]byte(`{"models":[{"name":"models/gemini-2.0-flash"}]}`))
	if len(gemini) != 1 || gemini[0] != "gemini-2.0-flash" {
		t.Fatal(gemini)
	}
	page := ParseModelListPage([]byte(`{"data":[{"id":"anthropic/claude","architecture":{"input_modalities":["text","pdf","image"],"output_modalities":["text"]}},{"id":"old","architecture":{"modality":"text+image->text"}}]}`))
	if len(page.Models) != 2 || strings.Join(page.Models[0].Inputs, ",") != "text,pdf,image" || page.Models[0].Outputs[0] != "text" {
		t.Fatal(page.Models)
	}
	if strings.Join(page.Models[1].Inputs, "+") != "text+image" || page.Models[1].Outputs[0] != "text" {
		t.Fatal(page.Models[1])
	}
}
