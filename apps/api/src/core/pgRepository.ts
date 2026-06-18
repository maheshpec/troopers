import pg from "pg";
import type { AppConfig } from "../config.js";
import type { Entity, Repository } from "./resource.js";
import { createInMemoryRepository } from "./resource.js";

// Keep DATE (oid 1082) as the raw 'YYYY-MM-DD' string instead of a JS Date, so
// values round-trip identically to the in-memory repo and never shift by TZ.
pg.types.setTypeParser(1082, (v) => v);

/**
 * Repository factory: returns a Postgres-backed repository when a DATABASE_URL
 * is configured, else the in-memory one. This is the D1 upgrade seam — feature
 * code asks the factory and never changes when persistence flips.
 */
const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export interface TableSpec {
  /** Postgres table name. */
  table: string;
  /** Writable snake_case columns (excludes id/created_at, which the DB owns). */
  columns: string[];
}

export function rowToEntity<T extends Entity>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    // Dates -> ISO strings to match the in-memory repo's JSON shape.
    out[snakeToCamel(k)] =
      v instanceof Date ? v.toISOString() : v;
  }
  return out as T;
}

class PgRepository<T extends Entity> implements Repository<T> {
  constructor(
    private readonly pool: pg.Pool,
    private readonly spec: TableSpec,
  ) {}

  /** Whitelist incoming keys against known columns (prevents SQL injection via keys). */
  private pick(data: Record<string, unknown>) {
    const cols: string[] = [];
    const vals: unknown[] = [];
    for (const col of this.spec.columns) {
      const camel = snakeToCamel(col);
      if (camel in data && data[camel] !== undefined) {
        cols.push(col);
        vals.push(data[camel]);
      }
    }
    return { cols, vals };
  }

  async list(): Promise<T[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${this.spec.table} ORDER BY created_at DESC`,
    );
    return rows.map((r) => rowToEntity<T>(r));
  }

  async get(id: string): Promise<T | undefined> {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${this.spec.table} WHERE id = $1`,
      [id],
    );
    return rows[0] ? rowToEntity<T>(rows[0]) : undefined;
  }

  async create(data: Record<string, unknown>): Promise<T> {
    const { cols, vals } = this.pick(data);
    if (cols.length === 0) {
      const { rows } = await this.pool.query(
        `INSERT INTO ${this.spec.table} DEFAULT VALUES RETURNING *`,
      );
      return rowToEntity<T>(rows[0]!);
    }
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const { rows } = await this.pool.query(
      `INSERT INTO ${this.spec.table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`,
      vals,
    );
    return rowToEntity<T>(rows[0]!);
  }

  async update(id: string, data: Record<string, unknown>): Promise<T | undefined> {
    const { cols, vals } = this.pick(data);
    if (cols.length === 0) return this.get(id);
    const set = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
    const { rows } = await this.pool.query(
      `UPDATE ${this.spec.table} SET ${set} WHERE id = $${cols.length + 1} RETURNING *`,
      [...vals, id],
    );
    return rows[0] ? rowToEntity<T>(rows[0]) : undefined;
  }

  async remove(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM ${this.spec.table} WHERE id = $1`,
      [id],
    );
    return (rowCount ?? 0) > 0;
  }
}

export interface RepositoryFactory {
  for<T extends Entity>(spec: TableSpec): Repository<T>;
  /** Closes the pool (if any) on shutdown. */
  close(): Promise<void>;
  readonly backend: "postgres" | "memory";
}

declare module "fastify" {
  interface FastifyInstance {
    repos: RepositoryFactory;
  }
}

export function createRepositoryFactory(config: AppConfig): RepositoryFactory {
  if (!config.databaseUrl) {
    return {
      for: <T extends Entity>() => createInMemoryRepository<T>(),
      close: async () => {},
      backend: "memory",
    };
  }
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    // ponytail: TLS verification left to the connection string (sslmode).
  });
  return {
    for: <T extends Entity>(spec: TableSpec) => new PgRepository<T>(pool, spec),
    close: () => pool.end(),
    backend: "postgres",
  };
}
