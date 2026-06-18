import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { notFound } from "../errors.js";
import { requireRole, type Role } from "../auth.js";

/**
 * Generic resource framework. Each of the 17 feature areas is a bounded
 * context that, at minimum, needs: trust-boundary validation, RBAC, an
 * in-memory repository (swappable for Postgres), and CRUD routes. This
 * factory provides that consistently so every area gets the non-negotiables
 * (validation, authz, error handling) without 17x of copy-paste.
 *
 * ponytail: in-memory store. Upgrade path -> Postgres repository implementing
 * the same `Repository<T>` interface (db/migrations already define tables).
 */
export interface Entity {
  id: string;
  createdAt: string;
}

export interface Repository<T extends Entity> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(data: Record<string, unknown>): Promise<T>;
  update(id: string, data: Record<string, unknown>): Promise<T | undefined>;
  remove(id: string): Promise<boolean>;
}

export function createInMemoryRepository<T extends Entity>(): Repository<T> {
  const store = new Map<string, T>();
  return {
    async list() {
      return [...store.values()];
    },
    async get(id) {
      return store.get(id);
    },
    async create(data) {
      const entity = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...data,
      } as T;
      store.set(entity.id, entity);
      return entity;
    },
    async update(id, data) {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...data, id, createdAt: existing.createdAt };
      store.set(id, updated);
      return updated;
    },
    async remove(id) {
      return store.delete(id);
    },
  };
}

export interface ResourceOptions<S extends z.ZodTypeAny> {
  /** URL segment, e.g. "members" -> /api/members */
  name: string;
  /** Zod schema validating the create/update body. */
  schema: S;
  /** Roles allowed to read. Defaults to all authenticated roles. */
  readRoles?: Role[];
  /** Roles allowed to mutate. Defaults to admin + leader. */
  writeRoles?: Role[];
  /** Postgres table name (defaults to name with dashes -> underscores). */
  table?: string;
  /** Writable snake_case columns for the pg-backed repository. */
  columns?: string[];
  /** Optional shared repository (else one is resolved from `app.repos`). */
  repository?: Repository<Entity>;
}

/**
 * Registers REST CRUD for a resource on the given Fastify instance.
 * Returns the repository so feature modules can add custom routes/logic.
 *
 * The repository comes from `app.repos` (the factory), so it is Postgres-backed
 * when DATABASE_URL is set and in-memory otherwise — feature code is identical.
 */
export function registerResource<S extends z.ZodTypeAny>(
  app: FastifyInstance,
  opts: ResourceOptions<S>,
): Repository<Entity> {
  const table = opts.table ?? opts.name.replace(/-/g, "_");
  const repo =
    opts.repository ??
    app.repos.for({ table, columns: opts.columns ?? [] });
  const read = opts.readRoles ?? ["admin", "leader", "parent", "scout"];
  const write = opts.writeRoles ?? ["admin", "leader"];
  const base = `/api/${opts.name}`;

  app.get(base, { preHandler: requireRole(...read) }, async () => {
    return { data: await repo.list() };
  });

  app.get(`${base}/:id`, { preHandler: requireRole(...read) }, async (req) => {
    const { id } = req.params as { id: string };
    const found = await repo.get(id);
    if (!found) throw notFound();
    return { data: found };
  });

  app.post(base, { preHandler: requireRole(...write) }, async (req, reply) => {
    const body = opts.schema.parse(req.body); // throws ZodError -> 400
    const created = await repo.create(body as Record<string, unknown>);
    reply.code(201);
    return { data: created };
  });

  app.patch(`${base}/:id`, { preHandler: requireRole(...write) }, async (req) => {
    const { id } = req.params as { id: string };
    // Use `.partial()` when the schema is a plain object; schemas with refinements
    // (ZodEffects) validate against the full schema instead.
    const s = opts.schema as unknown as { partial?: () => z.ZodTypeAny };
    const updateSchema = typeof s.partial === "function" ? s.partial() : opts.schema;
    const body = updateSchema.parse(req.body);
    const updated = await repo.update(id, body as Record<string, unknown>);
    if (!updated) throw notFound();
    return { data: updated };
  });

  app.delete(
    `${base}/:id`,
    { preHandler: requireRole(...write) },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const ok = await repo.remove(id);
      if (!ok) throw notFound();
      reply.code(204);
    },
  );

  return repo;
}
