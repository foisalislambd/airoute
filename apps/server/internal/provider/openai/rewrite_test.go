package openai

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestRewriteChatModel(t *testing.T) {
	body := []byte(`{"model":"openai/gpt-6-luna","stream":true,"messages":[{"role":"user","content":"hi"}]}`)
	next, stream, err := RewriteChatModel(body, "gpt-6-luna")
	if err != nil {
		t.Fatal(err)
	}
	if !stream {
		t.Fatal("expected stream")
	}
	var parsed map[string]any
	if err := json.Unmarshal(next, &parsed); err != nil {
		t.Fatal(err)
	}
	if parsed["model"] != "gpt-6-luna" {
		t.Fatalf("model = %#v", parsed["model"])
	}
	if !bytes.Contains(next, []byte(`"content":"hi"`)) {
		t.Fatalf("body lost content: %s", next)
	}
}

func TestCountModels(t *testing.T) {
	payload := []byte(`{"object":"list","data":[{"id":"a"},{"id":"b"}]}`)
	if got := countModels(payload); got != 2 {
		t.Fatalf("got %d", got)
	}
}
