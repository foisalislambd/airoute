package openai

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestPrepareOpencodeFreeChat(t *testing.T) {
	body, path, err := PrepareOpencode([]byte(`{"model":"big-pickle","messages":[{"role":"user","content":"hi"}]}`), "big-pickle")
	if err != nil {
		t.Fatal(err)
	}
	if path != "/chat/completions" || !strings.Contains(string(body), `"shell"`) || !strings.Contains(string(body), `"read"`) || !strings.Contains(string(body), `"stream":true`) {
		t.Fatalf("path %s body %s", path, body)
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatal(err)
	}
	if _, ok := payload["stream_options"]; ok {
		t.Fatal("stream_options should be removed")
	}
	id := newOpencodeID("ses_")
	if len(id) != len("ses_")+26 {
		t.Fatal(id, len(id))
	}
}

func TestPrepareOpencodeMuseUsesResponses(t *testing.T) {
	body, path, err := PrepareOpencode([]byte(`{"model":"muse-spark-1.3-contributor-free","messages":[{"role":"user","content":"hi"}]}`), "muse-spark-1.3-contributor-free")
	if err != nil {
		t.Fatal(err)
	}
	if path != "/responses" || !strings.Contains(string(body), `"input"`) {
		t.Fatalf("path %s body %s", path, body)
	}
}
