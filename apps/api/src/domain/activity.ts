import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { registerResource, type Entity, type Repository } from "../core/resource.js";

/**
 * PRD §5.8 Activity logs — service hours, nights camped, miles hiked. The
 * per-member summary feeds rank/Eagle requirements (e.g. service-hour and
 * camping totals), so it's a real query, not just CRUD.
 */
export const ActivityLogSchema = z
  .object({
    memberId: z.string().uuid(),
    kind: z.enum(["service_hours", "nights_camped", "miles_hiked"]),
    quantity: z.number().nonnegative(),
    occurredOn: z.string().date(),
    eventId: z.string().uuid().optional(),
  })
  .strict();

export type ActivityLog = z.infer<typeof ActivityLogSchema> & Entity;

export type ActivitySummary = Record<ActivityLog["kind"], number>;

/** Sum quantities per kind for one member. node-pg returns NUMERIC as string. */
export function summarize(
  logs: ReadonlyArray<ActivityLog>,
  memberId: string,
): ActivitySummary {
  const totals: ActivitySummary = {
    service_hours: 0,
    nights_camped: 0,
    miles_hiked: 0,
  };
  for (const l of logs) {
    if (l.memberId === memberId) totals[l.kind] += Number(l.quantity);
  }
  return totals;
}

export function registerActivity(app: FastifyInstance) {
  const repo = registerResource(app, {
    name: "activity-logs",
    table: "activity_logs",
    schema: ActivityLogSchema,
    columns: ["member_id", "kind", "quantity", "occurred_on", "event_id"],
  }) as Repository<ActivityLog>;

  app.get(
    "/api/members/:memberId/activity-summary",
    { preHandler: requireRole("admin", "leader", "parent") },
    async (req) => {
      const { memberId } = req.params as { memberId: string };
      const logs = await repo.list();
      return { memberId, totals: summarize(logs, memberId) };
    },
  );

  return repo;
}
