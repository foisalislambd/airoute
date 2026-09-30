package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"errors"

	"airoute/server/internal/catalog"
	"airoute/server/internal/provider/adapt"
	"airoute/server/internal/sse"
	"airoute/server/internal/store"
)

func (s *Server) gatewayImages(w http.ResponseWriter, r *http.Request) {
	keyID, ok := s.authorize(w, r)
	if !ok {
		return
	}
	s.proxyMedia(w, r, "gateway", keyID, catalog.KindImage)
}

func (s *Server) gatewayVideos(w http.ResponseWriter, r *http.Request) {
	keyID, ok := s.authorize(w, r)
	if !ok {
		return
	}
	s.proxyMedia(w, r, "gateway", keyID, catalog.KindVideo)
}

func (s *Server) playgroundMedia(w http.ResponseWriter, r *http.Request) {
	s.proxyMedia(w, r, "playground", "", "")
}

func (s *Server) proxyMedia(w http.ResponseWriter, r *http.Request, source, keyID, requiredKind string) {
	started := time.Now()
	body, err := readBody(r, 32<<20)
	if err != nil {
		s.failChat(w, source, keyID, "", http.StatusBadRequest, "invalid_request_error", "invalid_body", err.Error(), started)
		return
	}
	var req struct {
		Model  string `json:"model"`
		Prompt string `json:"prompt"`
		Size   string `json:"size"`
		N      int    `json:"n"`
		Image  string `json:"image"`
	}
	if err := json.Unmarshal(body, &req); err != nil || strings.TrimSpace(req.Model) == "" {
		s.failChat(w, source, keyID, req.Model, http.StatusBadRequest, "invalid_request_error", "model_required", "The model field is required.", started)
		return
	}
	if strings.TrimSpace(req.Prompt) == "" {
		s.failChat(w, source, keyID, req.Model, http.StatusBadRequest, "invalid_request_error", "prompt_required", "The prompt field is required.", started)
		return
	}
	route, err := s.Store.ResolveRoute(req.Model)
	if errors.Is(err, store.ErrNotFound) {
		s.failChat(w, source, keyID, req.Model, http.StatusNotFound, "invalid_request_error", "model_not_found", "The model `"+req.Model+"` does not exist.", started)
		return
	}
	if err != nil {
		s.failChat(w, source, keyID, req.Model, http.StatusInternalServerError, "server_error", "internal_error", err.Error(), started)
		return
	}
	route.APIKey = providerCredential(route.Model.ProviderSlug, route.APIKey)
	if !routeReady(route) {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusNotFound, "invalid_request_error", "model_not_found", routeBlockedMessage(req.Model, route), started)
		return
	}
	kind := route.Model.Kind
	if kind != catalog.KindImage && kind != catalog.KindVideo && kind != catalog.KindAudio {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadRequest, "invalid_request_error", "wrong_endpoint", "This model is not an image, video, or audio model.", started)
		return
	}
	if requiredKind != "" && kind != requiredKind {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadRequest, "invalid_request_error", "wrong_endpoint", kindEndpointMessage(kind), started)
		return
	}
	status, payload, err := s.callMedia(r, route, req.Prompt, req.Size, req.Image, req.N)
	if err != nil {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadGateway, "server_error", "upstream_error", err.Error(), started)
		return
	}
	message := ""
	if status >= 400 {
		message = upstreamErrorMessage(payload)
	}
	_ = s.Store.AddLog(store.LogInput{
		Source: source, RouterKeyID: keyID, ModelID: route.Model.ID,
		StatusCode: status, LatencyMS: int(time.Since(started).Milliseconds()), ErrorMessage: message,
	})
	if status >= 400 {
		if source == "playground" {
			writeAPIError(w, status, message)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write(payload)
		return
	}
	if source == "playground" {
		writeJSON(w, http.StatusOK, map[string]any{"media": adapt.CollectMedia(payload)})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(payload)
}

func (s *Server) callMedia(r *http.Request, route store.Route, prompt, size, image string, n int) (int, []byte, error) {
	switch route.Protocol {
	case catalog.ProtocolAudio:
		return s.callAudio(r, route, prompt)
	case catalog.ProtocolSDWebUI:
		return s.callSDWebUI(r, route, prompt)
	case catalog.ProtocolMedia:
		return s.callNativeMedia(r, route, prompt)
	}
	payload := map[string]any{
		"model":  route.Model.UpstreamID,
		"prompt": prompt,
	}
	if n > 0 {
		payload["n"] = n
	}
	if size != "" {
		payload["size"] = size
	}
	if image != "" {
		payload["image"] = image
	}
	if route.Model.Kind == catalog.KindImage {
		payload["response_format"] = "b64_json"
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return 0, nil, err
	}
	paths := []string{"/images/generations"}
	if route.Model.Kind == catalog.KindVideo {
		paths = []string{"/videos", "/videos/generations"}
	}
	var lastStatus int
	var lastBody []byte
	for i, path := range paths {
		header := http.Header{}
		header.Set("Authorization", "Bearer "+route.APIKey)
		header.Set("Content-Type", "application/json")
		header.Set("Accept", "application/json")
		endpoint := strings.TrimRight(route.BaseURL, "/") + path
		resp, err := s.OpenAI.Send(r.Context(), http.MethodPost, endpoint, body, header)
		if err != nil {
			return 0, nil, err
		}
		lastBody, err = io.ReadAll(io.LimitReader(resp.Body, 32<<20))
		resp.Body.Close()
		if err != nil {
			return 0, nil, err
		}
		lastStatus = resp.StatusCode
		if resp.StatusCode == http.StatusNotFound && i < len(paths)-1 {
			continue
		}
		return lastStatus, lastBody, nil
	}
	return lastStatus, lastBody, nil
}

func (s *Server) proxyNativeChat(w http.ResponseWriter, r *http.Request, source, keyID string, route store.Route, body []byte, started time.Time) {
	var meta struct {
		Stream bool `json:"stream"`
	}
	_ = json.Unmarshal(body, &meta)
	var endpoint string
	var upstream []byte
	var err error
	header := http.Header{}
	header.Set("Content-Type", "application/json")
	header.Set("Accept", "application/json")
	switch route.Protocol {
	case catalog.ProtocolAnthropic:
		endpoint = adapt.AnthropicURL(route.BaseURL)
		upstream, err = adapt.AnthropicBody(body, route.Model.UpstreamID)
		header.Set("x-api-key", route.APIKey)
		header.Set("anthropic-version", "2023-06-01")
	default:
		endpoint = adapt.GeminiURL(route.BaseURL, route.Model.UpstreamID)
		upstream, err = adapt.GeminiBody(body, route.Model.UpstreamID)
		header.Set("x-goog-api-key", route.APIKey)
	}
	if err != nil {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadRequest, "invalid_request_error", "invalid_body", err.Error(), started)
		return
	}
	resp, err := s.OpenAI.Send(r.Context(), http.MethodPost, endpoint, upstream, header)
	if err != nil {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadGateway, "server_error", "upstream_error", err.Error(), started)
		return
	}
	defer resp.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(resp.Body, 20<<20))
	if err != nil {
		s.failChat(w, source, keyID, route.Model.ID, http.StatusBadGateway, "server_error", "upstream_error", err.Error(), started)
		return
	}
	if resp.StatusCode >= 400 {
		message := upstreamErrorMessage(payload)
		_ = s.Store.AddLog(store.LogInput{
			Source: source, RouterKeyID: keyID, ModelID: route.Model.ID,
			StatusCode: resp.StatusCode, LatencyMS: int(time.Since(started).Milliseconds()), ErrorMessage: message,
		})
		if source == "playground" {
			writeAPIError(w, resp.StatusCode, message)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		_, _ = w.Write(payload)
		return
	}
	text, prompt, completion := adapt.TextFromGemini(payload)
	if route.Protocol == catalog.ProtocolAnthropic {
		text, prompt, completion = adapt.TextFromAnthropic(payload)
	}
	_ = s.Store.AddLog(store.LogInput{
		Source: source, RouterKeyID: keyID, ModelID: route.Model.ID,
		StatusCode: resp.StatusCode, LatencyMS: int(time.Since(started).Milliseconds()),
		PromptTokens: prompt, CompletionTokens: completion,
	})
	if meta.Stream || source == "playground" {
		writeChatChunk(w, route.Model.ID, text)
		return
	}
	writeJSON(w, http.StatusOK, openAICompletion(route.Model.ID, text, prompt, completion))
}

func writeChatChunk(w http.ResponseWriter, model, text string) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	chunk, _ := json.Marshal(map[string]any{
		"model": model,
		"choices": []any{
			map[string]any{"index": 0, "delta": map[string]any{"content": text}},
		},
	})
	_ = sse.WriteEvent(w, sse.Event{Data: string(chunk)})
	_ = sse.WriteEvent(w, sse.Event{Data: "[DONE]"})
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}

func openAICompletion(model, text string, prompt, completion int) map[string]any {
	return map[string]any{
		"object": "chat.completion",
		"model":  model,
		"choices": []any{
			map[string]any{
				"index":         0,
				"message":       map[string]any{"role": "assistant", "content": text},
				"finish_reason": "stop",
			},
		},
		"usage": map[string]any{
			"prompt_tokens":     prompt,
			"completion_tokens": completion,
			"total_tokens":      prompt + completion,
		},
	}
}

func kindEndpointMessage(kind string) string {
	switch kind {
	case catalog.KindImage:
		return "This is an image model. Call POST /v1/images/generations."
	case catalog.KindVideo:
		return "This is a video model. Call POST /v1/videos/generations."
	case catalog.KindAudio:
		return "This is an audio model. Chat completions cannot play it."
	case catalog.KindEmbedding:
		return "This is an embedding model. Chat completions cannot play it."
	default:
		return "This model cannot be called through chat completions."
	}
}
