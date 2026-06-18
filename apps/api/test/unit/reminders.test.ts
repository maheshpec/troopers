import { describe, expect, it } from "vitest";
import {
  computeRegistrationReminders,
  daysBetween,
  deriveRegistrationStatus,
} from "../../src/domain/members/reminders.js";
import type { Member } from "../../src/domain/members/member.js";

const member = (over: Partial<Member>): Member => ({
  id: over.id ?? "m1",
  firstName: "Alex",
  lastName: "Scout",
  kind: "youth",
  program: "troop",
  registrationStatus: "registered",
  createdAt: "2025-01-01T00:00:00Z",
  ...over,
});

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween("2026-06-17", "2026-06-27")).toBe(10);
  });
  it("is negative for past dates", () => {
    expect(daysBetween("2026-06-17", "2026-06-10")).toBe(-7);
  });
});

describe("computeRegistrationReminders", () => {
  const today = "2026-06-17";
  const leadDays = [60, 30, 14, 0];

  it("emits a reminder when expiry matches a configured lead day", () => {
    const members = [
      member({ id: "a", registrationExpiresOn: "2026-07-17" }), // 30 days
      member({ id: "b", registrationExpiresOn: "2026-06-17" }), // 0 days
    ];
    const out = computeRegistrationReminders(members, today, leadDays);
    expect(out.map((r) => r.memberId)).toEqual(["b", "a"]); // sorted soonest-first
    expect(out[0]?.daysUntilExpiry).toBe(0);
  });

  it("ignores members whose expiry is not on a lead day", () => {
    const members = [member({ registrationExpiresOn: "2026-07-01" })]; // 14? no -> 14 days actually
    // 2026-06-17 -> 2026-07-01 = 14 days, which IS a lead day.
    expect(computeRegistrationReminders(members, today, leadDays)).toHaveLength(1);
    // A non-lead day (e.g., 13 days) should be skipped.
    const skip = [member({ registrationExpiresOn: "2026-06-30" })]; // 13 days
    expect(computeRegistrationReminders(skip, today, leadDays)).toHaveLength(0);
  });

  it("skips members with no registration date", () => {
    expect(
      computeRegistrationReminders([member({})], today, leadDays),
    ).toHaveLength(0);
  });

  it("honors custom configured lead days", () => {
    const members = [member({ registrationExpiresOn: "2026-06-24" })]; // 7 days
    expect(computeRegistrationReminders(members, today, [7])).toHaveLength(1);
    expect(computeRegistrationReminders(members, today, [60])).toHaveLength(0);
  });
});

describe("deriveRegistrationStatus", () => {
  const today = "2026-06-17";
  it.each([
    ["2026-06-10", "lapsed"],
    ["2026-07-01", "expiring"],
    ["2026-12-31", "registered"],
    [undefined, "dropped"],
  ] as const)("%s -> %s", (date, expected) => {
    expect(deriveRegistrationStatus(date, today)).toBe(expected);
  });
});
