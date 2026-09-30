package openai

import (
	"encoding/json"
	"net/http"
	"strings"
)

// ApplyCredential sets either a session cookie or a bearer token.
func ApplyCredential(header http.Header, secret string, cookie bool) {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return
	}
	if cookie {
		header.Set("Cookie", SessionCookie(secret))
		return
	}
	header.Set("Authorization", "Bearer "+secret)
}

// SessionCookie turns a pasted cookie, JSON export, or raw header into a Cookie value.
func SessionCookie(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "Bearer ")
	raw = strings.TrimPrefix(raw, "bearer ")
	if strings.HasPrefix(strings.ToLower(raw), "cookie:") {
		raw = strings.TrimSpace(raw[len("cookie:"):])
	}
	if strings.HasPrefix(raw, "[") {
		var items []struct {
			Name  string `json:"name"`
			Value string `json:"value"`
		}
		if err := json.Unmarshal([]byte(raw), &items); err == nil && len(items) > 0 {
			parts := make([]string, 0, len(items))
			for _, item := range items {
				if item.Name == "" {
					continue
				}
				parts = append(parts, item.Name+"="+item.Value)
			}
			if len(parts) > 0 {
				return strings.Join(parts, "; ")
			}
		}
	}
	return raw
}
