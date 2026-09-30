package httpapi

import "testing"

func TestValidateBaseURL(t *testing.T) {
	ok := []string{
		"https://api.openai.com/v1",
		"http://127.0.0.1:8080/v1",
		"http://localhost:8787/v1",
	}
	for _, raw := range ok {
		if err := validateBaseURL(raw); err != nil {
			t.Fatalf("%s: %v", raw, err)
		}
	}
	bad := []string{
		"http://localhost.evil.com",
		"http://127.0.0.1.evil.com",
		"https://",
		"not a url",
		"http://example.com",
	}
	for _, raw := range bad {
		if err := validateBaseURL(raw); err == nil {
			t.Fatalf("expected rejection for %s", raw)
		}
	}
}
