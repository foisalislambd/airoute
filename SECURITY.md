# Security

WowRouter stores provider keys on your computer and listens only on loopback. If you believe you found a way to leak those keys, bypass the router key, or make the server accept a non-local address, please report it in private.

## Report a vulnerability

Use GitHub private vulnerability reporting:

https://github.com/foisalislambd/wowrouter/security/advisories/new

Include what you did, what you expected, and what happened. If you can, add the WowRouter version from the root `package.json` and your operating system.

Do not include live provider keys, router keys, or your `secret.key` file. A redacted log is enough.

Please give the maintainers a chance to fix the issue before you publish the details.

## What not to send this way

A failed model call, a missing provider, or a question about Cursor setup is not a security report. Open a normal issue for those.

The panel has no login because it is only served on localhost. Putting port 8787 on the public internet is unsafe. That is outside the app's threat model. Do not tunnel it.
