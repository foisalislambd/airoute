package sse

import (
	"errors"
	"io"
)

type flusher interface {
	Flush()
}

// Relay copies an upstream SSE body to the client and lets format observe each
// completed event. The bytes are forwarded unchanged, so an OpenAI client still
// sees the provider's own stream. A write error means the client went away.
func Relay(dst io.Writer, src io.Reader, format Format) error {
	parser := &Parser{}
	buf := make([]byte, 32*1024)
	observe := func(events []Event) {
		if format == nil {
			return
		}
		for _, ev := range events {
			format.Observe(ev)
		}
	}
	for {
		n, err := src.Read(buf)
		if n > 0 {
			observe(parser.Push(buf[:n]))
			if _, werr := dst.Write(buf[:n]); werr != nil {
				return werr
			}
			if f, ok := dst.(flusher); ok {
				f.Flush()
			}
		}
		if err != nil {
			observe(parser.Flush())
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}
	}
}
