//go:build windows

package main

import (
	"log"
	"syscall"
	"unsafe"
)

var (
	user32          = syscall.NewLazyDLL("user32.dll")
	procMessageBoxW = user32.NewProc("MessageBoxW")
)

func showError(err error) {
	if err == nil {
		return
	}
	log.Print(err)
	text, textErr := syscall.UTF16PtrFromString(err.Error())
	title, titleErr := syscall.UTF16PtrFromString("WowRouter")
	if textErr != nil || titleErr != nil {
		return
	}
	_, _, _ = procMessageBoxW.Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0x10)
}
