package sse

import (
	"bytes"
	"io"
	"strings"
	"testing"
)

func TestParserFrames(t *testing.T) {
	var p Parser
	got := p.Push([]byte(": keep-alive\n\ndata: hel"))
	if len(got) != 0 {
		t.Fatalf("partial event emitted: %+v", got)
	}
	got = append(got, p.Push([]byte("lo\r\n\n"))...)
	if len(got) != 1 || got[0].Data != "hello" || got[0].Name != "message" {
		t.Fatalf("event = %+v", got)
	}

	raw := "id: 7\nevent: delta\ndata: one\ndata: two\n\n"
	events := (&Parser{}).Push([]byte(raw))
	if len(events) != 1 || events[0].ID != "7" || events[0].Name != "delta" || events[0].Data != "one\ntwo" {
		t.Fatalf("multiline = %+v", events)
	}

	var tailParser Parser
	tail := tailParser.Push([]byte("data: [DONE]"))
	tail = append(tail, tailParser.Flush()...)
	if len(tail) != 1 || tail[0].Data != "[DONE]" {
		t.Fatalf("tail = %+v", tail)
	}
}

func TestWriteEventRoundTrip(t *testing.T) {
	var buf bytes.Buffer
	ev := Event{Name: "delta", ID: "9", Data: "line-1\nline-2"}
	if err := WriteEvent(&buf, ev); err != nil {
		t.Fatal(err)
	}
	events := (&Parser{}).Push(buf.Bytes())
	if len(events) != 1 || events[0] != ev {
		t.Fatalf("round trip = %+v", events)
	}
}

func TestOpenAIChatStream(t *testing.T) {
	body := strings.Join([]string{
		`data: {"choices":[{"delta":{"reasoning_content":"think"}}]}`,
		``,
		`data: {"choices":[{"delta":{"content":"Hi","tool_calls":[{"index":0,"id":"call_1","function":{"name":"lookup","arguments":"{\"q\":"}}]}}]}`,
		``,
		`data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\"x\"}"}}]}}]}`,
		``,
		`data: {"choices":[],"usage":{"prompt_tokens":3,"completion_tokens":5}}`,
		``,
		`data: [DONE]`,
		``,
		``,
	}, "\n")
	var chat OpenAIChat
	var p Parser
	for _, ev := range p.Push([]byte(body)) {
		chat.Observe(ev)
	}
	if chat.Reasoning() != "think" || chat.Content() != "Hi" || !chat.Done() {
		t.Fatalf("chat = content %q reasoning %q done %v", chat.Content(), chat.Reasoning(), chat.Done())
	}
	prompt, completion := chat.Usage()
	if prompt != 3 || completion != 5 {
		t.Fatalf("usage = %d %d", prompt, completion)
	}
	calls := chat.ToolCalls()
	if len(calls) != 1 || calls[0].Name != "lookup" || calls[0].Arguments != `{"q":"x"}` || calls[0].ID != "call_1" {
		t.Fatalf("tools = %+v", calls)
	}
}

func TestOpenAIErrorChunk(t *testing.T) {
	var chat OpenAIChat
	chat.Observe(Event{Data: `{"error":{"message":"model overloaded"}}`})
	if chat.Err() != "model overloaded" {
		t.Fatalf("err = %q", chat.Err())
	}
	chat.Observe(Event{Data: `{"error":"plain failure"}`})
	if chat.Err() != "plain failure" {
		t.Fatalf("string err = %q", chat.Err())
	}
	chat.Observe(Event{Data: `{"choices":[{"delta":{"tool_calls":[{"index":-1},{"index":99}]}}]}`})
	if len(chat.ToolCalls()) != 0 {
		t.Fatalf("ignored indexes were stored: %+v", chat.ToolCalls())
	}
}

func TestRelayCollectsUsage(t *testing.T) {
	upstream := "data: {\"choices\":[{\"delta\":{\"content\":\"Hi\"}}]}\n\ndata: {\"usage\":{\"prompt_tokens\":1,\"completion_tokens\":2}}\n\n"
	var dst bytes.Buffer
	var chat OpenAIChat
	if err := Relay(&dst, strings.NewReader(upstream), &chat); err != nil {
		t.Fatal(err)
	}
	if dst.String() != upstream {
		t.Fatal("relay changed the upstream bytes")
	}
	prompt, completion := chat.Usage()
	if chat.Content() != "Hi" || prompt != 1 || completion != 2 {
		t.Fatalf("content %q usage %d %d", chat.Content(), prompt, completion)
	}
}

type failWriter struct{}

func (failWriter) Write([]byte) (int, error) {
	return 0, io.ErrClosedPipe
}

func TestRelayStopsWhenClientLeaves(t *testing.T) {
	err := Relay(failWriter{}, strings.NewReader("data: hi\n\n"), &OpenAIChat{})
	if err == nil {
		t.Fatal("expected write error")
	}
}
