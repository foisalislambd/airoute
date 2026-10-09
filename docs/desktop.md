# Desktop app

The desktop download is the same router as the npm package, plus a native window. Download it from the [releases](https://github.com/foisalislambd/airoute/releases) page and keep the program next to the `panel` folder.

## Windows

Run `WowRouter.exe`.

- The first launch starts the router in the background and opens the window.
- Closing the window leaves the router running. Cursor can still use `http://127.0.0.1:8787/v1`.
- The tray icon has **Open**, **Start with Windows**, and **Quit**. Quit is what actually stops the router.
- Opening the app again focuses the window you already have. It does not stack a second window.
- If the router is already running, opening the app only shows the window.

**Start with Windows** is also a checkbox on the panel's Settings page. The router starts at login with no window, using `WowRouter.exe --agent`. The tray is still there.

Two more launches, if you need them:

| Launch | Result |
| --- | --- |
| `WowRouter.exe --agent` | Router and tray, no window |
| `WowRouter.exe --ui` | Window only. If the router is stopped, you get "WowRouter is not running." |

The app writes `agent.log` in the data folder when it needs to record a startup problem. The folder is in [Your data](your-data.md).

## macOS and Linux

Unzip the archive and run `./WowRouter`. The router stays up after you close the browser tab. Stop the process when you want it to exit. A second launch does not open a second server if the first one is still healthy.

## npm and the desktop app together

Both want port `8787` by default. If the desktop app is already running, `wowrouter` in a terminal will notice and open the panel instead of starting another server. `airoute` does the same. Quit from the tray before you expect `wowrouter stop` to shut down an old desktop build.

## WebView2 on Windows

The window uses WebView2, which current Windows 10 and 11 already include. If a window fails to open and the router is still healthy, install the WebView2 runtime from Microsoft and start the app again. The API at `http://127.0.0.1:8787/v1` does not need the window.
