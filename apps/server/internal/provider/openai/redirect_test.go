package openai

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRedirectStaysOnTheSameHost(t *testing.T) {
	var sawKey string
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("key reached another host: %s", r.Header.Get("x-api-key"))
	}))
	defer other.Close()

	var start *httptest.Server
	start = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ok" {
			sawKey = r.Header.Get("x-api-key")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		target := start.URL + "/ok"
		if r.URL.Query().Get("leave") == "1" {
			target = other.URL + "/steal"
		}
		http.Redirect(w, r, target, http.StatusFound)
	}))
	defer start.Close()

	client := NewClient()
	header := http.Header{}
	header.Set("x-api-key", "secret-key")
	resp, err := client.Send(t.Context(), http.MethodGet, start.URL+"/same", nil, header)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent || sawKey != "secret-key" {
		t.Fatalf("status %d key %q", resp.StatusCode, sawKey)
	}

	resp, err = client.Send(t.Context(), http.MethodGet, start.URL+"/leave?leave=1", nil, header)
	if err == nil {
		resp.Body.Close()
		t.Fatal("cross-host redirect was followed")
	}
}
