import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import type { AppConfig } from "./config.js";
import { createLogger, loggerOptions, type Logger } from "./logger.js";
import { createMetrics, type Metrics } from "./metrics.js";
import { createFeatureFlags, type FeatureFlags } from "./featureFlags.js";
import { authenticate } from "./auth.js";
import { AppError } from "./errors.js";
import { createRepositoryFactory, type RepositoryFactory } from "./core/pgRepository.js";

import { registerMembers } from "./domain/members/routes.js";
import type { Member } from "./domain/members/member.js";
import { registerAdvancement } from "./domain/advancement.js";
import { registerMoney, type Transaction } from "./domain/money.js";
import { registerEvents } from "./domain/events.js";
import { registerCommunication } from "./domain/communication.js";
import { registerSettings } from "./domain/settings.js";
import { registerPhotos } from "./domain/photos.js";
import { registerSimpleResources } from "./domain/simpleResources.js";
import { registerReporting } from "./domain/reporting.js";
import { registerSync } from "./domain/sync.js";

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  metrics: Metrics;
  flags: FeatureFlags;
  repos: RepositoryFactory;
}

export async function buildApp(config: AppConfig): Promise<{
  app: FastifyInstance;
  deps: AppDeps;
}> {
  const logger = createLogger(config);
  const metrics = createMetrics();
  const flags = createFeatureFlags();
  const repos = createRepositoryFactory(config);
  const deps: AppDeps = { config, logger, metrics, flags, repos };

  const app = Fastify({
    logger: loggerOptions(config),
    trustProxy: config.trustedProxy,
    disableRequestLogging: false,
    // Cap body size (defense in depth, OWASP A05 misconfig / DoS).
    bodyLimit: 1_048_576, // 1 MiB
  });

  // Repository factory available to every resource (pg when DATABASE_URL set).
  app.decorate("repos", repos);
  app.addHook("onClose", async () => repos.close());

  // --- Security headers (OWASP A05) ---
  // Awaited so the plugins' onRoute hooks attach to every route defined below
  // (rate-limit applies per-route config at registration time).
  await app.register(helmet, { contentSecurityPolicy: config.isProd });

  // --- Rate limiting (OWASP A04/A07: brute force & abuse) ---
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
  });

  // --- Metrics middleware ---
  app.addHook("onResponse", async (req, reply) => {
    const route = req.routeOptions?.url ?? "unknown";
    const labels = {
      method: req.method,
      route,
      status: String(reply.statusCode),
    };
    metrics.httpRequestsTotal.inc(labels);
    metrics.httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
  });

  // --- Centralized error handler: safe bodies, no stack leaks (OWASP A05) ---
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      reply.code(400).send({
        error: "validation_error",
        message: "Request failed validation",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    if (err instanceof AppError) {
      reply.code(err.statusCode).send({ error: err.code, message: err.message });
      return;
    }
    if ((err as { statusCode?: number }).statusCode === 429) {
      reply.code(429).send({ error: "rate_limited", message: "Too many requests" });
      return;
    }
    req.log.error({ err }, "unhandled error");
    reply.code(500).send({ error: "internal_error", message: "Internal server error" });
  });

  // --- Liveness/Readiness (12-factor disposability, k8s/Fly health checks) ---
  app.get("/healthz", async () => ({ status: "ok" }));
  app.get("/readyz", async () => ({ status: "ready", flags: flags.all() }));

  // --- Metrics scrape endpoint ---
  app.get("/metrics", async (_req, reply) => {
    reply.header("content-type", metrics.registry.contentType);
    return metrics.registry.metrics();
  });

  // --- Authenticated API surface (everything under /api requires a token) ---
  app.register(async (api) => {
    api.addHook("preHandler", authenticate(config));

    const members = registerMembers(api, deps);
    registerAdvancement(api);
    const transactions = registerMoney(api);
    registerEvents(api);
    registerCommunication(api);
    registerSettings(api);
    // Consent source is stubbed permissive in skeleton; real source = consent flags.
    // ponytail: wire to guardians' photo-consent records (PRD §9, COPPA).
    registerPhotos(api, { has: () => true });
    registerSimpleResources(api);
    registerSync(api, members);
    registerReporting(api, { members, transactions });
  });

  return { app, deps };
}
