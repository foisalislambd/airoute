package openai

import "testing"

func TestSessionCookie(t *testing.T) {
	if got := SessionCookie("sso=abc; sso-rw=def"); got != "sso=abc; sso-rw=def" {
		t.Fatal(got)
	}
	if got := SessionCookie(`[{"name":"sso","value":"abc"},{"name":"sso-rw","value":"def"}]`); got != "sso=abc; sso-rw=def" {
		t.Fatal(got)
	}
	if got := SessionCookie("cookie: session=1"); got != "session=1" {
		t.Fatal(got)
	}
}
