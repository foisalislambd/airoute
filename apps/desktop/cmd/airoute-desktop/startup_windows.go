//go:build windows

package main

import (
	"errors"
	"fmt"
	"os"

	"golang.org/x/sys/windows/registry"
)

func setStartWithWindows(on bool) error {
	key, _, err := registry.CreateKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Run`, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer key.Close()
	if !on {
		err = key.DeleteValue("AIRoute")
		if errors.Is(err, registry.ErrNotExist) {
			return nil
		}
		return err
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	return key.SetStringValue("AIRoute", fmt.Sprintf(`"%s" --agent`, exe))
}
