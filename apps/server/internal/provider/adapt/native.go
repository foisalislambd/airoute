package adapt

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
)

// SimpleChat is one non-streaming provider call that returns assistant text.
type SimpleChat struct {
	URL    string
	Body   []byte
	Header http.Header
}

// OllamaChat builds an Ollama /api/chat request from an OpenAI chat body.
func OllamaChat(base, model string, openaiBody []byte, apiKey string) (SimpleChat, error) {
	messages, err := plainMessages(openaiBody)
	if err != nil {
		return SimpleChat{}, err
	}
	body, err := json.Marshal(map[string]any{
		"model":    model,
		"messages": messages,
		"stream":   false,
	})
	if err != nil {
		return SimpleChat{}, err
	}
	endpoint := strings.TrimRight(base, "/")
	if strings.HasSuffix(endpoint, "/api") {
		endpoint += "/chat"
	} else {
		endpoint += "/api/chat"
	}
	header := http.Header{}
	header.Set("Content-Type", "application/json")
	if apiKey != "" {
		header.Set("Authorization", "Bearer "+apiKey)
	}
	return SimpleChat{URL: endpoint, Body: body, Header: header}, nil
}

// TextFromOllama reads message.content.
func TextFromOllama(payload []byte) string {
	var parsed struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return ""
	}
	return parsed.Message.Content
}

// CohereChat builds a Cohere v2 chat request.
func CohereChat(base, model string, openaiBody []byte, apiKey string) (SimpleChat, error) {
	messages, err := plainMessages(openaiBody)
	if err != nil {
		return SimpleChat{}, err
	}
	body, err := json.Marshal(map[string]any{"model": model, "messages": messages})
	if err != nil {
		return SimpleChat{}, err
	}
	endpoint := strings.TrimRight(base, "/")
	if strings.HasSuffix(endpoint, "/v2") {
		endpoint += "/chat"
	} else {
		endpoint += "/v2/chat"
	}
	header := http.Header{}
	header.Set("Content-Type", "application/json")
	header.Set("Authorization", "Bearer "+apiKey)
	return SimpleChat{URL: endpoint, Body: body, Header: header}, nil
}

// TextFromCohere reads the v2 assistant content blocks.
func TextFromCohere(payload []byte) string {
	var parsed struct {
		Message struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"message"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return ""
	}
	if parsed.Text != "" {
		return parsed.Text
	}
	var b strings.Builder
	for _, block := range parsed.Message.Content {
		if block.Type == "" || block.Type == "text" {
			b.WriteString(block.Text)
		}
	}
	return b.String()
}

// EmbeddingCall builds an OpenAI-style embeddings request.
func EmbeddingCall(base, model, input, apiKey string) SimpleChat {
	body, _ := json.Marshal(map[string]any{"model": model, "input": input})
	header := http.Header{}
	header.Set("Content-Type", "application/json")
	header.Set("Authorization", "Bearer "+apiKey)
	return SimpleChat{URL: strings.TrimRight(base, "/") + "/embeddings", Body: body, Header: header}
}

// SearchCall builds a provider search request. ok is false when a required extra setting is missing.
func SearchCall(slug, base, query, apiKey string) (SimpleChat, string, bool) {
	base = strings.TrimRight(base, "/")
	header := http.Header{}
	header.Set("Accept", "application/json")
	switch slug {
	case "serper-search":
		header.Set("Content-Type", "application/json")
		header.Set("X-API-Key", apiKey)
		body, _ := json.Marshal(map[string]any{"q": query, "num": 5})
		return SimpleChat{URL: base + "/search", Body: body, Header: header}, "", true
	case "brave-search":
		header.Set("X-Subscription-Token", apiKey)
		return SimpleChat{URL: base + "/web/search?q=" + url.QueryEscape(query) + "&count=5", Header: header}, "", true
	case "exa-search":
		header.Set("Content-Type", "application/json")
		header.Set("x-api-key", apiKey)
		body, _ := json.Marshal(map[string]any{"query": query, "numResults": 5, "contents": map[string]any{"text": true}})
		return SimpleChat{URL: base + "/search", Body: body, Header: header}, "", true
	case "tavily-search":
		header.Set("Content-Type", "application/json")
		header.Set("Authorization", "Bearer "+apiKey)
		body, _ := json.Marshal(map[string]any{"query": query, "max_results": 5})
		endpoint := base
		if !strings.HasSuffix(endpoint, "/search") {
			endpoint += "/search"
		}
		return SimpleChat{URL: endpoint, Body: body, Header: header}, "", true
	case "context7":
		if apiKey != "" {
			header.Set("Authorization", "Bearer "+apiKey)
		}
		return SimpleChat{URL: base + "/search?query=" + url.QueryEscape(query), Header: header}, "", true
	case "searxng-search":
		if apiKey != "" {
			header.Set("Authorization", "Bearer "+apiKey)
		}
		endpoint := base
		if !strings.HasSuffix(endpoint, "/search") {
			endpoint += "/search"
		}
		return SimpleChat{URL: endpoint + "?q=" + url.QueryEscape(query) + "&format=json"}, "", true
	case "youcom-search":
		header.Set("X-API-Key", apiKey)
		return SimpleChat{URL: base + "/search?query=" + url.QueryEscape(query), Header: header}, "", true
	case "linkup-search":
		header.Set("Content-Type", "application/json")
		header.Set("Authorization", "Bearer "+apiKey)
		body, _ := json.Marshal(map[string]any{"q": query, "depth": "standard", "outputType": "searchResults"})
		endpoint := base
		if !strings.HasSuffix(endpoint, "/search") {
			endpoint += "/search"
		}
		return SimpleChat{URL: endpoint, Body: body, Header: header}, "", true
	case "searchapi-search":
		return SimpleChat{URL: base + "?engine=google&q=" + url.QueryEscape(query) + "&api_key=" + url.QueryEscape(apiKey), Header: header}, "", true
	case "google-pse-search":
		return SimpleChat{}, "Google Programmable Search needs the search engine id. Put it in the base URL as ?cx=your-id.", false
	case "jina-reader":
		if apiKey != "" {
			header.Set("Authorization", "Bearer "+apiKey)
		}
		header.Set("Accept", "text/plain")
		target := query
		if !strings.HasPrefix(target, "http://") && !strings.HasPrefix(target, "https://") {
			target = "https://" + target
		}
		return SimpleChat{URL: base + "/" + target, Header: header}, "", true
	case "firecrawl":
		header.Set("Content-Type", "application/json")
		header.Set("Authorization", "Bearer "+apiKey)
		body, _ := json.Marshal(map[string]any{"query": query, "limit": 5})
		return SimpleChat{URL: base + "/search", Body: body, Header: header}, "", true
	case "perplexity-search":
		header.Set("Content-Type", "application/json")
		header.Set("Authorization", "Bearer "+apiKey)
		body, _ := json.Marshal(map[string]any{"query": query, "max_results": 5})
		return SimpleChat{URL: base + "/search", Body: body, Header: header}, "", true
	default:
		header.Set("Content-Type", "application/json")
		if apiKey != "" {
			header.Set("Authorization", "Bearer "+apiKey)
		}
		body, _ := json.Marshal(map[string]any{"query": query, "q": query, "max_results": 5})
		return SimpleChat{URL: base, Body: body, Header: header}, "", true
	}
}

// TextFromSearch turns a search JSON body into readable lines.
func TextFromSearch(payload []byte) string {
	text := strings.TrimSpace(string(payload))
	if text == "" {
		return ""
	}
	if !strings.HasPrefix(text, "{") && !strings.HasPrefix(text, "[") {
		return text
	}
	var doc any
	if err := json.Unmarshal(payload, &doc); err != nil {
		return text
	}
	var lines []string
	collectSearch(doc, &lines, map[string]bool{})
	if len(lines) == 0 {
		if len(text) > 4000 {
			return text[:4000]
		}
		return text
	}
	return strings.Join(lines, "\n\n")
}

func collectSearch(value any, lines *[]string, seen map[string]bool) {
	switch item := value.(type) {
	case map[string]any:
		title, _ := item["title"].(string)
		link, _ := firstString(item, "url", "link", "href")
		snippet, _ := firstString(item, "snippet", "description", "content", "text")
		if title != "" && link != "" && !seen[link] {
			seen[link] = true
			line := title + "\n" + link
			if snippet != "" {
				line += "\n" + snippet
			}
			*lines = append(*lines, line)
		}
		for _, child := range item {
			collectSearch(child, lines, seen)
		}
	case []any:
		for _, child := range item {
			collectSearch(child, lines, seen)
		}
	}
}

func firstString(item map[string]any, keys ...string) (string, bool) {
	for _, key := range keys {
		if text, ok := item[key].(string); ok && text != "" {
			return text, true
		}
	}
	return "", false
}

func plainMessages(openaiBody []byte) ([]map[string]string, error) {
	var in struct {
		Messages []struct {
			Role    string          `json:"role"`
			Content json.RawMessage `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(openaiBody, &in); err != nil {
		return nil, err
	}
	out := make([]map[string]string, 0, len(in.Messages))
	for _, message := range in.Messages {
		role := message.Role
		if role == "" {
			role = "user"
		}
		out = append(out, map[string]string{"role": role, "content": textOnly(message.Content)})
	}
	return out, nil
}
