/**
 * Sync Logger
 *
 * Lightweight circular log buffer for sync events.
 * Logs are stored in memory (survives navigation, cleared on app restart)
 * and also forwarded to the Metro console.
 *
 * Max 200 entries - oldest are dropped when the buffer is full.
 */

export type SyncLogLevel = "info" | "success" | "warn" | "error";

export interface SyncLogEntry {
  id: string;
  time: string;        // "HH:MM:SS"
  level: SyncLogLevel;
  source: string;      // "SyncService" | "LocalHistory" | "OfflineQueue"
  message: string;
}

const MAX_ENTRIES = 200;
let _entries: SyncLogEntry[] = [];
let _listeners: Array<(entries: SyncLogEntry[]) => void> = [];

function _now(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const CONSOLE_PREFIX: Record<SyncLogLevel, string> = {
  info:    "ℹ️ ",
  success: "✅",
  warn:    "⚠️ ",
  error:   "❌",
};

function _push(level: SyncLogLevel, source: string, message: string) {
  const entry: SyncLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: _now(),
    level,
    source,
    message,
  };

  _entries = [entry, ..._entries].slice(0, MAX_ENTRIES);

  // Mirror to Metro / React Native console
  const prefix = CONSOLE_PREFIX[level];
  const line = `[Sync][${source}] ${prefix} ${message}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  _listeners.forEach((fn) => fn(_entries));
}

export const syncLogger = {
  info:    (source: string, message: string) => _push("info",    source, message),
  success: (source: string, message: string) => _push("success", source, message),
  warn:    (source: string, message: string) => _push("warn",    source, message),
  error:   (source: string, message: string) => _push("error",   source, message),

  /** Get a snapshot of all log entries (newest first). */
  getEntries(): SyncLogEntry[] {
    return _entries;
  },

  /** Subscribe to log updates. Returns an unsubscribe function. */
  subscribe(fn: (entries: SyncLogEntry[]) => void): () => void {
    _listeners.push(fn);
    return () => {
      _listeners = _listeners.filter((l) => l !== fn);
    };
  },

  /** Clear the log buffer. */
  clear() {
    _entries = [];
    _listeners.forEach((fn) => fn(_entries));
  },
};
