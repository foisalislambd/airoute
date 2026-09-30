package adapt

import "testing"

func TestSearchText(t *testing.T) {
	text := TextFromSearch([]byte(`{"organic":[{"title":"A","link":"https://a.example","snippet":"hi"}]}`))
	if text == "" || !contains(text, "https://a.example") {
		t.Fatal(text)
	}
}

func TestOllamaURL(t *testing.T) {
	call, err := OllamaChat("https://ollama.com/api", "llama", []byte(`{"messages":[{"role":"user","content":"hi"}]}`), "key")
	if err != nil {
		t.Fatal(err)
	}
	if call.URL != "https://ollama.com/api/chat" {
		t.Fatal(call.URL)
	}
}

func contains(text, part string) bool {
	return len(text) >= len(part) && (text == part || len(part) == 0 || (len(text) > 0 && (indexOf(text, part) >= 0)))
}

func indexOf(text, part string) int {
	for i := 0; i+len(part) <= len(text); i++ {
		if text[i:i+len(part)] == part {
			return i
		}
	}
	return -1
}
