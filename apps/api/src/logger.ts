import { pino, type LoggerOptions } from "pino";
import type { AppConfig } from "./config.js";

/**
 * Structured JSON logging to stdout (12-factor Factor XI: logs as event
 * streams). Redacts obvious secrets so tokens/medical PII never hit logs.
 *
 * We expose the pino *options* (not a constructed instance) for Fastify, so
 * Fastify keeps its default logger type. `createLogger` builds a standalone
 * instance for non-request contexts (e.g., the scheduled reminders job).
 */
export function loggerOptions(config: AppConfig): LoggerOptions {
  return {
    level: config.logLevel,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.token",
        "*.medical",
      ],
      censor: "[redacted]",
    },
    base: { service: "troopers-api", env: config.nodeEnv },
    formatters: { level: (label) => ({ level: label }) },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
}

export function createLogger(config: AppConfig) {
  return pino(loggerOptions(config));
}

export type Logger = ReturnType<typeof createLogger>;
