package sse

// Format reads one provider protocol out of a parsed SSE stream.
// OpenAI chat is the first implementation. Another protocol adds its own type
// and the relay stays the same.
type Format interface {
	Observe(Event)
	Usage() (promptTokens, completionTokens int)
	Err() string
}
