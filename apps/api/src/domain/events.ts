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
    writeRoles: ["admin", "leader"],
  }) as Repository<EventEntity>;

  const rsvps = new Map<string, Rsvp>();

  app.post(
    "/api/events/:id/rsvp",
    { preHandler: requireRole("admin", "leader", "parent") },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const event = await events.get(id);
      if (!event) throw badRequest("Unknown event", "unknown_event");
      const body = RsvpSchema.parse(req.body);
      // One RSVP per (event, member) — upsert keyed deterministically.
      const key = `${id}:${body.memberId}`;
      const rsvp: Rsvp = {
        id: key,
        createdAt: new Date().toISOString(),
        eventId: id,
        ...body,
      };
      rsvps.set(key, rsvp);
      reply.code(201);
      return { data: rsvp };
    },
  );

  app.get(
    "/api/events/:id/rsvps",
    { preHandler: requireRole("admin", "leader") },
    async (req) => {
      const { id } = req.params as { id: string };
      return { data: [...rsvps.values()].filter((r) => r.eventId === id) };
    },
  );

  return events;
}
