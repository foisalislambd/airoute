package adapt

import (
	"encoding/json"
	"strings"
)

// Media is one image or video the playground can show.
type Media struct {
	Type string `json:"type"`
	Src  string `json:"src"`
}

// CollectMedia pulls image and video URLs out of a provider JSON body.
func CollectMedia(payload []byte) []Media {
	var doc any
	if err := json.Unmarshal(payload, &doc); err != nil {
		return nil
	}
	var out []Media
	seen := map[string]bool{}
	walkMedia(doc, "", &out, seen)
	return out
}

func walkMedia(value any, key string, out *[]Media, seen map[string]bool) {
	switch item := value.(type) {
	case map[string]any:
		if b64, _ := item["b64_json"].(string); b64 != "" {
			addMedia(out, seen, "image", "data:image/png;base64,"+b64)
		}
		if audio, _ := item["audio"].(string); strings.HasPrefix(audio, "data:audio/") {
			addMedia(out, seen, "audio", audio)
		}
		if raw, _ := item["url"].(string); raw != "" {
			addMedia(out, seen, mediaType(key, raw), raw)
		}
		for childKey, child := range item {
			walkMedia(child, childKey, out, seen)
		}
	case []any:
		for _, child := range item {
			walkMedia(child, key, out, seen)
		}
	}
}

func addMedia(out *[]Media, seen map[string]bool, kind, src string) {
	if src == "" || seen[src] {
		return
	}
	if !strings.HasPrefix(src, "http://") && !strings.HasPrefix(src, "https://") && !strings.HasPrefix(src, "data:image/") && !strings.HasPrefix(src, "data:video/") && !strings.HasPrefix(src, "data:audio/") {
		return
	}
	seen[src] = true
	*out = append(*out, Media{Type: kind, Src: src})
}

func mediaType(key, src string) string {
	lowerKey := strings.ToLower(key)
	lowerSrc := strings.ToLower(src)
	if strings.Contains(lowerKey, "video") || strings.Contains(lowerSrc, ".mp4") || strings.Contains(lowerSrc, ".webm") || strings.HasPrefix(src, "data:video/") {
		return "video"
	}
	return "image"
}
