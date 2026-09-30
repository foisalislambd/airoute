package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"airoute/server/internal/catalog"
	"airoute/server/internal/provider/openai"
	"airoute/server/internal/store"
)

type Server struct {
	Store  *Store
	OpenAI *openai.Client
	WebDir string
	Addr   string
}

// Store is the persistence surface the HTTP layer needs.
type Store = store.Store

func New(db *store.Store, webDir, addr string) *Server {
	return &Server{
		Store:  db,
		OpenAI: openai.NewClient(),
		WebDir: webDir,
		Addr:   addr,
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /api/overview", s.overview)
	mux.HandleFunc("GET /api/providers", s.listProviders)
	mux.HandleFunc("GET /api/providers/{slug}", s.getProvider)
	mux.HandleFunc("PUT /api/providers/{slug}", s.updateProvider)
	mux.HandleFunc("POST /api/providers/{slug}/test", s.testProvider)
	mux.HandleFunc("GET /api/providers/{slug}/models", s.listModels)
	mux.HandleFunc("PUT /api/providers/{slug}/models/{model...}", s.setModelActive)
	mux.HandleFunc("GET /api/keys", s.listKeys)
	mux.HandleFunc("POST /api/keys", s.createKey)
	mux.HandleFunc("DELETE /api/keys/{id}", s.deleteKey)
	mux.HandleFunc("GET /api/models", s.listActiveModels)
	mux.HandleFunc("GET /api/activity", s.activity)
	mux.HandleFunc("POST /api/playground/chat", s.playground)
	mux.HandleFunc("GET /v1/models", s.gatewayModels)
	mux.HandleFunc("POST /v1/chat/completions", s.gatewayChat)
	mux.HandleFunc("/", s.spa)
	return mux
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) overview(w http.ResponseWriter, _ *http.Request) {
	providers, active, keys, err := s.Store.Overview()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"providers":    providers,
		"activeModels": active,
		"routerKeys":   keys,
		"endpoint":     "http://" + s.Addr + "/v1",
		"dataDir":      "",
	})
}

func (s *Server) listProviders(w http.ResponseWriter, r *http.Request) {
	limit := 24
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	page, err := s.Store.ListProvidersPage(r.URL.Query().Get("q"), limit, offset)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"providers": page.Providers,
		"total":     page.Total,
		"limit":     page.Limit,
		"offset":    page.Offset,
	})
}

func (s *Server) getProvider(w http.ResponseWriter, r *http.Request) {
	item, err := s.Store.GetProvider(r.PathValue("slug"))
	if errors.Is(err, store.ErrNotFound) {
		writeAPIError(w, http.StatusNotFound, "provider not found")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) updateProvider(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if _, ok := catalog.BySlug(slug); !ok {
		writeAPIError(w, http.StatusNotFound, "provider not found")
		return
	}
	var body struct {
		APIKey  *string `json:"apiKey"`
		BaseURL *string `json:"baseUrl"`
		Enabled *bool   `json:"enabled"`
	}
	if err := readJSON(r, &body); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if body.BaseURL != nil {
		if err := validateBaseURL(*body.BaseURL); err != nil {
			writeAPIError(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	item, err := s.Store.UpdateProvider(slug, store.ProviderUpdate{
		APIKey:  body.APIKey,
		BaseURL: body.BaseURL,
		Enabled: body.Enabled,
	})
	if err != nil {
		writeAPIError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) testProvider(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	var body struct {
		APIKey  *string `json:"apiKey"`
		BaseURL *string `json:"baseUrl"`
	}
	if err := readJSON(r, &body); err != nil && !errors.Is(err, io.EOF) {
		writeAPIError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	baseURL, apiKey, protocol, _, err := s.Store.ProviderSecret(slug)
	if errors.Is(err, store.ErrNotFound) {
		writeAPIError(w, http.StatusNotFound, "provider not found")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if body.BaseURL != nil && strings.TrimSpace(*body.BaseURL) != "" {
		if err := validateBaseURL(*body.BaseURL); err != nil {
			writeAPIError(w, http.StatusBadRequest, err.Error())
			return
		}
		baseURL = strings.TrimRight(strings.TrimSpace(*body.BaseURL), "/")
	}
	if body.APIKey != nil && strings.TrimSpace(*body.APIKey) != "" {
		apiKey = strings.TrimSpace(*body.APIKey)
	}
	if apiKey == "" {
		writeAPIError(w, http.StatusBadRequest, "add an API key first")
		return
	}
	if protocol != catalog.ProtocolOpenAIChat {
		writeAPIError(w, http.StatusBadRequest, "this provider protocol is not supported yet")
		return
	}
	count, err := s.OpenAI.Ping(r.Context(), baseURL, apiKey)
	if err != nil {
		writeAPIError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "upstreamModels": count})
}

func (s *Server) listActiveModels(w http.ResponseWriter, _ *http.Request) {
	items, err := s.Store.ListActiveModels()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"models": items})
}

func (s *Server) listModels(w http.ResponseWriter, r *http.Request) {
	items, err := s.Store.ListModels(r.PathValue("slug"))
	if errors.Is(err, store.ErrNotFound) {
		writeAPIError(w, http.StatusNotFound, "provider not found")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"models": items})
}

func (s *Server) setModelActive(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Active bool `json:"active"`
	}
	if err := readJSON(r, &body); err != nil {
		writeAPIError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	item, err := s.Store.SetModelActive(r.PathValue("slug"), r.PathValue("model"), body.Active)
	if errors.Is(err, store.ErrNotFound) {
		writeAPIError(w, http.StatusNotFound, "model not found")
		return
	}
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (s *Server) listKeys(w http.ResponseWriter, _ *http.Request) {
	items, err := s.Store.ListRouterKeys()
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"keys": items})
}

func (s *Server) createKey(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := readJSON(r, &body); err != nil && !errors.Is(err, io.EOF) {
		writeAPIError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	created, err := s.Store.CreateRouterKey(body.Name)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (s *Server) deleteKey(w http.ResponseWriter, r *http.Request) {
	if err := s.Store.DeleteRouterKey(r.PathValue("id")); errors.Is(err, store.ErrNotFound) {
		writeAPIError(w, http.StatusNotFound, "key not found")
		return
	} else if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) activity(w http.ResponseWriter, _ *http.Request) {
	items, err := s.Store.ListLogs(50)
	if err != nil {
		writeAPIError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"activity": items})
}

func (s *Server) gatewayModels(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.authorize(w, r); !ok {
		return
	}
	items, err := s.Store.ListActiveModels()
	if err != nil {
		writeOpenAIError(w, http.StatusInternalServerError, err.Error(), "server_error", "internal_error")
		return
	}
	data := make([]map[string]any, 0, len(items))
	for _, item := range items {
		data = append(data, map[string]any{
			"id":       item.ID,
			"object":   "model",
			"created":  0,
			"owned_by": item.ProviderSlug,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"object": "list", "data": data})
}

func (s *Server) gatewayChat(w http.ResponseWriter, r *http.Request) {
	keyID, ok := s.authorize(w, r)
	if !ok {
		return
	}
	s.proxyChat(w, r, "gateway", keyID)
}

func (s *Server) playground(w http.ResponseWriter, r *http.Request) {
	s.proxyChat(w, r, "playground", "")
}

func (s *Server) authorize(w http.ResponseWriter, r *http.Request) (string, bool) {
	token := bearerToken(r)
	if token == "" {
		writeOpenAIError(w, http.StatusUnauthorized, "Missing API key. Create one in the AIRoute panel and send it as a Bearer token.", "authentication_error", "invalid_api_key")
		return "", false
	}
	id, err := s.Store.AuthenticateRouterKey(token)
	if errors.Is(err, store.ErrNotFound) {
		writeOpenAIError(w, http.StatusUnauthorized, "Incorrect API key.", "authentication_error", "invalid_api_key")
		return "", false
	}
	if err != nil {
		writeOpenAIError(w, http.StatusInternalServerError, err.Error(), "server_error", "internal_error")
		return "", false
	}
	return id, true
}

func (s *Server) proxyChat(w http.ResponseWriter, r *http.Request, source, keyID string) {
	started := time.Now()
	body, err := readBody(r, 20<<20)
	if err != nil {
		s.failChat(w, source, keyID, "", http.StatusBadRequest, "invalid_request_error", "invalid_body", err.Error(), started)
		return
	}
	var meta struct {
		Model string `json:"model"`
	}
	if err := json.Unmarshal(body, &meta); err != nil || strings.TrimSpace(meta.Model) == "" {
		s.failChat(w, source, keyID, meta.Model, http.StatusBadRequest, "invalid_request_error", "model_required", "The model field is required.", started)
		return
	}

	route, err := s.Store.ResolveRoute(meta.Model)
	if errors.Is(err, store.ErrNotFound) {
		message := "The model `" + meta.Model + "` does not exist."
		s.failChat(w, source, keyID, meta.Model, http.StatusNotFound, "invalid_request_error", "model_not_found", message, started)
		return
	}
	if err != nil {
		s.failChat(w, source, keyID, meta.Model, http.StatusInternalServerError, "server_error", "internal_error", err.Error(), started)
		return
	}
	if !route.Model.Active || !route.ProviderOn || route.APIKey == "" {
		message := routeBlockedMessage(meta.Model, route)
		s.failChat(w, source, keyID, route.Model.ID, http.StatusNotFound, "invalid_request_error", "model_not_found", message, started)
		return
	}
	if route.Protocol != catalog.ProtocolOpenAIChat {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadRequest, "invalid_request_error", "unsupported_protocol", "This provider protocol is not supported yet.", started)
		return
	}

	upstreamBody, stream, err := openai.RewriteChatModel(body, route.Model.UpstreamID)
	if err != nil {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadRequest, "invalid_request_error", "invalid_body", err.Error(), started)
		return
	}

	resp, err := s.OpenAI.ChatCompletions(r.Context(), route.BaseURL, route.APIKey, upstreamBody)
	if err != nil {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadGateway, "server_error", "upstream_error", err.Error(), started)
		return
	}
	defer resp.Body.Close()

	if stream && resp.StatusCode >= 200 && resp.StatusCode < 300 {
		copyStream(w, resp)
		_ = s.Store.AddLog(store.LogInput{
			Source: source, RouterKeyID: keyID, ModelID: route.Model.ID,
			StatusCode: resp.StatusCode, LatencyMS: int(time.Since(started).Milliseconds()),
		})
		return
	}

	payload, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadGateway, "server_error", "upstream_error", err.Error(), started)
		return
	}
	prompt, completion := openai.UsageFromCompletion(payload)
	message := ""
	if resp.StatusCode >= 400 {
		message = upstreamErrorMessage(payload)
	}
	_ = s.Store.AddLog(store.LogInput{
		Source: source, RouterKeyID: keyID, ModelID: route.Model.ID,
		StatusCode: resp.StatusCode, LatencyMS: int(time.Since(started).Milliseconds()),
		PromptTokens: prompt, CompletionTokens: completion, ErrorMessage: message,
	})
	if source == "playground" && resp.StatusCode >= 400 {
		writeAPIError(w, resp.StatusCode, message)
		return
	}
	if contentType := resp.Header.Get("Content-Type"); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	} else {
		w.Header().Set("Content-Type", "application/json")
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = w.Write(payload)
}

func (s *Server) failChat(w http.ResponseWriter, source, keyID, modelID string, status int, typ, code, message string, started time.Time) {
	_ = s.Store.AddLog(store.LogInput{
		Source: source, RouterKeyID: keyID, ModelID: modelID,
		StatusCode: status, LatencyMS: int(time.Since(started).Milliseconds()), ErrorMessage: message,
	})
	if source == "playground" {
		writeAPIError(w, status, message)
		return
	}
	writeOpenAIError(w, status, message, typ, code)
}

func (s *Server) spa(w http.ResponseWriter, r *http.Request) {
	if s.WebDir == "" {
		writeAPIError(w, http.StatusNotFound, "panel build not found; run npm run dev:panel or npm run build:panel")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.NotFound(w, r)
		return
	}
	rel := strings.TrimPrefix(filepath.Clean("/"+r.URL.Path), string(filepath.Separator))
	if rel == "." || rel == "" {
		rel = "index.html"
	}
	file := filepath.Join(s.WebDir, rel)
	root, err := filepath.Abs(s.WebDir)
	if err != nil {
		http.Error(w, "panel unavailable", http.StatusInternalServerError)
		return
	}
	abs, err := filepath.Abs(file)
	if err != nil || (abs != root && !strings.HasPrefix(abs, root+string(os.PathSeparator))) {
		http.NotFound(w, r)
		return
	}
	if info, err := os.Stat(abs); err == nil && !info.IsDir() {
		http.ServeFile(w, r, abs)
		return
	}
	http.ServeFile(w, r, filepath.Join(root, "index.html"))
}

func copyStream(w http.ResponseWriter, resp *http.Response) {
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "text/event-stream"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(resp.StatusCode)
	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, err := w.Write(buf[:n]); err != nil {
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err != nil {
			return
		}
	}
}

func upstreamErrorMessage(payload []byte) string {
	var parsed struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(payload, &parsed); err == nil && parsed.Error.Message != "" {
		return parsed.Error.Message
	}
	text := strings.TrimSpace(string(payload))
	if len(text) > 240 {
		text = text[:240]
	}
	return text
}

func routeBlockedMessage(requested string, route store.Route) string {
	if !route.Model.Active {
		return "The model `" + requested + "` is not active. Turn it on from the provider page."
	}
	if route.APIKey == "" {
		return "Save an API key for " + route.Model.ProviderSlug + " before calling this model."
	}
	return route.Model.ProviderSlug + " is disabled. Enable the provider before calling this model."
}

func validateBaseURL(raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Host == "" || parsed.Scheme == "" || parsed.Hostname() == "" {
		return errors.New("base URL must be an absolute URL")
	}
	if parsed.Scheme == "https" {
		return nil
	}
	host := parsed.Hostname()
	if parsed.Scheme == "http" && (host == "127.0.0.1" || host == "localhost") {
		return nil
	}
	return errors.New("base URL must use https, or http on localhost")
}
