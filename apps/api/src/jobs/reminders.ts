import { loadConfig, type AppConfig } from "../config.js";
import { createLogger, type Logger } from "../logger.js";
import { createRepositoryFactory } from "../core/pgRepository.js";
import type { Member } from "../domain/members/member.js";
import { computeRegistrationReminders, type RegistrationReminder } from "../domain/members/reminders.js";
import {
  createNotificationChannel,
  type EmailMessage,
  type NotificationChannel,
} from "../notifications/channel.js";

/**
 * Scheduled reminders job (D5). Runs out-of-process on a cron (GitHub Actions /
 * any scheduler) so reminders fire even if no one opens the app (PRD §5.13
 * FR-N-8). Reads members from the same Postgres the API writes to.
 *
 * Run: node dist/jobs/reminders.js   (or `tsx src/jobs/reminders.ts`)
 */
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Pure: format a digest of due reminders. Testable without I/O. */
export function formatReminderDigest(
  reminders: ReadonlyArray<RegistrationReminder>,
  today: string,
): { subject: string; text: string } {
  const lines = reminders.map(
    (r) =>
      `• ${r.memberName} — registration expires ${r.registrationExpiresOn} (in ${r.daysUntilExpiry} day${r.daysUntilExpiry === 1 ? "" : "s"})`,
  );
  return {
    subject: `Troopers: ${reminders.length} registration renewal${reminders.length === 1 ? "" : "s"} due`,
    text:
      `Registration renewals due as of ${today}:\n\n` +
      (lines.length ? lines.join("\n") : "None today.") +
      `\n\nRenew at my.scouting.org. — Troopers`,
  };
}

export interface ReminderRunResult {
  date: string;
  count: number;
  channel: string;
  delivered: boolean;
}

/** Core run logic, dependency-injected so it can be unit/integration tested. */
export async function runReminderJob(
  config: AppConfig,
  deps: {
    listMembers: () => Promise<Member[]>;
    channel: NotificationChannel;
    log: Logger;
  },
): Promise<ReminderRunResult> {
  const today = todayIso();
  const members = await deps.listMembers();
  const reminders = computeRegistrationReminders(
    members,
    today,
    config.reminders.registrationLeadDays,
  );

  let delivered = false;
  if (reminders.length > 0 && config.notifications.digestEmail) {
    const digest = formatReminderDigest(reminders, today);
    await deps.channel.send({ to: config.notifications.digestEmail, ...digest });
    delivered = true;
  }

  deps.log.info(
    { count: reminders.length, channel: deps.channel.name, delivered },
    "reminder job complete",
  );
  return { date: today, count: reminders.length, channel: deps.channel.name, delivered };
}

async function main() {
  const config = loadConfig();
  const log = createLogger(config);
  const repos = createRepositoryFactory(config);
  try {
    const members = repos.for<Member>({ table: "members", columns: [] });
    const channel = createNotificationChannel(config, log);
    await runReminderJob(config, { listMembers: () => members.list(), channel, log });
  } finally {
    await repos.close();
  }
}

// Only run when executed directly (not when imported by tests).
if (process.argv[1] && /reminders\.(js|ts)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
