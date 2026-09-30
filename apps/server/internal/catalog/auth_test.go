package catalog

import "testing"

func TestModalities(t *testing.T) {
	in, out := Modalities("gpt-4o", KindChat)
	if in != "text,image" || out != "text" {
		t.Fatalf("gpt-4o %s %s", in, out)
	}
	in, out = Modalities("whisper-1", KindAudio)
	if in != "audio" || out != "text" {
		t.Fatalf("whisper %s %s", in, out)
	}
	in, out = Modalities("dall-e-3", KindImage)
	if in != "text" || out != "image" {
		t.Fatalf("image %s %s", in, out)
	}
}

func TestUsesSessionCookie(t *testing.T) {
	if !UsesSessionCookie("grok-web") || !UsesSessionCookie("zenmux-free") {
		t.Fatal("cookie providers")
	}
	if UsesSessionCookie("openai") || UsesSessionCookie("adapta-web") || UsesSessionCookie("zai-web") || UsesSessionCookie("deepseek-web") {
		t.Fatal("these secrets travel as bearer tokens")
	}
}
