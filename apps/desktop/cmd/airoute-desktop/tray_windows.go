//go:build windows

package main

import (
	"sync"

	"github.com/getlantern/systray"
)

var (
	trayMu  sync.Mutex
	traySet func(bool)
)

func setTrayStart(on bool) {
	trayMu.Lock()
	fn := traySet
	trayMu.Unlock()
	if fn != nil {
		fn(on)
	}
}

func runTray(startWithWindows bool, onOpen func() error, onStart func(bool), onQuit func(), errs <-chan error) {
	systray.Run(func() {
		systray.SetIcon(trayIcon())
		systray.SetTooltip("AIRoute is running in the background")
		openItem := systray.AddMenuItem("Open", "Open the AIRoute window")
		startItem := systray.AddMenuItemCheckbox("Start with Windows", "Run the router at login", startWithWindows)
		quitItem := systray.AddMenuItem("Quit", "Stop the router")
		trayMu.Lock()
		traySet = func(on bool) {
			if on {
				startItem.Check()
				return
			}
			startItem.Uncheck()
		}
		trayMu.Unlock()
		go func() {
			for {
				select {
				case err := <-errs:
					if err != nil {
						showError(err)
					}
					onQuit()
					systray.Quit()
					return
				case <-openItem.ClickedCh:
					if err := onOpen(); err != nil {
						showError(err)
					}
				case <-startItem.ClickedCh:
					next := !startItem.Checked()
					if next {
						startItem.Check()
					} else {
						startItem.Uncheck()
					}
					onStart(next)
				case <-quitItem.ClickedCh:
					onQuit()
					systray.Quit()
					return
				}
			}
		}()
	}, func() {})
}
