import { z } from "zod";

/**
 * Member domain types. Mirrors PRD §5.1 (People) and §5.12 (registration
 * lifecycle) at skeleton depth. Registration anniversary/expiration is the
 * field that drives the reminders engine.
 */
export const ProgramSchema = z.enum(["troop", "pack"]);
export const MemberKindSchema = z.enum(["youth", "adult"]);
export const RegistrationStatusSchema = z.enum([
  "registered",
  "expiring",
  "lapsed",
  "dropped",
]);

// Trust-boundary input validation (OWASP A03). Strict: unknown keys rejected.
export const CreateMemberSchema = z
  .object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    kind: MemberKindSchema,
    program: ProgramSchema,
    bsaMemberId: z.string().regex(/^\d{1,12}$/).optional(),
    // ISO date (YYYY-MM-DD) the member's registration expires.
    registrationExpiresOn: z.string().date().optional(),
  })
  .strict();

export type CreateMemberInput = z.infer<typeof CreateMemberSchema>;

export interface Member extends CreateMemberInput {
  id: string;
  registrationStatus: z.infer<typeof RegistrationStatusSchema>;
  createdAt: string;
}
