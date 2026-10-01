//go:build !windows

package main

import (
	"os"
	"os/signal"
	"syscall"
)

func setTrayStart(bool) {}

func runTray(_ bool, _ func() error, _ func(bool), onQuit func(), errs <-chan error) {
	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	select {
	case <-signals:
		onQuit()
	case err := <-errs:
		if err != nil {
			showError(err)
		}
		onQuit()
	}
}
