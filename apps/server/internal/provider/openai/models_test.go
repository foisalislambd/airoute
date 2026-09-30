package openai

import "testing"

func TestParseListedModels(t *testing.T) {
	openai := ParseListedModels([]byte(`{"data":[{"id":"gpt-4o"},{"id":"gpt-4o"},{"id":"ba d"}]}`))
	if len(openai) != 1 || openai[0] != "gpt-4o" {
		t.Fatal(openai)
	}
	gemini := ParseListedModels([]byte(`{"models":[{"name":"models/gemini-2.0-flash"}]}`))
	if len(gemini) != 1 || gemini[0] != "gemini-2.0-flash" {
		t.Fatal(gemini)
	}
}
