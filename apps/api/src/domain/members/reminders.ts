import type { Member } from "./member.js";

/**
 * Registration-renewal reminders (PRD §5.12/§5.13). Pure, deterministic
 * logic — no I/O — so it is exhaustively unit-testable and reused by both the
 * HTTP route and the scheduled job.
 *
 * Scouting America renews each member individually on their join-anniversary,
 * so we compute, per member, whether "days until expiry" matches one of the
 * configured lead times (default 60/30/14/0).
 */
export interface RegistrationReminder {
  memberId: string;
  memberName: string;
  registrationExpiresOn: string;
  daysUntilExpiry: number;
  leadDay: number;
}

const MS_PER_DAY = 86_400_000;

/** Whole-day difference between two ISO dates (date-only, UTC). */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / MS_PER_DAY);
}

export function computeRegistrationReminders(
  members: ReadonlyArray<Member>,
  today: string,
  leadDays: ReadonlyArray<number>,
): RegistrationReminder[] {
  const leads = new Set(leadDays);
  const out: RegistrationReminder[] = [];
  for (const m of members) {
    if (!m.registrationExpiresOn) continue;
    const days = daysBetween(today, m.registrationExpiresOn);
    if (leads.has(days)) {
      out.push({
        memberId: m.id,
        memberName: `${m.firstName} ${m.lastName}`,
        registrationExpiresOn: m.registrationExpiresOn,
        daysUntilExpiry: days,
        leadDay: days,
      });
    }
  }
  // Soonest-expiring first.
  return out.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * Derive registration status from days-to-expiry. Drives the compliance
 * dashboard color coding (PRD §5.11 FR-RP-2).
 */
export function deriveRegistrationStatus(
  expiresOn: string | undefined,
  today: string,
): Member["registrationStatus"] {
  if (!expiresOn) return "dropped";
  const days = daysBetween(today, expiresOn);
  if (days < 0) return "lapsed";
  if (days <= 60) return "expiring";
  return "registered";
}
