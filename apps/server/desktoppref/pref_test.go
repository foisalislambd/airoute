package desktoppref

import (
	"os"
	"path/filepath"
	"testing"
)

func TestMissingPrefStartsWithWindows(t *testing.T) {
	dir := t.TempDir()
	if got := Load(dir); !got.StartWithWindows {
		t.Fatal(got)
	}
	if Exists(dir) {
		t.Fatal("missing file should not count as saved")
	}
}

func TestSaveRoundTrip(t *testing.T) {
	dir := t.TempDir()
	if err := Save(dir, Pref{StartWithWindows: false}); err != nil {
		t.Fatal(err)
	}
	if got := Load(dir); got.StartWithWindows {
		t.Fatal(got)
	}
	if _, err := os.Stat(filepath.Join(dir, "desktop.json")); err != nil {
		t.Fatal(err)
	}
}
