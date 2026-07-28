import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_NAME = "airoute";

function normalizeConfiguredPath(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? path.resolve(trimmed) : null;
}

function safeHomeDir() {
  try {
    return os.homedir();
  } catch {
    return process.env.HOME || process.env.USERPROFILE || os.tmpdir();
  }
}

export function getLegacyDotDataDir(homeDir = safeHomeDir()) {
  return path.join(homeDir, `.${APP_NAME}`);
}

function getOmnirouteLegacyDotDataDir(homeDir = safeHomeDir()) {
  return path.join(homeDir, ".omniroute");
}

function isExistingDir(dir) {
  try {
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export function getDefaultDataDir() {
  const homeDir = safeHomeDir();
  const legacyDir = getLegacyDotDataDir(homeDir);
  const omnirouteLegacy = getOmnirouteLegacyDotDataDir(homeDir);

  if (isExistingDir(legacyDir)) {
    return legacyDir;
  }
  if (isExistingDir(omnirouteLegacy)) {
    return omnirouteLegacy;
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
    const winAiroute = path.join(appData, APP_NAME);
    const winOmni = path.join(appData, "omniroute");
    if (isExistingDir(winAiroute)) return winAiroute;
    if (isExistingDir(winOmni)) return winOmni;
    return winAiroute;
  }

  const xdgConfigHome = normalizeConfiguredPath(process.env.XDG_CONFIG_HOME);
  if (xdgConfigHome) {
    const xdgAiroute = path.join(xdgConfigHome, APP_NAME);
    const xdgOmni = path.join(xdgConfigHome, "omniroute");
    if (isExistingDir(xdgAiroute)) return xdgAiroute;
    if (isExistingDir(xdgOmni)) return xdgOmni;
    return xdgAiroute;
  }

  return legacyDir;
}

export function resolveDataDir() {
  const configured = normalizeConfiguredPath(process.env.DATA_DIR);
  if (configured) return configured;

  return getDefaultDataDir();
}

export function resolveStoragePath(dataDir = resolveDataDir()) {
  return path.join(dataDir, "storage.sqlite");
}
