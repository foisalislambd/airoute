package sse

import "bytes"

// Event is one server-sent event. Comment-only heartbeats are not events.
type Event struct {
	Name string
	Data string
	ID   string
}

// Parser splits an incremental byte stream into SSE events.
// Lines may end in LF, CRLF, or CR. A trailing event without a blank line is
// returned from Flush.
type Parser struct {
	buf     []byte
	name    string
	id      string
	data    [][]byte
	hasData bool
}

// Push consumes the next chunk and returns every event completed by it.
func (p *Parser) Push(chunk []byte) []Event {
	if len(chunk) == 0 {
		return nil
	}
	p.buf = append(p.buf, chunk...)
	return p.drain(false)
}

// Flush finishes a stream that ended without a final blank line.
func (p *Parser) Flush() []Event {
	return p.drain(true)
}

func (p *Parser) drain(eof bool) []Event {
	var out []Event
	for {
		line, ok := nextLine(p.buf, eof)
		if !ok {
			break
		}
		p.buf = p.buf[line.consumed:]
		if line.blank {
			if ev, ok := p.dispatch(); ok {
				out = append(out, ev)
			}
			continue
		}
		p.consume(line.text)
	}
	if eof {
		if ev, ok := p.dispatch(); ok {
			out = append(out, ev)
		}
	}
	return out
}

type scannedLine struct {
	text     []byte
	consumed int
	blank    bool
}

func nextLine(buf []byte, eof bool) (scannedLine, bool) {
	if len(buf) == 0 {
		return scannedLine{}, false
	}
	for i := 0; i < len(buf); i++ {
		switch buf[i] {
		case '\n':
			return scannedLine{text: trimCR(buf[:i]), consumed: i + 1, blank: len(trimCR(buf[:i])) == 0}, true
		case '\r':
			if i+1 == len(buf) && !eof {
				return scannedLine{}, false
			}
			consumed := i + 1
			if i+1 < len(buf) && buf[i+1] == '\n' {
				consumed = i + 2
			}
			return scannedLine{text: buf[:i], consumed: consumed, blank: i == 0}, true
		}
	}
	if !eof {
		return scannedLine{}, false
	}
	return scannedLine{text: trimCR(buf), consumed: len(buf), blank: len(trimCR(buf)) == 0}, true
}

func trimCR(line []byte) []byte {
	if len(line) > 0 && line[len(line)-1] == '\r' {
		return line[:len(line)-1]
	}
	return line
}

func (p *Parser) consume(line []byte) {
	if len(line) == 0 || line[0] == ':' {
		return
	}
	field, value, _ := bytes.Cut(line, []byte(":"))
	if len(value) > 0 && value[0] == ' ' {
		value = value[1:]
	}
	switch string(field) {
	case "event":
		p.name = string(value)
	case "data":
		p.data = append(p.data, append([]byte(nil), value...))
		p.hasData = true
	case "id":
		if !bytes.Contains(value, []byte{0}) {
			p.id = string(value)
		}
	}
}

func (p *Parser) dispatch() (Event, bool) {
	name, id := p.name, p.id
	data := append([]byte(nil), bytes.Join(p.data, []byte("\n"))...)
	hasData := p.hasData
	p.name = ""
	p.id = ""
	p.data = nil
	p.hasData = false
	if !hasData {
		return Event{}, false
	}
	if name == "" {
		name = "message"
	}
	return Event{Name: name, Data: string(data), ID: id}, true
}
