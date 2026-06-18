import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../auth.js";
import type { Entity, Repository } from "../core/resource.js";
import type { Member } from "./members/member.js";

/**
 * PRD §5.4 Official Scouting America sync (inbound). There is no public BSA
 * API, so this reconciles an admin-uploaded council roster export against the
 * local roster, returning adds/drops/matches by BSA member ID. The advancement
 * EXPORT side lives in domain/advancement.ts.
 */
const RosterRowSchema = z.object({
  bsaMemberId: z.string().regex(/^\d{1,12}$/),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
});

const ReconcileSchema = z
  .object({ roster: z.array(RosterRowSchema).max(5000) })
  .strict();

export interface ReconcileResult {
  matched: string[];
  toAdd: string[]; // in council roster, not local
  toDrop: string[]; // local, not in council roster
}

export function reconcileRoster(
  local: ReadonlyArray<Member>,
  council: ReadonlyArray<z.infer<typeof RosterRowSchema>>,
): ReconcileResult {
  const localIds = new Set(local.map((m) => m.bsaMemberId).filter(Boolean) as string[]);
  const councilIds = new Set(council.map((r) => r.bsaMemberId));
  return {
    matched: [...councilIds].filter((id) => localIds.has(id)),
    toAdd: [...councilIds].filter((id) => !localIds.has(id)),
    toDrop: [...localIds].filter((id) => !councilIds.has(id)),
  };
}

export function registerSync(
  app: FastifyInstance,
  members: Repository<Member & Entity>,
) {
  app.post(
    "/api/sync/roster/reconcile",
    { preHandler: requireRole("admin", "leader") },
    async (req) => {
      const { roster } = ReconcileSchema.parse(req.body);
      const local = await members.list();
      return { data: reconcileRoster(local, roster) };
    },
  );
}
