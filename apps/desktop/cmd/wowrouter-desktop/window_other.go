//go:build !windows

package main

import (
	"fmt"
	"os/exec"
	"runtime"
)

func openWindow(url string) error {
	release, ok := acquireUILock()
	if !ok {
		return nil
	}
	defer release()
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	fmt.Println("WowRouter is open at", url)
	select {}
}
