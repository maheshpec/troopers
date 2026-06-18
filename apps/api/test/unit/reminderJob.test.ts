import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../src/config.js";
import { formatReminderDigest, runReminderJob } from "../../src/jobs/reminders.js";
import { LogChannel, type NotificationChannel } from "../../src/notifications/channel.js";
import type { Member } from "../../src/domain/members/member.js";
import type { RegistrationReminder } from "../../src/domain/members/reminders.js";

const reminder = (o: Partial<RegistrationReminder>): RegistrationReminder => ({
  memberId: "m1",
  memberName: "Alex Scout",
  registrationExpiresOn: "2026-07-01",
  daysUntilExpiry: 14,
  leadDay: 14,
  ...o,
});

const member = (o: Partial<Member>): Member => ({
  id: o.id ?? "m1",
  firstName: "Alex",
  lastName: "Scout",
  kind: "youth",
  program: "troop",
  registrationStatus: "registered",
  createdAt: "x",
  ...o,
});

const silentLog = { info: () => {}, error: () => {} } as never;

describe("formatReminderDigest", () => {
  it("summarizes reminders with pluralization", () => {
    const d = formatReminderDigest([reminder({}), reminder({ daysUntilExpiry: 1 })], "2026-06-17");
    expect(d.subject).toContain("2 registration renewals due");
    expect(d.text).toContain("Alex Scout");
    expect(d.text).toContain("in 1 day"); // singular
  });
  it("handles the empty case", () => {
    const d = formatReminderDigest([], "2026-06-17");
    expect(d.subject).toContain("0 registration renewals");
    expect(d.text).toContain("None today.");
  });
});

describe("runReminderJob", () => {
  const baseEnv = {
    NODE_ENV: "test",
    REGISTRATION_REMINDER_LEAD_DAYS: "14",
    REMINDER_DIGEST_EMAIL: "chair@troop.org",
  } as NodeJS.ProcessEnv;

  it("sends a digest when reminders are due", async () => {
    const config = loadConfig(baseEnv);
    const channel: NotificationChannel = { name: "test", send: vi.fn(async () => {}) };
    const members = [member({ registrationExpiresOn: "2026-07-01" })]; // 14 days from 'today'
    // Freeze "today" to 2026-06-17 by injecting members whose expiry is 14 days out.
    vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
    const result = await runReminderJob(config, {
      listMembers: async () => members,
      channel,
      log: silentLog,
    });
    vi.useRealTimers();
    expect(result.count).toBe(1);
    expect(result.delivered).toBe(true);
    expect(channel.send).toHaveBeenCalledOnce();
  });

  it("does not send when no reminders are due", async () => {
    const config = loadConfig(baseEnv);
    const channel: NotificationChannel = { name: "test", send: vi.fn(async () => {}) };
    vi.setSystemTime(new Date("2026-06-17T12:00:00Z"));
    const result = await runReminderJob(config, {
      listMembers: async () => [member({ registrationExpiresOn: "2027-01-01" })],
      channel,
      log: silentLog,
    });
    vi.useRealTimers();
    expect(result.count).toBe(0);
    expect(result.delivered).toBe(false);
    expect(channel.send).not.toHaveBeenCalled();
  });

  it("LogChannel sends without credentials", async () => {
    const ch = new LogChannel();
    await expect(ch.send({ to: "a@b.c", subject: "s", text: "t" })).resolves.toBeUndefined();
  });
});
