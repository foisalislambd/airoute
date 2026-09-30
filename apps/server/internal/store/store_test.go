package store

import (
	"path/filepath"
	"strings"
	"testing"

	"airoute/server/internal/secret"
)

func TestProviderKeyAndModelRoute(t *testing.T) {
	dir := t.TempDir()
	key, err := secret.LoadKey(dir)
	if err != nil {
		t.Fatal(err)
	}
	s, err := Open(filepath.Join(dir, "airoute.db"), key)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	providers, err := s.ListProviders()
	if err != nil {
		t.Fatal(err)
	}
	if len(providers) != 1 || providers[0].Slug != "openai" {
		t.Fatalf("providers = %+v", providers)
	}
	if providers[0].TotalModels < 8 {
		t.Fatalf("expected curated openai models, got %d", providers[0].TotalModels)
	}

	apiKey := "sk-live-secret-1234"
	enabled := true
	updated, err := s.UpdateProvider("openai", ProviderUpdate{APIKey: &apiKey, Enabled: &enabled})
	if err != nil {
		t.Fatal(err)
	}
	if !updated.HasAPIKey || updated.APIKeyHint != "••••1234" || !updated.Enabled {
		t.Fatalf("updated = %+v", updated)
	}

	model, err := s.SetModelActive("openai", "gpt-6-luna", true)
	if err != nil {
		t.Fatal(err)
	}
	if !model.Active || model.ID != "openai/gpt-6-luna" {
		t.Fatalf("model = %+v", model)
	}

	route, err := s.ResolveRoute("openai/gpt-6-luna")
	if err != nil {
		t.Fatal(err)
	}
	if route.APIKey != apiKey || route.Model.UpstreamID != "gpt-6-luna" || !route.ProviderOn {
		t.Fatalf("route = %+v", route)
	}
	byUpstream, err := s.ResolveRoute("gpt-6-luna")
	if err != nil || byUpstream.Model.ID != route.Model.ID {
		t.Fatalf("upstream resolve: %+v %v", byUpstream, err)
	}

	created, err := s.CreateRouterKey("Cursor")
	if err != nil {
		t.Fatal(err)
	}
	id, err := s.AuthenticateRouterKey(created.Secret)
	if err != nil || id != created.ID {
		t.Fatalf("auth id=%s err=%v", id, err)
	}
	if strings.HasPrefix(strings.TrimPrefix(created.Secret, "sk-airoute-"), created.ID) {
		t.Fatal("router key id is a prefix of the secret")
	}
	if _, err := s.AuthenticateRouterKey("sk-airoute-nope"); err != ErrNotFound {
		t.Fatalf("expected not found, got %v", err)
	}
}
