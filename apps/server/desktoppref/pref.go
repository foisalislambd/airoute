package desktoppref

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Pref is the desktop agent's saved choice. The router keeps running when the
// window closes. StartWithWindows launches that background agent at login.
type Pref struct {
	StartWithWindows bool `json:"startWithWindows"`
}

func Path(dir string) string {
	return filepath.Join(dir, "desktop.json")
}

func Load(dir string) Pref {
	fallback := Pref{StartWithWindows: true}
	body, err := os.ReadFile(Path(dir))
	if err != nil {
		return fallback
	}
	var raw struct {
		StartWithWindows *bool `json:"startWithWindows"`
	}
	if json.Unmarshal(body, &raw) != nil || raw.StartWithWindows == nil {
		return fallback
	}
	return Pref{StartWithWindows: *raw.StartWithWindows}
}

func Exists(dir string) bool {
	info, err := os.Stat(Path(dir))
	return err == nil && !info.IsDir()
}

func Save(dir string, pref Pref) error {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	body, err := json.Marshal(pref)
	if err != nil {
		return err
	}
	target := Path(dir)
	tmp := target + ".tmp"
	if err := os.WriteFile(tmp, body, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, target)
}
