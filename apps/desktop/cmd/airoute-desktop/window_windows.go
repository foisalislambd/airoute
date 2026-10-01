//go:build windows

package main

import (
	"errors"
	"syscall"
	"unsafe"

	"github.com/jchv/go-webview2"
)

var (
	procFindWindowW         = user32.NewProc("FindWindowW")
	procShowWindow          = user32.NewProc("ShowWindow")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
)

var errWebView = errors.New("WebView2 window could not be created")

func openWindow(url string) error {
	release, ok := acquireUILock()
	if !ok {
		focusExistingWindow()
		return nil
	}
	defer release()
	window := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		WindowOptions: webview2.WindowOptions{
			Title:  "AIRoute",
			Width:  1280,
			Height: 840,
			Center: true,
		},
	})
	if window == nil {
		return errWebView
	}
	defer window.Destroy()
	window.Navigate(url)
	window.Run()
	return nil
}

func focusExistingWindow() {
	title, err := syscall.UTF16PtrFromString("AIRoute")
	if err != nil {
		return
	}
	hwnd, _, _ := procFindWindowW.Call(0, uintptr(unsafe.Pointer(title)))
	if hwnd == 0 {
		return
	}
	const swRestore = 9
	_, _, _ = procShowWindow.Call(hwnd, swRestore)
	_, _, _ = procSetForegroundWindow.Call(hwnd)
}
