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
	priced := ParseModelListPage([]byte(`{"data":[{"id":"openai/gpt-4o","context_length":128000,"top_provider":{"max_completion_tokens":16384},"pricing":{"prompt":"0.0000025","completion":"0.00001"}}]}`))
	got := priced.Models[0]
	if got.ContextWindow != 128000 || got.MaxOutput != 16384 || got.InputUSDPerMillion != 2.5 || got.OutputUSDPerMillion != 10 {
		t.Fatalf("openrouter facts %+v", got)
	}
	geminiPage := ParseModelListPage([]byte(`{"models":[{"name":"models/gemini-2.0-flash","inputTokenLimit":1048576,"outputTokenLimit":8192}]}`))
	if geminiPage.Models[0].ContextWindow != 1048576 || geminiPage.Models[0].MaxOutput != 8192 {
		t.Fatalf("gemini facts %+v", geminiPage.Models[0])
	}
	million := ParseModelListPage([]byte(`{"data":[{"id":"priced","pricing":{"input":2.5,"output":10},"max_input_tokens":200000,"max_tokens":64000}]}`))
	if len(million.Models) != 1 {
		t.Fatalf("million page %+v", million)
	}
	if million.Models[0].InputUSDPerMillion != 2.5 || million.Models[0].OutputUSDPerMillion != 10 || million.Models[0].ContextWindow != 200000 || million.Models[0].MaxOutput != 64000 {
		t.Fatalf("per million %+v", million.Models[0])
	}
}
