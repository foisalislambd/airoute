package catalog

// Model is one chat model a provider can expose through the router.
// Prices are standard-tier USD per 1M tokens from the provider docs.
type Model struct {
	UpstreamID          string
	DisplayName         string
	Description         string
	ContextWindow       int
	MaxOutputTokens     int
	InputUSDPerMillion  float64
	OutputUSDPerMillion float64
	KnowledgeCutoff     string
	Reasoning           bool
	Kind                string
}

// Provider is a built-in provider definition. User secrets live in SQLite,
// not in this catalog.
type Provider struct {
	Slug           string
	DisplayName    string
	Protocol       string
	DefaultBaseURL string
	DocsURL        string
	Summary        string
	Category       string
	Free           bool
	KeyOptional    bool
	AnonymousKey   string
	Models         []Model
}

const (
	ProtocolOpenAIChat  = "openai_chat"
	ProtocolAnthropic   = "anthropic_messages"
	ProtocolGemini      = "gemini_generate"
	ProtocolOllama      = "ollama_chat"
	ProtocolCohere      = "cohere_chat"
	ProtocolSearch      = "search"
	ProtocolEmbedding   = "embedding"
	ProtocolAudio       = "audio_speech"
	ProtocolMedia       = "native_media"
	ProtocolSDWebUI     = "sdwebui"
	ProtocolUnsupported = "unsupported"
	KindChat            = "chat"
	KindImage           = "image"
	KindVideo           = "video"
	KindAudio           = "audio"
	KindEmbedding       = "embedding"
	KindSearch          = "search"
)

func All() []Provider {
	return append([]Provider{OpenAI()}, generatedProviders()...)
}

func BySlug(slug string) (Provider, bool) {
	for _, provider := range All() {
		if provider.Slug == slug {
			return provider, true
		}
	}
	return Provider{}, false
}

func OpenAI() Provider {
	return Provider{
		Slug:           "openai",
		DisplayName:    "OpenAI",
		Protocol:       ProtocolOpenAIChat,
		DefaultBaseURL: "https://api.openai.com/v1",
		DocsURL:        "https://developers.openai.com/api/docs/models",
		Summary:        "Official OpenAI chat API. Requests use your key on this computer.",
		Category:       "Frontier",
		Models: []Model{
			{
				UpstreamID:          "gpt-6-astra",
				DisplayName:         "GPT-6 Astra",
				Description:         "Flagship model for complex reasoning and coding.",
				ContextWindow:       1_050_000,
				MaxOutputTokens:     128_000,
				InputUSDPerMillion:  10,
				OutputUSDPerMillion: 50,
				KnowledgeCutoff:     "2026-04-30",
				Reasoning:           true,
				Kind:                KindChat,
			},
			{
				UpstreamID:          "gpt-6.1-sol",
				DisplayName:         "GPT-6.1 Sol",
				Description:         "Near-flagship quality for complex work at a lower cost.",
				ContextWindow:       1_050_000,
				MaxOutputTokens:     128_000,
				InputUSDPerMillion:  2,
				OutputUSDPerMillion: 10,
				KnowledgeCutoff:     "2026-04-30",
				Reasoning:           true,
				Kind:                KindChat,
			},
			{
				UpstreamID:          "gpt-6-luna",
				DisplayName:         "GPT-6 Luna",
				Description:         "Efficient model for focused, high-volume tasks.",
				ContextWindow:       1_050_000,
				MaxOutputTokens:     128_000,
				InputUSDPerMillion:  0.10,
				OutputUSDPerMillion: 0.50,
				KnowledgeCutoff:     "2026-05-18",
				Reasoning:           true,
				Kind:                KindChat,
			},
			{
				UpstreamID:          "gpt-5.6-sol",
				DisplayName:         "GPT-5.6 Sol",
				Description:         "GPT-5.6 flagship tier. The gpt-5.6 alias points here.",
				ContextWindow:       1_050_000,
				MaxOutputTokens:     128_000,
				InputUSDPerMillion:  4,
				OutputUSDPerMillion: 20,
				KnowledgeCutoff:     "2026-02-16",
				Reasoning:           true,
				Kind:                KindChat,
			},
			{
				UpstreamID:          "gpt-5.6-terra",
				DisplayName:         "GPT-5.6 Terra",
				Description:         "Balances intelligence and cost in the GPT-5.6 family.",
				ContextWindow:       1_050_000,
				MaxOutputTokens:     128_000,
				InputUSDPerMillion:  2,
				OutputUSDPerMillion: 12,
				KnowledgeCutoff:     "2026-02-16",
				Reasoning:           true,
				Kind:                KindChat,
			},
			{
				UpstreamID:          "gpt-5.6-luna",
				DisplayName:         "GPT-5.6 Luna",
				Description:         "Cost-sensitive, high-volume GPT-5.6 tier.",
				ContextWindow:       1_050_000,
				MaxOutputTokens:     128_000,
				InputUSDPerMillion:  0.20,
				OutputUSDPerMillion: 1.20,
				KnowledgeCutoff:     "2026-02-16",
				Reasoning:           true,
				Kind:                KindChat,
			},
			{
				UpstreamID:          "gpt-4o",
				DisplayName:         "GPT-4o",
				Description:         "Previous omni model with text and image input.",
				ContextWindow:       128_000,
				MaxOutputTokens:     16_384,
				InputUSDPerMillion:  2.50,
				OutputUSDPerMillion: 10,
				KnowledgeCutoff:     "2023-10-01",
				Reasoning:           false,
				Kind:                KindChat,
			},
			{
				UpstreamID:          "gpt-4o-mini",
				DisplayName:         "GPT-4o mini",
				Description:         "Small, inexpensive GPT-4o for focused tasks.",
				ContextWindow:       128_000,
				MaxOutputTokens:     16_384,
				InputUSDPerMillion:  0.15,
				OutputUSDPerMillion: 0.60,
				KnowledgeCutoff:     "2023-10-01",
				Reasoning:           false,
				Kind:                KindChat,
			},
			{
				UpstreamID:  "gpt-image-1",
				DisplayName: "GPT Image 1",
				Description: "OpenAI image generation.",
				Kind:        KindImage,
			},
			{
				UpstreamID:  "dall-e-3",
				DisplayName: "DALL·E 3",
				Description: "OpenAI image generation.",
				Kind:        KindImage,
			},
			{
				UpstreamID:  "dall-e-2",
				DisplayName: "DALL·E 2",
				Description: "OpenAI image generation.",
				Kind:        KindImage,
			},
			{
				UpstreamID:  "sora-2",
				DisplayName: "Sora 2",
				Description: "OpenAI video generation.",
				Kind:        KindVideo,
			},
		},
	}
}
