//go:build !windows

package main

func setStartWithWindows(bool) error {
	return nil
}
