/**
 * GET  /api/system/env/repair  — Returns OAuth env repair status
 * POST  /api/system/env/repair  — Backups .env and adds missing OAuth defaults into .env
 *
 * Security: Requires admin authentication (same as other management routes).
 * Safety: Only fills missing OAuth defaults from .env.example.
 */
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/shared/utils/apiAuth";
import { REPO_ROOT } from "@/lib/repoRoot";

type SyncHelpers = {
  getEnvSyncPlan: (opts: {
    scope: string;
    rootDir: string;
  }) => {
    available: boolean;
    created: boolean;
    added: string[];
    missingEntries: Array<{ key: string }>;
  };
  syncEnv: (opts: { scope: string; quiet: boolean; rootDir: string }) => {
    created: boolean;
    added: string[];
  };
};

async function loadSyncHelpers(): Promise<SyncHelpers> {
  const mod = await import(pathToFileURL(join(REPO_ROOT, "scripts/dev/sync-env.mjs")).href);
  return {
    getEnvSyncPlan: mod.getEnvSyncPlan,
    syncEnv: mod.syncEnv,
  };
}

function createEnvBackup() {
  const envPath = join(REPO_ROOT, ".env");

  if (!existsSync(envPath)) {
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(REPO_ROOT, `.env.backup-${timestamp}`);
  copyFileSync(envPath, backupPath);
  return backupPath;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { getEnvSyncPlan } = await loadSyncHelpers();
    const plan = getEnvSyncPlan({ scope: "oauth", rootDir: REPO_ROOT });

    return NextResponse.json({
      available: plan.available,
      created: plan.created,
      added: plan.added,
      missingCount: plan.missingEntries.length,
      missingKeys: plan.missingEntries.map((entry: { key: string }) => entry.key),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to inspect env defaults" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { syncEnv, getEnvSyncPlan } = await loadSyncHelpers();
    const backupPath = createEnvBackup();
    const result = syncEnv({ scope: "oauth", quiet: true, rootDir: REPO_ROOT });
    const plan = getEnvSyncPlan({ scope: "oauth", rootDir: REPO_ROOT });

    return NextResponse.json({
      success: true,
      backupPath,
      created: result.created,
      added: result.added,
      missingCount: plan.missingEntries.length,
      missingKeys: plan.missingEntries.map((entry: { key: string }) => entry.key),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error)?.message || "Failed to repair env defaults" },
      { status: 500 }
    );
  }
}
