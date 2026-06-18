import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { badRequest } from "../errors.js";
import { registerResource, type Entity, type Repository } from "../core/resource.js";

/** PRD §5.5 Calendar & Events. */
export const EventSchema = z
  .object({
    title: z.string().min(1).max(140),
    type: z.enum(["meeting", "campout", "service", "fundraiser", "ceremony", "other"]),
    location: z.string().max(200).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    feeCents: z.number().int().nonnegative().default(0),
    rsvpDeadline: z.string().datetime().optional(),
  })
  .strict()
  .refine((e) => Date.parse(e.endsAt) >= Date.parse(e.startsAt), {
    message: "endsAt must be at or after startsAt",
    path: ["endsAt"],
  });

export type EventEntity = z.infer<typeof EventSchema> & Entity;

const RsvpSchema = z
  .object({
    memberId: z.string().min(1).max(64),
    response: z.enum(["going", "not_going", "maybe"]),
    guests: z.number().int().nonnegative().max(20).default(0),
  })
  .strict();

interface Rsvp extends Entity {
  eventId: string;
  memberId: string;
  response: string;
  guests: number;
}

export function registerEvents(app: FastifyInstance) {
  const events = registerResource(app, {
    name: "events",
    schema: EventSchema,
    columns: [
      "title", "type", "location", "starts_at", "ends_at", "fee_cents",
      "rsvp_deadline",
    ],
    writeRoles: ["admin", "leader"],
  }) as Repository<EventEntity>;

  // RSVPs use the repository factory (pg table `rsvps`), upserting on
  // (event, member) so a member changing their answer overwrites the prior row.
  const rsvps = app.repos.for<Rsvp>({
    table: "rsvps",
    columns: ["event_id", "member_id", "response", "guests"],
  });

  app.post(
    "/api/events/:id/rsvp",
    { preHandler: requireRole("admin", "leader", "parent") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const event = await events.get(id);
      if (!event) throw badRequest("Unknown event", "unknown_event");
      const body = RsvpSchema.parse(req.body);
      // One RSVP per (event, member): update the existing answer or create one.
      const existing = (await rsvps.list()).find(
        (r) => r.eventId === id && r.memberId === body.memberId,
      );
      const rsvp = existing
        ? await rsvps.update(existing.id, body)
        : await rsvps.create({ eventId: id, ...body });
      reply.code(existing ? 200 : 201);
      return { data: rsvp };
    },
  );

  app.get(
    "/api/events/:id/rsvps",
    { preHandler: requireRole("admin", "leader") },
    async (req) => {
      const { id } = req.params as { id: string };
      const all = await rsvps.list();
      return { data: all.filter((r) => r.eventId === id) };
    },
  );

  return events;
}
