package catalog

import "testing"

func TestUsesSessionCookie(t *testing.T) {
	if !UsesSessionCookie("grok-web") || !UsesSessionCookie("zenmux-free") {
		t.Fatal("cookie providers")
	}
	if UsesSessionCookie("openai") || UsesSessionCookie("adapta-web") || UsesSessionCookie("zai-web") || UsesSessionCookie("deepseek-web") {
		t.Fatal("these secrets travel as bearer tokens")
	}
}
