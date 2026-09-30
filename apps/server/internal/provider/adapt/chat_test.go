package adapt

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestAnthropicBodyKeepsImage(t *testing.T) {
	body := []byte(`{
		"model":"public",
		"messages":[
			{"role":"system","content":"be brief"},
			{"role":"user","content":[
				{"type":"text","text":"what is this"},
				{"type":"image_url","image_url":{"url":"data:image/png;base64,aGVsbG8="}}
			]}
		]
	}`)
	out, err := AnthropicBody(body, "claude")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(out), `"media_type":"image/png"`) || !strings.Contains(string(out), "be brief") {
		t.Fatalf("body = %s", out)
	}
	if AnthropicURL("https://api.example.com/v1") != "https://api.example.com/v1/messages" {
		t.Fatal(AnthropicURL("https://api.example.com/v1"))
	}
}

func TestCollectMedia(t *testing.T) {
	payload := []byte(`{"data":[{"b64_json":"abc"},{"url":"https://cdn.example/a.png"},{"url":"https://cdn.example/a.mp4"}]}`)
	media := CollectMedia(payload)
	if len(media) != 3 {
		t.Fatalf("media = %#v", media)
	}
	if media[2].Type != "video" {
		t.Fatalf("video = %#v", media[2])
	}
}

func TestGeminiText(t *testing.T) {
	payload := []byte(`{"candidates":[{"content":{"parts":[{"text":"hi"}]}}],"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":1}}`)
	text, in, out := TextFromGemini(payload)
	if text != "hi" || in != 2 || out != 1 {
		t.Fatal(text, in, out)
	}
	raw, err := GeminiBody([]byte(`{"messages":[{"role":"user","content":"draw"}]}`), "gemini")
	if err != nil {
		t.Fatal(err)
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		t.Fatal(err)
	}
	if GeminiURL("https://generativelanguage.googleapis.com/v1beta", "gemini-2.0") == "" {
		t.Fatal("empty url")
	}
}
