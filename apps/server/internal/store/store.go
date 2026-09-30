package store

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"airoute/server/internal/catalog"
	"airoute/server/internal/secret"

	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	db  *sql.DB
	key []byte
}

type Provider struct {
	Slug         string `json:"slug"`
	DisplayName  string `json:"displayName"`
	Protocol     string `json:"protocol"`
	BaseURL      string `json:"baseUrl"`
	DocsURL      string `json:"docsUrl"`
	Summary      string `json:"summary"`
	Category     string `json:"category"`
	Free         bool   `json:"free"`
	HasAPIKey    bool   `json:"hasApiKey"`
	APIKeyHint   string `json:"apiKeyHint"`
	Enabled      bool   `json:"enabled"`
	ActiveModels int    `json:"activeModels"`
	TotalModels  int    `json:"totalModels"`
	UpdatedAt    string `json:"updatedAt"`
}

type Model struct {
	ID                  string  `json:"id"`
	ProviderSlug        string  `json:"providerSlug"`
	UpstreamID          string  `json:"upstreamId"`
	DisplayName         string  `json:"displayName"`
	Description         string  `json:"description"`
	ContextWindow       int     `json:"contextWindow"`
	MaxOutputTokens     int     `json:"maxOutputTokens"`
	InputUSDPerMillion  float64 `json:"inputUsdPerMillion"`
	OutputUSDPerMillion float64 `json:"outputUsdPerMillion"`
	KnowledgeCutoff     string  `json:"knowledgeCutoff"`
	Reasoning           bool    `json:"reasoning"`
	Active              bool    `json:"active"`
}

type Route struct {
	Model      Model
	Protocol   string
	BaseURL    string
	APIKey     string
	ProviderOn bool
}

type RouterKey struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Prefix     string  `json:"prefix"`
	CreatedAt  string  `json:"createdAt"`
	LastUsedAt *string `json:"lastUsedAt"`
}

type CreatedKey struct {
	RouterKey
	Secret string `json:"secret"`
}

type RequestLog struct {
	ID               int64  `json:"id"`
	CreatedAt        string `json:"createdAt"`
	Source           string `json:"source"`
	ModelID          string `json:"modelId"`
	StatusCode       int    `json:"statusCode"`
	LatencyMS        int    `json:"latencyMs"`
	PromptTokens     int    `json:"promptTokens"`
	CompletionTokens int    `json:"completionTokens"`
	ErrorMessage     string `json:"errorMessage"`
}

type LogInput struct {
	Source           string
	RouterKeyID      string
	ModelID          string
	StatusCode       int
	LatencyMS        int
	PromptTokens     int
	CompletionTokens int
	ErrorMessage     string
}

func Open(path string, key []byte) (*Store, error) {
	dsn, err := sqliteDSN(path)
	if err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db, key: key}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	if err := s.syncCatalog(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
CREATE TABLE IF NOT EXISTS providers (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_cipher TEXT NOT NULL DEFAULT '',
  api_key_hint TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  provider_slug TEXT NOT NULL REFERENCES providers(slug),
  upstream_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  context_window INTEGER NOT NULL,
  max_output_tokens INTEGER NOT NULL,
  input_usd_per_million REAL NOT NULL,
  output_usd_per_million REAL NOT NULL,
  knowledge_cutoff TEXT NOT NULL DEFAULT '',
  reasoning INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  UNIQUE(provider_slug, upstream_id)
);

CREATE TABLE IF NOT EXISTS router_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL,
  router_key_id TEXT,
  model_id TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT ''
);`)
	return err
}

func (s *Store) syncCatalog() error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	now := time.Now().UTC().Format(time.RFC3339)
	for _, provider := range catalog.All() {
		if _, err := tx.Exec(`
INSERT INTO providers (slug, display_name, protocol, base_url, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(slug) DO UPDATE SET
  display_name = excluded.display_name,
  protocol = excluded.protocol`,
			provider.Slug, provider.DisplayName, provider.Protocol, provider.DefaultBaseURL, now); err != nil {
			return err
		}

		keep := make([]string, 0, len(provider.Models))
		for _, model := range provider.Models {
			id := provider.Slug + "/" + model.UpstreamID
			keep = append(keep, model.UpstreamID)
			reasoning := 0
			if model.Reasoning {
				reasoning = 1
			}
			if _, err := tx.Exec(`
INSERT INTO models (
  id, provider_slug, upstream_id, display_name, description,
  context_window, max_output_tokens, input_usd_per_million, output_usd_per_million,
  knowledge_cutoff, reasoning, active
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
ON CONFLICT(id) DO UPDATE SET
  display_name = excluded.display_name,
  description = excluded.description,
  context_window = excluded.context_window,
  max_output_tokens = excluded.max_output_tokens,
  input_usd_per_million = excluded.input_usd_per_million,
  output_usd_per_million = excluded.output_usd_per_million,
  knowledge_cutoff = excluded.knowledge_cutoff,
  reasoning = excluded.reasoning`,
				id, provider.Slug, model.UpstreamID, model.DisplayName, model.Description,
				model.ContextWindow, model.MaxOutputTokens, model.InputUSDPerMillion, model.OutputUSDPerMillion,
				model.KnowledgeCutoff, reasoning); err != nil {
				return err
			}
		}

		query := `DELETE FROM models WHERE provider_slug = ?`
		args := []any{provider.Slug}
		if len(keep) > 0 {
			query += ` AND upstream_id NOT IN (` + placeholders(len(keep)) + `)`
			for _, id := range keep {
				args = append(args, id)
			}
		}
		if _, err := tx.Exec(query, args...); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) ListProviders() ([]Provider, error) {
	page, err := s.ListProvidersPage("", "", 0, 0)
	if err != nil {
		return nil, err
	}
	return page.Providers, nil
}

type CategoryStat struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Total int    `json:"total"`
	Ready int    `json:"ready"`
}

type ProviderPage struct {
	Providers  []Provider
	Categories []CategoryStat
	Total      int
	Limit      int
	Offset     int
}

func (s *Store) ListProvidersPage(query, category string, limit, offset int) (ProviderPage, error) {
	unlimited := limit <= 0
	if limit < 0 {
		limit = 24
	}
	if limit > 60 {
		limit = 60
	}
	if offset < 0 {
		offset = 0
	}
	page := ProviderPage{Providers: []Provider{}, Categories: []CategoryStat{}, Limit: limit, Offset: offset}
	stats, err := s.categoryStats()
	if err != nil {
		return ProviderPage{}, err
	}
	page.Categories = stats

	where := "1 = 1"
	args := []any{}
	slugs, filtered := providerFilterSlugs(query, category)
	if filtered {
		if len(slugs) == 0 {
			return page, nil
		}
		where = "p.slug IN (" + placeholders(len(slugs)) + ")"
		for _, slug := range slugs {
			args = append(args, slug)
		}
	}

	countArgs := append([]any{}, args...)
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM providers p WHERE `+where, countArgs...).Scan(&page.Total); err != nil {
		return ProviderPage{}, err
	}

	listSQL := `
SELECT p.slug, p.display_name, p.protocol, p.base_url, p.api_key_cipher, p.api_key_hint,
       p.enabled, p.updated_at,
       (SELECT COUNT(*) FROM models m WHERE m.provider_slug = p.slug),
       (SELECT COUNT(*) FROM models m WHERE m.provider_slug = p.slug AND m.active = 1)
FROM providers p
WHERE ` + where + `
ORDER BY
  CASE
    WHEN p.enabled = 1 AND p.api_key_cipher <> '' THEN 0
    WHEN p.api_key_cipher <> '' THEN 1
    ELSE 2
  END,
  p.display_name COLLATE NOCASE,
  p.slug`
	listArgs := args
	if !unlimited {
		listSQL += ` LIMIT ? OFFSET ?`
		listArgs = append(append([]any{}, args...), limit, offset)
	}
	rows, err := s.db.Query(listSQL, listArgs...)
	if err != nil {
		return ProviderPage{}, err
	}
	defer rows.Close()

	for rows.Next() {
		item, err := scanProvider(rows)
		if err != nil {
			return ProviderPage{}, err
		}
		page.Providers = append(page.Providers, item)
	}
	if page.Providers == nil {
		page.Providers = []Provider{}
	}
	return page, rows.Err()
}

func providerFilterSlugs(query, category string) ([]string, bool) {
	needle := strings.ToLower(strings.TrimSpace(query))
	category = strings.TrimSpace(category)
	wantAll := category == "" || strings.EqualFold(category, "all")
	wantFree := strings.EqualFold(category, "free")
	if needle == "" && wantAll {
		return nil, false
	}
	var slugs []string
	for _, provider := range catalog.All() {
		if needle != "" &&
			!strings.Contains(strings.ToLower(provider.DisplayName), needle) &&
			!strings.Contains(strings.ToLower(provider.Slug), needle) &&
			!strings.Contains(strings.ToLower(provider.Summary), needle) {
			continue
		}
		if wantFree && !provider.Free {
			continue
		}
		if !wantAll && !wantFree && !strings.EqualFold(provider.Category, category) {
			continue
		}
		slugs = append(slugs, provider.Slug)
	}
	return slugs, true
}

func (s *Store) categoryStats() ([]CategoryStat, error) {
	rows, err := s.db.Query(`SELECT slug, enabled, api_key_cipher FROM providers`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type tally struct{ total, ready int }
	counts := map[string]*tally{}
	all := tally{}
	free := tally{}
	for rows.Next() {
		var slug, cipher string
		var enabled int
		if err := rows.Scan(&slug, &enabled, &cipher); err != nil {
			return nil, err
		}
		ready := enabled == 1 && cipher != ""
		all.total++
		if ready {
			all.ready++
		}
		def, ok := catalog.BySlug(slug)
		if !ok {
			continue
		}
		name := def.Category
		if name == "" {
			name = "Other"
		}
		item := counts[name]
		if item == nil {
			item = &tally{}
			counts[name] = item
		}
		item.total++
		if ready {
			item.ready++
		}
		if def.Free {
			free.total++
			if ready {
				free.ready++
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	stats := []CategoryStat{{ID: "all", Label: "All", Total: all.total, Ready: all.ready}}
	if free.total > 0 {
		stats = append(stats, CategoryStat{ID: "free", Label: "Free", Total: free.total, Ready: free.ready})
	}
	for _, name := range categoryOrder {
		item := counts[name]
		if item == nil || item.total == 0 {
			continue
		}
		stats = append(stats, CategoryStat{ID: name, Label: name, Total: item.total, Ready: item.ready})
		delete(counts, name)
	}
	var rest []string
	for name, item := range counts {
		if item.total > 0 {
			rest = append(rest, name)
		}
	}
	sort.Strings(rest)
	for _, name := range rest {
		item := counts[name]
		stats = append(stats, CategoryStat{ID: name, Label: name, Total: item.total, Ready: item.ready})
	}
	return stats, nil
}

var categoryOrder = []string{
	"Frontier",
	"Gateway",
	"Aggregator",
	"IaaS",
	"Sovereign / Cloud",
	"Specialized",
}

func (s *Store) GetProvider(slug string) (Provider, error) {
	row := s.db.QueryRow(`
SELECT p.slug, p.display_name, p.protocol, p.base_url, p.api_key_cipher, p.api_key_hint,
       p.enabled, p.updated_at,
       (SELECT COUNT(*) FROM models m WHERE m.provider_slug = p.slug),
       (SELECT COUNT(*) FROM models m WHERE m.provider_slug = p.slug AND m.active = 1)
FROM providers p WHERE p.slug = ?`, slug)
	item, err := scanProvider(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Provider{}, ErrNotFound
	}
	return item, err
}

type ProviderUpdate struct {
	APIKey  *string
	BaseURL *string
	Enabled *bool
}

func (s *Store) UpdateProvider(slug string, update ProviderUpdate) (Provider, error) {
	current, err := s.GetProvider(slug)
	if err != nil {
		return Provider{}, err
	}

	baseURL := current.BaseURL
	if update.BaseURL != nil {
		baseURL = strings.TrimRight(strings.TrimSpace(*update.BaseURL), "/")
	}
	enabled := current.Enabled
	if update.Enabled != nil {
		enabled = *update.Enabled
	}

	cipher := ""
	hint := current.APIKeyHint
	hasKey := current.HasAPIKey
	if update.APIKey != nil {
		trimmed := strings.TrimSpace(*update.APIKey)
		if trimmed == "" {
			hasKey = false
			hint = ""
			cipher = ""
		} else {
			sealed, err := secret.Seal(s.key, trimmed)
			if err != nil {
				return Provider{}, err
			}
			cipher = sealed
			hint = keyHint(trimmed)
			hasKey = true
		}
	}

	if enabled && !hasKey && update.APIKey == nil && !current.HasAPIKey {
		return Provider{}, errors.New("add an API key before enabling this provider")
	}
	if enabled && update.APIKey != nil && !hasKey {
		return Provider{}, errors.New("add an API key before enabling this provider")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if update.APIKey != nil {
		_, err = s.db.Exec(`UPDATE providers SET base_url = ?, enabled = ?, api_key_cipher = ?, api_key_hint = ?, updated_at = ? WHERE slug = ?`,
			baseURL, boolInt(enabled), cipher, hint, now, slug)
	} else {
		_, err = s.db.Exec(`UPDATE providers SET base_url = ?, enabled = ?, updated_at = ? WHERE slug = ?`,
			baseURL, boolInt(enabled), now, slug)
	}
	if err != nil {
		return Provider{}, err
	}
	return s.GetProvider(slug)
}

func (s *Store) ProviderSecret(slug string) (baseURL, apiKey, protocol string, enabled bool, err error) {
	var cipher string
	var enabledInt int
	err = s.db.QueryRow(`SELECT base_url, api_key_cipher, protocol, enabled FROM providers WHERE slug = ?`, slug).
		Scan(&baseURL, &cipher, &protocol, &enabledInt)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", "", false, ErrNotFound
	}
	if err != nil {
		return "", "", "", false, err
	}
	apiKey, err = secret.Open(s.key, cipher)
	if err != nil {
		return "", "", "", false, err
	}
	return baseURL, apiKey, protocol, enabledInt == 1, nil
}

func (s *Store) ListModels(slug string) ([]Model, error) {
	if _, err := s.GetProvider(slug); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(`
SELECT id, provider_slug, upstream_id, display_name, description, context_window, max_output_tokens,
       input_usd_per_million, output_usd_per_million, knowledge_cutoff, reasoning, active
FROM models WHERE provider_slug = ?
ORDER BY input_usd_per_million DESC, display_name`, slug)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanModels(rows)
}

func (s *Store) SetModelActive(slug, upstreamID string, active bool) (Model, error) {
	res, err := s.db.Exec(`UPDATE models SET active = ? WHERE provider_slug = ? AND upstream_id = ?`,
		boolInt(active), slug, upstreamID)
	if err != nil {
		return Model{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return Model{}, ErrNotFound
	}
	return s.getModel(slug, upstreamID)
}

func (s *Store) ListActiveModels() ([]Model, error) {
	rows, err := s.db.Query(`
SELECT m.id, m.provider_slug, m.upstream_id, m.display_name, m.description, m.context_window, m.max_output_tokens,
       m.input_usd_per_million, m.output_usd_per_million, m.knowledge_cutoff, m.reasoning, m.active
FROM models m
JOIN providers p ON p.slug = m.provider_slug
WHERE m.active = 1 AND p.enabled = 1 AND p.api_key_cipher != ''
ORDER BY m.display_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanModels(rows)
}

func (s *Store) ResolveRoute(modelRef string) (Route, error) {
	modelRef = strings.TrimSpace(modelRef)
	var row *sql.Row
	if strings.Contains(modelRef, "/") {
		row = s.db.QueryRow(`
SELECT m.id, m.provider_slug, m.upstream_id, m.display_name, m.description, m.context_window, m.max_output_tokens,
       m.input_usd_per_million, m.output_usd_per_million, m.knowledge_cutoff, m.reasoning, m.active,
       p.protocol, p.base_url, p.api_key_cipher, p.enabled
FROM models m JOIN providers p ON p.slug = m.provider_slug
WHERE m.id = ?`, modelRef)
	} else {
		row = s.db.QueryRow(`
SELECT m.id, m.provider_slug, m.upstream_id, m.display_name, m.description, m.context_window, m.max_output_tokens,
       m.input_usd_per_million, m.output_usd_per_million, m.knowledge_cutoff, m.reasoning, m.active,
       p.protocol, p.base_url, p.api_key_cipher, p.enabled
FROM models m JOIN providers p ON p.slug = m.provider_slug
WHERE m.upstream_id = ?`, modelRef)
	}

	var route Route
	var reasoning, active, enabled int
	var cipher string
	err := row.Scan(
		&route.Model.ID, &route.Model.ProviderSlug, &route.Model.UpstreamID, &route.Model.DisplayName,
		&route.Model.Description, &route.Model.ContextWindow, &route.Model.MaxOutputTokens,
		&route.Model.InputUSDPerMillion, &route.Model.OutputUSDPerMillion, &route.Model.KnowledgeCutoff,
		&reasoning, &active, &route.Protocol, &route.BaseURL, &cipher, &enabled,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Route{}, ErrNotFound
	}
	if err != nil {
		return Route{}, err
	}
	route.Model.Reasoning = reasoning == 1
	route.Model.Active = active == 1
	route.ProviderOn = enabled == 1
	route.APIKey, err = secret.Open(s.key, cipher)
	return route, err
}

func (s *Store) CreateRouterKey(name string) (CreatedKey, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "Default"
	}
	raw := make([]byte, 32)
	idRaw := make([]byte, 8)
	if _, err := rand.Read(raw); err != nil {
		return CreatedKey{}, err
	}
	if _, err := rand.Read(idRaw); err != nil {
		return CreatedKey{}, err
	}
	secretValue := "sk-airoute-" + hex.EncodeToString(raw)
	id := hex.EncodeToString(idRaw)
	now := time.Now().UTC().Format(time.RFC3339)
	prefix := secretValue[:16] + "…"
	_, err := s.db.Exec(`INSERT INTO router_keys (id, name, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?)`,
		id, name, hashKey(secretValue), prefix, now)
	if err != nil {
		return CreatedKey{}, err
	}
	return CreatedKey{
		RouterKey: RouterKey{ID: id, Name: name, Prefix: prefix, CreatedAt: now},
		Secret:    secretValue,
	}, nil
}

func (s *Store) ListRouterKeys() ([]RouterKey, error) {
	rows, err := s.db.Query(`SELECT id, name, key_prefix, created_at, last_used_at FROM router_keys ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []RouterKey
	for rows.Next() {
		var item RouterKey
		var last sql.NullString
		if err := rows.Scan(&item.ID, &item.Name, &item.Prefix, &item.CreatedAt, &last); err != nil {
			return nil, err
		}
		if last.Valid {
			item.LastUsedAt = &last.String
		}
		out = append(out, item)
	}
	if out == nil {
		out = []RouterKey{}
	}
	return out, rows.Err()
}

func (s *Store) DeleteRouterKey(id string) error {
	res, err := s.db.Exec(`DELETE FROM router_keys WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) AuthenticateRouterKey(token string) (string, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return "", ErrNotFound
	}
	sum := hashKey(token)
	var id, stored string
	err := s.db.QueryRow(`SELECT id, key_hash FROM router_keys WHERE key_hash = ?`, sum).Scan(&id, &stored)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if subtle.ConstantTimeCompare([]byte(sum), []byte(stored)) != 1 {
		return "", ErrNotFound
	}
	now := time.Now().UTC().Format(time.RFC3339)
	_, _ = s.db.Exec(`UPDATE router_keys SET last_used_at = ? WHERE id = ?`, now, id)
	return id, nil
}

func (s *Store) AddLog(input LogInput) error {
	_, err := s.db.Exec(`
INSERT INTO request_logs (
  created_at, source, router_key_id, model_id, status_code, latency_ms,
  prompt_tokens, completion_tokens, error_message
) VALUES (?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?)`,
		time.Now().UTC().Format(time.RFC3339), input.Source, input.RouterKeyID, input.ModelID,
		input.StatusCode, input.LatencyMS, input.PromptTokens, input.CompletionTokens, input.ErrorMessage)
	return err
}

func (s *Store) ListLogs(limit int) ([]RequestLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.db.Query(`
SELECT id, created_at, source, model_id, status_code, latency_ms, prompt_tokens, completion_tokens, error_message
FROM request_logs ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []RequestLog
	for rows.Next() {
		var item RequestLog
		if err := rows.Scan(&item.ID, &item.CreatedAt, &item.Source, &item.ModelID, &item.StatusCode, &item.LatencyMS, &item.PromptTokens, &item.CompletionTokens, &item.ErrorMessage); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if out == nil {
		out = []RequestLog{}
	}
	return out, rows.Err()
}

func (s *Store) Overview() (providers int, activeModels int, keys int, err error) {
	err = s.db.QueryRow(`SELECT COUNT(*) FROM providers`).Scan(&providers)
	if err != nil {
		return
	}
	err = s.db.QueryRow(`
SELECT COUNT(*) FROM models m
JOIN providers p ON p.slug = m.provider_slug
WHERE m.active = 1 AND p.enabled = 1 AND p.api_key_cipher != ''`).Scan(&activeModels)
	if err != nil {
		return
	}
	err = s.db.QueryRow(`SELECT COUNT(*) FROM router_keys`).Scan(&keys)
	return
}

func (s *Store) getModel(slug, upstreamID string) (Model, error) {
	row := s.db.QueryRow(`
SELECT id, provider_slug, upstream_id, display_name, description, context_window, max_output_tokens,
       input_usd_per_million, output_usd_per_million, knowledge_cutoff, reasoning, active
FROM models WHERE provider_slug = ? AND upstream_id = ?`, slug, upstreamID)
	var item Model
	var reasoning, active int
	err := row.Scan(&item.ID, &item.ProviderSlug, &item.UpstreamID, &item.DisplayName, &item.Description,
		&item.ContextWindow, &item.MaxOutputTokens, &item.InputUSDPerMillion, &item.OutputUSDPerMillion,
		&item.KnowledgeCutoff, &reasoning, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return Model{}, ErrNotFound
	}
	item.Reasoning = reasoning == 1
	item.Active = active == 1
	return item, err
}

type scanner interface {
	Scan(dest ...any) error
}

func scanProvider(row scanner) (Provider, error) {
	var item Provider
	var cipher string
	var enabled int
	err := row.Scan(&item.Slug, &item.DisplayName, &item.Protocol, &item.BaseURL, &cipher, &item.APIKeyHint,
		&enabled, &item.UpdatedAt, &item.TotalModels, &item.ActiveModels)
	if err != nil {
		return Provider{}, err
	}
	def, ok := catalog.BySlug(item.Slug)
	if ok {
		item.DocsURL = def.DocsURL
		item.Summary = def.Summary
		item.Category = def.Category
		item.Free = def.Free
	}
	item.HasAPIKey = cipher != ""
	item.Enabled = enabled == 1
	return item, nil
}

func scanModels(rows *sql.Rows) ([]Model, error) {
	var out []Model
	for rows.Next() {
		var item Model
		var reasoning, active int
		if err := rows.Scan(&item.ID, &item.ProviderSlug, &item.UpstreamID, &item.DisplayName, &item.Description,
			&item.ContextWindow, &item.MaxOutputTokens, &item.InputUSDPerMillion, &item.OutputUSDPerMillion,
			&item.KnowledgeCutoff, &reasoning, &active); err != nil {
			return nil, err
		}
		item.Reasoning = reasoning == 1
		item.Active = active == 1
		out = append(out, item)
	}
	if out == nil {
		out = []Model{}
	}
	return out, rows.Err()
}

func hashKey(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func keyHint(value string) string {
	if len(value) <= 4 {
		return "••••"
	}
	return "••••" + value[len(value)-4:]
}

func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}

func placeholders(n int) string {
	parts := make([]string, n)
	for i := range parts {
		parts[i] = "?"
	}
	return strings.Join(parts, ",")
}

func sqliteDSN(path string) (string, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	u := url.URL{Scheme: "file", Path: "/" + filepath.ToSlash(abs)}
	return u.String() + "?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)", nil
}

func FormatMissing(model string) string {
	return fmt.Sprintf("The model `%s` does not exist or is not active.", model)
}
