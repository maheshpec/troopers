import type { FastifyReply, FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "./errors.js";
import type { AppConfig } from "./config.js";

/**
 * Role-based access control (OWASP A01: broken access control).
 *
 * Skeleton bearer auth: maps a static token -> role via config. The
 * `requireRole` guard is the real, reusable piece — the token lookup is the
 * throwaway part.
 *
 * ponytail: static token map. Upgrade path -> verify a JWT from Supabase
 * Auth / Better Auth (jose), load the user's positions, and derive permission
 * scopes (PRD §5.2). The `AuthContext` shape stays the same.
 */
export type Role = "admin" | "leader" | "parent" | "scout";

export interface AuthContext {
  role: Role;
  token: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export function authenticate(config: AppConfig) {
  return async function (req: FastifyRequest, _reply: FastifyReply) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized();
    const token = header.slice("Bearer ".length).trim();
    const role = config.authTokens.get(token);
    if (!role) throw unauthorized("Invalid token");
    req.auth = { role: role as Role, token };
  };
}

/** Route guard: require the caller to hold one of the allowed roles. */
export function requireRole(...allowed: Role[]) {
  return async function (req: FastifyRequest, _reply: FastifyReply) {
    if (!req.auth) throw unauthorized();
    if (!allowed.includes(req.auth.role)) throw forbidden();
  };
}
