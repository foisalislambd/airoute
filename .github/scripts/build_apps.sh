#!/usr/bin/env bash
set -euo pipefail

version="${VERSION:?package version is required}"
root="$(pwd)"
stage="${root}/dist/release"
rm -rf "${stage}"
mkdir -p "${stage}"

if [[ ! -f apps/panel/dist/index.html ]]; then
  echo "panel build is missing; run npm run build:panel first" >&2
  exit 1
fi

targets=(
  "windows amd64"
  "linux amd64"
  "darwin amd64"
  "darwin arm64"
)

for spec in "${targets[@]}"; do
  read -r goos goarch <<<"${spec}"
  work="$(mktemp -d)"
  bin="AIRoute"
  if [[ "${goos}" == "windows" ]]; then
    bin="AIRoute.exe"
  fi
  ldflags="-s -w"
  if [[ "${goos}" == "windows" ]]; then
    ldflags="${ldflags} -H windowsgui"
  fi
  CGO_ENABLED=0 GOOS="${goos}" GOARCH="${goarch}" \
    go build -trimpath -ldflags "${ldflags}" -o "${work}/${bin}" ./apps/desktop/cmd/airoute-desktop
  chmod +x "${work}/${bin}" || true
  mkdir -p "${work}/panel"
  cp -a apps/panel/dist/. "${work}/panel/"
  archive="${stage}/AIRoute-${version}-${goos}-${goarch}.zip"
  (cd "${work}" && zip -qr "${archive}" .)
  rm -rf "${work}"
  echo "built ${archive}"
done

cat > "${stage}/notes.md" <<EOF
AIRoute ${version}

Each archive is the desktop app plus the panel folder it serves.

- Windows: unzip and run \`AIRoute.exe\`. Closing the window leaves the router running. The tray icon opens it again or quits it. WebView2 comes with current Windows 10 and 11.
- macOS and Linux: unzip, run \`./AIRoute\`. Closing the browser tab leaves the router running until you stop the process.

The app listens on \`127.0.0.1:8787\`. Data stays in the local airoute-router folder.

Install the same version from npm with \`npm install -g airoute\`, then run \`airoute\`. The web panel opens in the browser. GitHub Packages has \`@foisalislambd/airoute\`.

Docker: \`docker run -d --name airoute -p 127.0.0.1:8787:8787 -v airoute-data:/data foisalislambd/airoute:latest\`. The panel is at http://127.0.0.1:8787.
EOF
