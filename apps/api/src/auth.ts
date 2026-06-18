import type { FastifyReply, FastifyRequest } from "fastify";
import { jwtVerify } from "jose";
import { forbidden, unauthorized } from "./errors.js";
import type { AppConfig } from "./config.js";

/**
 * Authentication & RBAC (OWASP A01).
 *
 * Two modes, JWT first:
 *  1. **JWT (production)** — when `AUTH_JWT_SECRET` is set, verify an HS256
 *     bearer token (signature, exp, optional iss/aud) and read the role from a
 *     configurable claim. HS256 matches Supabase's project JWT secret, so this
 *     is real, not a toy.
 *  2. **Static tokens (local/dev)** — token->role map, used only when no JWT
 *     secret is configured.
 *
 * ponytail: RS256/JWKS (rotating keys) and MFA for admin/treasurer need a real
 * IdP and are deferred — the `AuthContext` shape stays the same when added.
 */
export type Role = "admin" | "leader" | "parent" | "scout";
const ROLES = new Set<Role>(["admin", "leader", "parent", "scout"]);

export interface AuthContext {
  role: Role;
  subject?: string; // user id (JWT `sub`) for audit
  token: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

function bearer(req: FastifyRequest): string {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw unauthorized();
  return token;
}

export function authenticate(config: AppConfig) {
  const secret = config.jwt
    ? new TextEncoder().encode(config.jwt.secret)
    : undefined;

  return async function (req: FastifyRequest, _reply: FastifyReply) {
    const token = bearer(req);

    if (config.jwt && secret) {
      try {
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ["HS256"],
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        });
        const claim = payload[config.jwt.roleClaim];
        if (typeof claim !== "string" || !ROLES.has(claim as Role)) {
          throw unauthorized("Token missing a valid role claim");
        }
        req.auth = {
          role: claim as Role,
          subject: typeof payload.sub === "string" ? payload.sub : undefined,
          token,
        };
        return;
      } catch (err) {
        // Don't leak verification internals (OWASP A05).
        if (err instanceof Error && err.name === "AppError") throw err;
        throw unauthorized("Invalid token");
      }
    }

    // Fallback: static dev tokens.
    const role = config.authTokens.get(token);
    if (!role || !ROLES.has(role as Role)) throw unauthorized("Invalid token");
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
