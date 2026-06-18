import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { badRequest } from "../errors.js";
import { requireRole } from "../auth.js";
import { registerResource, type Entity } from "../core/resource.js";

/**
 * PRD §5.6 Communication. The youth-protection rule (§9) is enforced here as
 * an architectural invariant: no 1-on-1 adult<->youth thread. A message
 * between an adult and a youth MUST include a second adult or the youth's
 * parent. This is validated server-side and unit-tested.
 */
export const ParticipantSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["adult", "youth"]),
  isParentOfYouth: z.boolean().default(false),
});

export const MessageSchema = z
  .object({
    subject: z.string().min(1).max(160),
    body: z.string().min(1).max(4000),
    participants: z.array(ParticipantSchema).min(2),
  })
  .strict();

export type MessageInput = z.infer<typeof MessageSchema>;

/** Returns null if YP-compliant, else a human-readable reason. */
export function youthProtectionViolation(msg: MessageInput): string | null {
  const adults = msg.participants.filter((p) => p.kind === "adult");
  const youth = msg.participants.filter((p) => p.kind === "youth");
  if (youth.length === 0) return null; // adult-only thread is fine
  if (adults.length === 0) return null; // youth-only (e.g., patrol) is fine
  // Mixed adult/youth: require a second adult OR a parent of a youth present.
  const hasSecondAdult = adults.length >= 2;
  const hasParent = msg.participants.some((p) => p.isParentOfYouth);
  if (hasSecondAdult || hasParent) return null;
  return "Youth-protection: adult–youth messages require a second registered adult or a parent on the thread.";
}

export function registerCommunication(app: FastifyInstance) {
  registerResource(app, {
    name: "announcements",
    schema: z
      .object({
        title: z.string().min(1).max(160),
        body: z.string().min(1).max(8000),
        audience: z.enum(["unit", "patrol", "den", "committee"]).default("unit"),
      })
      .strict(),
    columns: ["title", "body", "audience"],
    writeRoles: ["admin", "leader"],
  });

  interface MessageRow extends Entity {
    subject: string;
    body: string;
    participants: string;
    participantCount: number;
    senderRole?: string;
  }
  const messages = app.repos.for<MessageRow>({
    table: "messages",
    columns: ["subject", "body", "participants", "participant_count", "sender_role"],
  });

  app.post("/api/messages", async (req, reply) => {
    const msg = MessageSchema.parse(req.body);
    const violation = youthProtectionViolation(msg);
    if (violation) throw badRequest(violation, "youth_protection");
    // Persist for audit/retention (PRD §9). Participants stored as JSON.
    const saved = await messages.create({
      subject: msg.subject,
      body: msg.body,
      participants: JSON.stringify(msg.participants),
      participantCount: msg.participants.length,
      senderRole: req.auth?.role,
    });
    // ponytail: delivery (email/SMS/push) still deferred — fan out via the
    // NotificationChannel once per-recipient routing exists (D9 remainder).
    reply.code(201);
    return { data: { id: saved.id, accepted: true, participants: msg.participants.length } };
  });

  // Audit view: admins/leaders can review retained threads (§9).
  app.get(
    "/api/messages",
    { preHandler: requireRole("admin", "leader") },
    async () => {
      const rows = await messages.list();
      return {
        data: rows.map((m) => ({
          id: m.id,
          subject: m.subject,
          participantCount: m.participantCount,
          senderRole: m.senderRole,
          createdAt: m.createdAt,
          participants: JSON.parse(m.participants),
        })),
      };
    },
  );
}
