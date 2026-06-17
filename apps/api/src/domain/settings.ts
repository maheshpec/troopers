import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";

/**
 * PRD §5.14 Unit settings & configuration. Configurable durations and rules
 * are DATA, not code (NFR-8). Stored as a singleton document.
 */
export const SettingsSchema = z
  .object({
    medicalValidityMonths: z.number().int().positive().max(60).default(12),
    trainingValidityMonths: z.number().int().positive().max(60).default(12),
    duesPeriodMonths: z.number().int().positive().max(60).default(12),
    rsvpWindowDays: z.number().int().nonnegative().max(365).default(7),
    paymentDueWindowDays: z.number().int().nonnegative().max(365).default(14),
    registrationReminderLeadDays: z
      .array(z.number().int().nonnegative())
      .min(1)
      .default([60, 30, 14, 0]),
    newsletterCadence: z.enum(["weekly", "monthly", "off"]).default("monthly"),
  })
  .strict();

export type Settings = z.infer<typeof SettingsSchema>;

export function registerSettings(app: FastifyInstance) {
  // Initialize from schema defaults.
  let current: Settings = SettingsSchema.parse({});

  app.get(
    "/api/settings",
    { preHandler: requireRole("admin", "leader", "parent", "scout") },
    async () => ({ data: current }),
  );

  app.put(
    "/api/settings",
    { preHandler: requireRole("admin") },
    async (req) => {
      // Full replace with validation; partial updates merge then re-validate.
      current = SettingsSchema.parse({ ...current, ...(req.body as object) });
      return { data: current };
    },
  );

  return { get: () => current };
}
