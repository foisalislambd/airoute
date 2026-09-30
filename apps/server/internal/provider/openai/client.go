package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const transportAttempts = 3

// Client talks to any provider that implements OpenAI chat completions.
type Client struct {
	HTTP *http.Client
}

func NewClient() *Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	return &Client{HTTP: &http.Client{Transport: transport}}
}

func (c *Client) ChatCompletions(ctx context.Context, baseURL, apiKey string, body []byte) (*http.Response, error) {
	endpoint := strings.TrimRight(baseURL, "/") + "/chat/completions"
	header := http.Header{}
	if apiKey != "" {
		header.Set("Authorization", "Bearer "+apiKey)
	}
	header.Set("Content-Type", "application/json")
	header.Set("Accept", "application/json, text/event-stream")
	return c.Send(ctx, http.MethodPost, endpoint, body, header)
}

// Send posts or gets with the caller's headers. The body is replayed on transport retry.
func (c *Client) Send(ctx context.Context, method, endpoint string, body []byte, header http.Header) (*http.Response, error) {
	return c.doRetry(ctx, func() (*http.Request, error) {
		var reader io.Reader
		if body != nil {
			reader = bytes.NewReader(body)
		}
		req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
		if err != nil {
			return nil, err
		}
		req.Header = header.Clone()
		return req, nil
	})
}

// Ping lists models to verify the key and base URL. It returns how many models the provider reported.
func (c *Client) Ping(ctx context.Context, baseURL, apiKey string) (int, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	endpoint := strings.TrimRight(baseURL, "/") + "/models"
	resp, err := c.doRetry(ctx, func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return nil, err
		}
		if apiKey != "" {
			req.Header.Set("Authorization", "Bearer "+apiKey)
		}
		return req, nil
	})
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	payload, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := strings.TrimSpace(string(payload))
		if len(message) > 280 {
			message = message[:280]
		}
		if message == "" {
			message = resp.Status
		}
		return 0, fmt.Errorf("provider returned %s: %s", resp.Status, message)
	}
	return countModels(payload), nil
}

// doRetry repeats a call when OpenAI closes HTTP/2 with GOAWAY or the connection drops
// before any response headers arrive. A fresh request is built each time so the body can be sent again.
func (c *Client) doRetry(ctx context.Context, build func() (*http.Request, error)) (*http.Response, error) {
	var last error
	for attempt := 1; attempt <= transportAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if attempt > 1 {
			c.HTTP.CloseIdleConnections()
			timer := time.NewTimer(time.Duration(attempt-1) * 200 * time.Millisecond)
			select {
			case <-ctx.Done():
				timer.Stop()
				return nil, ctx.Err()
			case <-timer.C:
			}
		}
		req, err := build()
		if err != nil {
			return nil, err
		}
		resp, err := c.HTTP.Do(req)
		if err == nil {
			return resp, nil
		}
		last = err
		if !retryableTransportError(err) {
			return nil, err
		}
	}
	return nil, last
}

func retryableTransportError(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "GOAWAY") ||
		strings.Contains(message, "unexpected EOF") ||
		strings.Contains(message, "connection reset") ||
		strings.Contains(message, "server closed idle connection") ||
		strings.Contains(message, "client connection lost") ||
		strings.Contains(message, "http2: timeout awaiting response headers")
}

func countModels(payload []byte) int {
	var parsed struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return 0
	}
	return len(parsed.Data)
}
