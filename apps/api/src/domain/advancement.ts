import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import { registerResource, type Entity, type Repository } from "../core/resource.js";

/** PRD §5.3 Advancement: per-requirement records for ranks/merit badges/adventures. */
export const AdvancementRecordSchema = z
  .object({
    bsaMemberId: z.string().regex(/^\d{1,12}$/),
    memberName: z.string().min(1).max(160),
    advancementType: z.enum(["rank", "merit_badge", "adventure", "award"]),
    advancement: z.string().min(1).max(120),
    dateCompleted: z.string().date(),
    approved: z.boolean().default(false),
    submittedToCouncilOn: z.string().date().optional(),
  })
  .strict();

export type AdvancementRecord = z.infer<typeof AdvancementRecordSchema> & Entity;

const PIPE = "|";
const escape = (v: string) => v.replace(/[|\r\n]/g, " ").trim();

/**
 * Serialize approved, un-submitted advancement to a pipe-delimited file for
 * upload into Scoutbook Plus / Internet Advancement (PRD §5.4 FR-S-1).
 *
 * ponytail: column order/header below is a reasonable approximation. The exact
 * Scoutbook Plus spec MUST be validated with BSA before production use
 * (PRD §14 OQ-1) — that is an external dependency, not a code gap. The
 * serializer and "only new/approved" selection are the real, tested logic.
 */
export function toScoutbookFile(
  records: ReadonlyArray<AdvancementRecord>,
): { content: string; count: number } {
  const header = [
    "BSA Member ID",
    "First Name",
    "Last Name",
    "Advancement Type",
    "Advancement",
    "Date Completed",
    "Approved",
  ].join(PIPE);

  const rows = records
    .filter((r) => r.approved && !r.submittedToCouncilOn)
    .map((r) => {
      const [first, ...rest] = r.memberName.split(" ");
      return [
        r.bsaMemberId,
        escape(first ?? ""),
        escape(rest.join(" ")),
        r.advancementType,
        escape(r.advancement),
        r.dateCompleted,
        r.approved ? "Yes" : "No",
      ].join(PIPE);
    });

  return { content: [header, ...rows].join("\n"), count: rows.length };
}

export function registerAdvancement(app: FastifyInstance) {
  const repo = registerResource(app, {
    name: "advancement",
    schema: AdvancementRecordSchema,
    writeRoles: ["admin", "leader"],
  }) as Repository<AdvancementRecord>;

  app.get(
    "/api/advancement/export/scoutbook",
    { preHandler: requireRole("admin", "leader") },
    async (_req, reply) => {
      const all = await repo.list();
      const { content, count } = toScoutbookFile(all);
      reply
        .header("content-type", "text/plain; charset=utf-8")
        .header(
          "content-disposition",
          `attachment; filename="scoutbook-advancement-${Date.now()}.txt"`,
        )
        .header("x-record-count", String(count));
      return content;
    },
  );

  return repo;
}
