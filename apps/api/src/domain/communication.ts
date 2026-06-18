import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { badRequest } from "../errors.js";
import { registerResource } from "../core/resource.js";

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

  app.post("/api/messages", async (req, reply) => {
    const msg = MessageSchema.parse(req.body);
    const violation = youthProtectionViolation(msg);
    if (violation) throw badRequest(violation, "youth_protection");
    // ponytail: persistence + delivery (email/SMS/push) deferred. Upgrade path
    // -> store thread (retained/auditable per §9) and fan out via providers.
    reply.code(201);
    return { data: { accepted: true, participants: msg.participants.length } };
  });
}
