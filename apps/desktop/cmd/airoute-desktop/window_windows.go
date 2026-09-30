//go:build windows

package main

import (
	"errors"

	"github.com/jchv/go-webview2"
)

var errWebView = errors.New("WebView2 window could not be created")

func openWindow(url string) error {
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
