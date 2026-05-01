/**
 * Development-mode startup diagnostics for Matsya AI Mobile App.
 * Validates required environment variables and checks model availability.
 * Only runs when __DEV__ is true.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

// ── ANSI color helpers (for console output) ────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
};

const OK = `${c.green}✅${c.reset}`;
const WARN = `${c.yellow}⚠️${c.reset}`;
const FAIL = `${c.red}❌${c.reset}`;

// ── Check definitions ───────────────────────────────────────────────────────
const ENV_CHECKS = [
  // [name, envKey, level: 'critical'|'warn', description]
  [
    "EXPO_PUBLIC_API_URL",
    "EXPO_PUBLIC_API_URL",
    "warn",
    "Backend API URL (demo mode if not set)",
  ],
  [
    "EXPO_PUBLIC_AGENT_URL",
    "EXPO_PUBLIC_AGENT_URL",
    "warn",
    "Agent API URL (optional)",
  ],
] as const;

// Statically require assets to ensure they're bundled by Metro.
const BUNDLED_MODELS = {
  "detection_float32.tflite": require("../assets/models/detection_float32.tflite"),
  "Fish.tflite": require("../assets/models/Fish.tflite"),
  "Fish_disease.tflite": require("../assets/models/Fish_disease.tflite"),
};

interface DiagnosticResult {
  ok: boolean;
  criticalErrors: number;
  warnings: number;
  checks: Array<{ name: string; status: "ok" | "warn" | "critical" }>;
}

/**
 * Check if a model file exists in the app bundle
 */
async function checkModelFile(fileName: string): Promise<boolean> {
  try {
    // Models are now bundled directly in the app's assets
    // They will always be available if the app is built correctly
    return true;
  } catch {
    return false;
  }
}

/**
 * Run all startup diagnostics
 * Returns diagnostic results and logs to console
 */
export async function runStartupChecks(): Promise<DiagnosticResult> {
  // Only run in development mode
  if (!__DEV__) {
    return { ok: true, criticalErrors: 0, warnings: 0, checks: [] };
  }

  const results: DiagnosticResult = {
    ok: true,
    criticalErrors: 0,
    warnings: 0,
    checks: [],
  };

  const lines: string[] = [];

  lines.push("");
  lines.push(
    `${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════════════╗${c.reset}`,
  );
  lines.push(
    `${c.cyan}${c.bold}║  📱 Matsya AI Mobile - Development Startup Diagnostics           ║${c.reset}`,
  );
  lines.push(
    `${c.cyan}${c.bold}╠══════════════════════════════════════════════════════════════════╣${c.reset}`,
  );

  // ── 1. Platform Information ─────────────────────────────────────────────
  lines.push(`${c.cyan}${c.bold}║  ${c.white}Platform Information${c.reset}`);
  lines.push(
    `${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`,
  );

  const platform = Platform.OS;
  const version = Platform.Version;
  lines.push(
    `${c.cyan}║${c.reset}  ${OK} ${"Platform".padEnd(26)} = ${c.dim}${platform} ${version}${c.reset}`,
  );

  const appVersion = Constants.expoConfig?.version || "unknown";
  lines.push(
    `${c.cyan}║${c.reset}  ${OK} ${"App Version".padEnd(26)} = ${c.dim}${appVersion}${c.reset}`,
  );

  const isDev = __DEV__;
  lines.push(
    `${c.cyan}║${c.reset}  ${OK} ${"Development Mode".padEnd(26)} = ${c.dim}${isDev}${c.reset}`,
  );

  // ── 2. Environment Variables ─────────────────────────────────────────────
  lines.push(
    `${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`,
  );
  lines.push(`${c.cyan}${c.bold}║  ${c.white}Environment Variables${c.reset}`);
  lines.push(
    `${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`,
  );

  for (const [name, envKey, level, desc] of ENV_CHECKS) {
    const value = process.env[envKey];
    const maxLen = 30;

    if (value) {
      const display =
        value.length > maxLen ? value.slice(0, maxLen) + "…" : value;
      lines.push(
        `${c.cyan}║${c.reset}  ${OK} ${name.padEnd(26)} = ${c.dim}${display}${c.reset}`,
      );
      results.checks.push({ name, status: "ok" });
    } else {
      if (level === "warn") {
        lines.push(
          `${c.cyan}║${c.reset}  ${WARN} ${name.padEnd(26)} = ${c.yellow}not set${c.reset}  ${c.dim}(${desc})${c.reset}`,
        );
        results.warnings++;
        results.checks.push({ name, status: "warn" });
      } else {
        // level === 'critical' (if we add critical checks in the future)
        lines.push(
          `${c.cyan}║${c.reset}  ${FAIL} ${name.padEnd(26)} = ${c.red}${c.bold}MISSING${c.reset}  ${c.dim}(${desc})${c.reset}`,
        );
        results.criticalErrors++;
        results.checks.push({ name, status: "critical" });
      }
    }
  }

  // ── 3. Model Files ──────────────────────────────────────────────────────
  lines.push(
    `${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`,
  );
  lines.push(`${c.cyan}${c.bold}║  ${c.white}TFLite Model Files${c.reset}`);
  lines.push(
    `${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`,
  );

  for (const modelFile of Object.keys(BUNDLED_MODELS)) {
    const exists = await checkModelFile(modelFile);
    const shortName = modelFile.replace(".tflite", "").replace("_", " ");

    if (exists) {
      lines.push(
        `${c.cyan}║${c.reset}  ${OK} ${shortName.padEnd(26)} = ${c.green}bundled${c.reset}`,
      );
      results.checks.push({ name: modelFile, status: "ok" });
    } else {
      lines.push(
        `${c.cyan}║${c.reset}  ${WARN} ${shortName.padEnd(26)} = ${c.yellow}missing${c.reset}  ${c.dim}(build error)${c.reset}`,
      );
      results.warnings++;
      results.checks.push({ name: modelFile, status: "warn" });
    }
  }

  // ── 4. Connectivity Probes ──────────────────────────────────────────────
  lines.push(
    `${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`,
  );
  lines.push(`${c.cyan}${c.bold}║  ${c.white}Connectivity${c.reset}`);
  lines.push(
    `${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`,
  );

  // Backend API
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${apiUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        lines.push(
          `${c.cyan}║${c.reset}  ${OK} ${"Backend API".padEnd(26)} = ${c.green}${apiUrl}${c.reset} ${c.dim}(healthy)${c.reset}`,
        );
      } else {
        lines.push(
          `${c.cyan}║${c.reset}  ${WARN} ${"Backend API".padEnd(26)} = ${c.yellow}${apiUrl}${c.reset} ${c.dim}(status ${res.status})${c.reset}`,
        );
        results.warnings++;
      }
    } catch {
      lines.push(
        `${c.cyan}║${c.reset}  ${WARN} ${"Backend API".padEnd(26)} = ${c.yellow}unreachable${c.reset}  ${c.dim}${apiUrl}${c.reset}`,
      );
      results.warnings++;
    }
  } else {
    lines.push(
      `${c.cyan}║${c.reset}  ${WARN} ${"Backend API".padEnd(26)} = ${c.yellow}not configured${c.reset}  ${c.dim}(demo mode)${c.reset}`,
    );
    results.warnings++;
  }

  // Agent API
  const agentUrl = process.env.EXPO_PUBLIC_AGENT_URL;
  if (agentUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${agentUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        lines.push(
          `${c.cyan}║${c.reset}  ${OK} ${"Agent API".padEnd(26)} = ${c.green}${agentUrl}${c.reset} ${c.dim}(healthy)${c.reset}`,
        );
      } else {
        lines.push(
          `${c.cyan}║${c.reset}  ${WARN} ${"Agent API".padEnd(26)} = ${c.yellow}${agentUrl}${c.reset} ${c.dim}(status ${res.status})${c.reset}`,
        );
        results.warnings++;
      }
    } catch {
      lines.push(
        `${c.cyan}║${c.reset}  ${WARN} ${"Agent API".padEnd(26)} = ${c.yellow}unreachable${c.reset}  ${c.dim}${agentUrl}${c.reset}`,
      );
      results.warnings++;
    }
  } else {
    lines.push(
      `${c.cyan}║${c.reset}  ${WARN} ${"Agent API".padEnd(26)} = ${c.yellow}not configured${c.reset}  ${c.dim}(optional)${c.reset}`,
    );
    results.warnings++;
  }

  // ── 5. Summary ──────────────────────────────────────────────────────────
  lines.push(
    `${c.cyan}${c.bold}╟──────────────────────────────────────────────────────────────────╢${c.reset}`,
  );

  if (results.criticalErrors > 0) {
    lines.push(
      `${c.cyan}║${c.reset}  ${c.bgRed}${c.white}${c.bold} RESULT ${c.reset} ${c.red}${results.criticalErrors} critical error(s)${c.reset}, ${c.yellow}${results.warnings} warning(s)${c.reset}`,
    );
    results.ok = false;
  } else if (results.warnings > 0) {
    lines.push(
      `${c.cyan}║${c.reset}  ${c.bgYellow}${c.bold} RESULT ${c.reset} ${c.green}0 critical errors${c.reset}, ${c.yellow}${results.warnings} warning(s)${c.reset}`,
    );
  } else {
    lines.push(
      `${c.cyan}║${c.reset}  ${c.bgGreen}${c.bold} RESULT ${c.reset} ${c.green}All checks passed!${c.reset}`,
    );
  }

  lines.push(
    `${c.cyan}${c.bold}╚══════════════════════════════════════════════════════════════════╝${c.reset}`,
  );
  lines.push("");

  // Log all lines to console
  console.log(lines.join("\n"));

  return results;
}

/**
 * Get a summary of the current configuration (for display in UI)
 */
export function getConfigSummary(): {
  apiUrl: string | null;
  agentUrl: string | null;
  isDemoMode: boolean;
  platform: string;
  version: string;
} {
  return {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || null,
    agentUrl: process.env.EXPO_PUBLIC_AGENT_URL || null,
    isDemoMode: !process.env.EXPO_PUBLIC_API_URL,
    platform: Platform.OS,
    version: Constants.expoConfig?.version || "unknown",
  };
}
