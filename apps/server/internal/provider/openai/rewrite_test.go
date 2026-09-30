package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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
	options, _ := parsed["stream_options"].(map[string]any)
	if options["include_usage"] != true {
		t.Fatalf("stream_options = %#v", parsed["stream_options"])
	}
	if !bytes.Contains(next, []byte(`"content":"hi"`)) {
		t.Fatalf("body lost content: %s", next)
	}
}

func TestRetryableTransportError(t *testing.T) {
	err := errors.New(`Post "https://api.openai.com/v1/chat/completions": http2: server sent GOAWAY and closed the connection; LastStreamID=3, ErrCode=NO_ERROR, debug=""`)
	if !retryableTransportError(err) {
		t.Fatal("expected GOAWAY to be retried")
	}
	if retryableTransportError(errors.New("provider returned 401")) {
		t.Fatal("http status errors must not be retried")
	}
	if retryableTransportError(context.Canceled) {
		t.Fatal("canceled requests must not be retried")
	}
}

func TestCountModels(t *testing.T) {
	payload := []byte(`{"object":"list","data":[{"id":"a"},{"id":"b"}]}`)
	if got := countModels(payload); got != 2 {
		t.Fatalf("got %d", got)
	}
}
