package secret

import "testing"

func TestSealRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	sealed, err := Seal(key, "sk-test-value")
	if err != nil {
		t.Fatal(err)
	}
	got, err := Open(key, sealed)
	if err != nil {
		t.Fatal(err)
	}
	if got != "sk-test-value" {
		t.Fatalf("got %q", got)
	}
	if _, err := Open(key, ""); err != nil {
		t.Fatal(err)
	}
}
