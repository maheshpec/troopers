import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";

/**
 * Notification delivery (PRD §5.13). One interface, multiple channels. The
 * default `LogChannel` works with zero credentials (so the pipeline is fully
 * runnable/testable); `BrevoChannel` actually sends email when a key is set.
 *
 * ponytail: SMS (D9) and Web Push (D6) are future channels behind this same
 * interface — recipients/escalation routing layers on top.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface NotificationChannel {
  readonly name: string;
  send(msg: EmailMessage): Promise<void>;
}

/** No-credential channel: logs what would be sent. Used at $0 and in tests. */
export class LogChannel implements NotificationChannel {
  readonly name = "log";
  constructor(private readonly log?: Logger) {}
  async send(msg: EmailMessage): Promise<void> {
    this.log?.info({ to: msg.to, subject: msg.subject }, "[notify:log] email");
  }
}

/** Brevo transactional email (HOSTING.md: free tier ~9k/mo). */
export class BrevoChannel implements NotificationChannel {
  readonly name = "brevo";
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
  ) {}
  async send(msg: EmailMessage): Promise<void> {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": this.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: this.fromEmail, name: "Troopers" },
        to: [{ email: msg.to }],
        subject: msg.subject,
        textContent: msg.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Brevo send failed: ${res.status} ${await res.text()}`);
    }
  }
}

export function createNotificationChannel(
  config: AppConfig,
  log?: Logger,
): NotificationChannel {
  if (config.notifications.brevoApiKey) {
    return new BrevoChannel(
      config.notifications.brevoApiKey,
      config.notifications.fromEmail,
    );
  }
  return new LogChannel(log);
}
