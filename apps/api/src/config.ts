import { z } from "zod";

/**
 * 12-factor config (Factor III). All configuration is read from the
 * environment exactly once, validated at the trust boundary, and frozen.
 * A bad/missing value fails fast at boot rather than at first request.
 */
const csv = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  DATABASE_URL: z.string().url().optional(),

  // "token:role,token:role" — dev/local auth fallback when no JWT is configured.
  API_AUTH_TOKENS: z.string().default(""),

  // Real auth: verify HS256 JWTs (matches Supabase's project JWT secret).
  // When set, JWT verification takes precedence over the static token map.
  AUTH_JWT_SECRET: z.string().min(16).optional(),
  AUTH_JWT_ISSUER: z.string().optional(),
  AUTH_JWT_AUDIENCE: z.string().optional(),
  // Claim that carries the role (e.g. "role" or an app-namespaced claim).
  AUTH_ROLE_CLAIM: z.string().default("role"),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  TRUSTED_PROXY: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  REGISTRATION_REMINDER_LEAD_DAYS: z
    .string()
    .default("60,30,14,0")
    .transform((v) => csv(v).map(Number))
    .pipe(z.array(z.number().int().nonnegative()).min(1)),

  // Notifications. With no provider key, the reminders job uses a log channel
  // (works at $0). Set BREVO_API_KEY to actually send email (HOSTING.md).
  BREVO_API_KEY: z.string().optional(),
  REMINDER_FROM_EMAIL: z.string().email().default("troopers@example.org"),
  REMINDER_DIGEST_EMAIL: z.string().email().optional(),
});

export type AppConfig = Readonly<{
  nodeEnv: "development" | "test" | "production";
  port: number;
  logLevel: string;
  databaseUrl?: string;
  authTokens: ReadonlyMap<string, string>; // token -> role
  jwt?: {
    secret: string;
    issuer?: string;
    audience?: string;
    roleClaim: string;
  };
  rateLimit: { max: number; window: string };
  trustedProxy: boolean;
  reminders: { registrationLeadDays: number[] };
  notifications: {
    brevoApiKey?: string;
    fromEmail: string;
    digestEmail?: string;
  };
  isProd: boolean;
}>;

function parseTokens(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of csv(raw)) {
    const [token, role] = pair.split(":");
    if (token && role) map.set(token, role);
  }
  return map;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Fail fast with a readable message; never boot with invalid config.
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  const e = parsed.data;
  return Object.freeze({
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    authTokens: parseTokens(e.API_AUTH_TOKENS),
    jwt: e.AUTH_JWT_SECRET
      ? {
          secret: e.AUTH_JWT_SECRET,
          issuer: e.AUTH_JWT_ISSUER,
          audience: e.AUTH_JWT_AUDIENCE,
          roleClaim: e.AUTH_ROLE_CLAIM,
        }
      : undefined,
    rateLimit: { max: e.RATE_LIMIT_MAX, window: e.RATE_LIMIT_WINDOW },
    trustedProxy: e.TRUSTED_PROXY,
    reminders: { registrationLeadDays: e.REGISTRATION_REMINDER_LEAD_DAYS },
    notifications: {
      brevoApiKey: e.BREVO_API_KEY,
      fromEmail: e.REMINDER_FROM_EMAIL,
      digestEmail: e.REMINDER_DIGEST_EMAIL,
    },
    isProd: e.NODE_ENV === "production",
  });
}
