//go:build !windows

package main

import "log"

func showError(err error) {
	if err != nil {
		log.Print(err)
	}
}
