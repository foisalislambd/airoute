# wowrouter

Local OpenAI-compatible router. Providers, keys, and models are managed in the web panel.

```bash
npm install -g wowrouter
wowrouter
```

`npm install -g airoute` is the same program. The `airoute` command runs it too.

The same release is also on GitHub Packages as `@foisalislambd/wowrouter` and `@foisalislambd/airoute`.

The panel opens at `http://127.0.0.1:8787`. Point Cursor or any OpenAI client at:

```text
http://127.0.0.1:8787/v1
```

Use a router key from the panel's API keys page. Turn on the provider and the model you want to call.

```bash
wowrouter status
wowrouter stop
wowrouter --detach
wowrouter --addr 127.0.0.1:8787 --no-open
```

Closing the browser tab does not stop the router. `wowrouter stop` does.

Source and guides: https://github.com/foisalislambd/airoute

MIT licensed.
