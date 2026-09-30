package sse

import (
	"fmt"
	"io"
	"strings"
)

// WriteEvent encodes one event. Data lines are split on newlines so a later
// protocol translator can emit a stream the parser reads back.
func WriteEvent(w io.Writer, ev Event) error {
	var b strings.Builder
	if ev.ID != "" {
		fmt.Fprintf(&b, "id: %s\n", ev.ID)
	}
	if ev.Name != "" && ev.Name != "message" {
		fmt.Fprintf(&b, "event: %s\n", ev.Name)
	}
	if ev.Data == "" {
		b.WriteString("data:\n")
	} else {
		for _, line := range strings.Split(ev.Data, "\n") {
			fmt.Fprintf(&b, "data: %s\n", line)
		}
	}
	b.WriteByte('\n')
	_, err := io.WriteString(w, b.String())
	return err
}
