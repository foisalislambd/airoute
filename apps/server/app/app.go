package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"airoute/server/internal/httpapi"
	"airoute/server/internal/secret"
	"airoute/server/internal/store"
)

type Options struct {
	Addr    string
	DataDir string
	WebDir  string
	OnReady func()
}

func Run(ctx context.Context, opt Options) error {
	if opt.Addr == "" {
		opt.Addr = "127.0.0.1:8787"
	}
	if opt.DataDir == "" {
		dir, err := DefaultDataDir()
		if err != nil {
			return err
		}
		opt.DataDir = dir
	}
	if err := validateListenAddr(opt.Addr); err != nil {
		return err
	}
	if err := os.MkdirAll(opt.DataDir, 0o700); err != nil {
		return err
	}
	key, err := secret.LoadKey(opt.DataDir)
	if err != nil {
		return err
	}
	db, err := store.Open(filepath.Join(opt.DataDir, "airoute.db"), key)
	if err != nil {
		return err
	}
	defer db.Close()

	webDir := FindWebDir(opt.WebDir)
	api := httpapi.New(db, webDir, opt.Addr, opt.DataDir)
	server := &http.Server{
		Addr:              opt.Addr,
		Handler:           api.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
		MaxHeaderBytes:    1 << 20,
		BaseContext: func(_ net.Listener) context.Context {
			return ctx
		},
	}

	listener, err := net.Listen("tcp", opt.Addr)
	if err != nil {
		return err
	}
	log.Printf("AIRoute listening on http://%s", opt.Addr)
	log.Printf("data directory: %s", opt.DataDir)
	if webDir == "" {
		log.Printf("panel build not found; API is up, UI will come from the Vite dev server")
	} else {
		log.Printf("serving panel from %s", webDir)
	}
	errCh := make(chan error, 1)
	go func() {
		err := server.Serve(listener)
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
		errCh <- err
	}()
	if opt.OnReady != nil {
		opt.OnReady()
	}

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
		return nil
	case err := <-errCh:
		return err
	}
}

func validateListenAddr(addr string) error {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("listen address: %w", err)
	}
	if strings.EqualFold(host, "localhost") {
		return nil
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return errors.New("listen address must stay on this computer")
	}
	return nil
}

func DefaultDataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "airoute-router"), nil
}

func FindWebDir(explicit string) string {
	var candidates []string
	if explicit != "" {
		candidates = append(candidates, explicit)
	}
	candidates = append(candidates,
		filepath.Join("apps", "panel", "dist"),
		"dist",
	)
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), "panel"))
	}
	for _, candidate := range candidates {
		info, err := os.Stat(filepath.Join(candidate, "index.html"))
		if err == nil && !info.IsDir() {
			abs, err := filepath.Abs(candidate)
			if err == nil {
				return abs
			}
			return candidate
		}
	}
	return ""
}

func WaitHealthy(addr string) error {
	deadline := time.Now().Add(8 * time.Second)
	url := fmt.Sprintf("http://%s/health", addr)
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	return fmt.Errorf("AIRoute did not start on %s", addr)
}
