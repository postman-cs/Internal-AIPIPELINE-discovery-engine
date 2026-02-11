/**
 * Structured JSON Logger
 *
 * Outputs JSON-formatted log lines for easy parsing by log aggregators
 * (Datadog, ELK, CloudWatch, etc.). In development, falls back to
 * human-readable format.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: unknown;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const rawLogLevel = process.env.LOG_LEVEL || (IS_PRODUCTION ? "info" : "debug");
const LOG_LEVEL: LogLevel = (rawLogLevel in LEVEL_ORDER)
  ? (rawLogLevel as LogLevel)
  : (IS_PRODUCTION ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[LOG_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  if (IS_PRODUCTION) {
    return JSON.stringify(entry);
  }
  // Dev-friendly format
  const { level, message, timestamp, service, ...extra } = entry;
  const extraStr = Object.keys(extra).length > 0 ? ` ${JSON.stringify(extra)}` : "";
  return `[${timestamp}] ${level.toUpperCase().padEnd(5)} [${service}] ${message}${extraStr}`;
}

function createLogger(service: string) {
  function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service,
      ...meta,
    };

    const formatted = formatEntry(entry);

    switch (level) {
      case "error":
        console.error(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
    /** Create a child logger with additional default context */
    child: (childService: string) => createLogger(`${service}.${childService}`),
  };
}

export const logger = createLogger("ai-pipeline");
export type Logger = ReturnType<typeof createLogger>;
