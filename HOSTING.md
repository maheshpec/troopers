# Troopers — Hosting & Infrastructure Plan

*Companion to [PRD.md](./PRD.md). Last updated 2026-06-17.*

Single-unit app (one troop + pack, ~50–150 families / 300–500 users). **Not**
multi-tenant. Run by volunteers, so **low maintenance matters as much as low cost.**
Target: under ~$25–30/month all-in.

> Pricing below is mid-2026 and gathered largely from search snapshots (many
> vendor pages block automated fetch). Re-confirm the flagged items before
> committing — see §6.

---

## TL;DR recommendation

**Start free, then flip one switch at launch.**

- **Pilot:** Stack A — **~$0/mo** (all free tiers).
- **Production:** Stack B — **~$25/mo** (Supabase Pro), the recommended target.
- **Self-host:** Stack C — **~$6–12/mo**, only if a committed technical volunteer wants to run a server.

Core picks, by need:

| Need (from your message) | Pick | Why |
|---|---|---|
| Backend + DB + **RBAC** + auth | **Supabase** (Postgres + Auth + Row-Level Security) | One free dashboard covers Postgres, role-based auth, storage, functions; RBAC is free (RLS + custom claims). Scales ~100× past our size. |
| **Email** (announcements + newsletters + transactional) | **Brevo free** (~9,000/mo) | Only tool that does **both** bulk newsletters and transactional well, at **$0** for our volume. |
| **Picture/file uploads** | **Cloudflare R2** | **Zero egress fees, ever** — a photo gallery viewed repeatedly costs ~$0.60/mo. S3/Supabase Storage hide cost in $0.09/GB egress. |
| Image thumbnails / **tagging** assets | **imgproxy** (free) or Cloudflare Images free tier | Resize on the fly against R2 originals. Tagging is app/DB logic on Postgres. |
| **Money tracking** + payments | **Stripe** | No monthly fee; 2.9% + $0.30 cards, **ACH 0.8% capped at $5** for big dues/camp fees. |
| Web / PWA hosting | **Cloudflare Pages free** | Unlimited bandwidth, commercial use allowed. |

---

## Recommended stacks

### Stack A — Rock-bottom free tier (~$0–5/mo) — *for the pilot*
| Component | Choice | $/mo |
|---|---|---|
| Backend + Postgres + Auth/RBAC | Supabase **Free** (50K MAU) | $0 |
| Object/image storage | Cloudflare R2 (10 GB free) | $0–1 |
| Email (bulk + transactional) | Brevo **Free** (~9,000/mo) | $0 |
| Web / PWA | Cloudflare Pages Free | $0 |
| Payments | Stripe | per-txn |
| Mobile builds | GitHub Actions / EAS free | $0 |
| **Total** | | **~$0–5** |

**One real risk:** Supabase free projects **pause after 7 days idle**. A weekly
cron ping avoids it — or just move to Stack B at launch.

### Stack B — Managed, low-maintenance (~$25/mo) — ★ RECOMMENDED for production
| Component | Choice | $/mo |
|---|---|---|
| Postgres + Auth/RBAC + 100 GB storage + daily backups, **no pausing** | Supabase **Pro** (100K MAU) | $25 |
| Overflow storage (if >100 GB) | Cloudflare R2 | ~$0–1 |
| Email | Brevo Free *(or Postmark $15 if a lost medical-form email is unacceptable)* | $0 |
| Web / PWA | Cloudflare Pages Free | $0 |
| Payments | Stripe | per-txn |
| Mobile builds | EAS free / GitHub Actions | $0 |
| **Total** | | **~$25–26** |

Zero server ops, managed backups, single dashboard a non-developer can navigate.
Best fit for "volunteer-run, must just work."

### Stack C — Cheap self-hosted VPS (~$6–12/mo) — *only with a committed ops volunteer*
| Component | Choice | $/mo |
|---|---|---|
| VPS (app + self-managed Postgres + imgproxy) | Hetzner **CAX11** (2 vCPU/4 GB/20 TB) | ~$5 |
| Auth/RBAC | Better Auth (in-app, free) | $0 |
| Object storage | Backblaze B2 + Cloudflare (free egress) | ~$0–1 |
| Email | Amazon SES (~$0.50) or Brevo Free | $0–1 |
| Web / PWA | Cloudflare Pages Free | $0 |
| Backups | Hetzner snapshots / pg_dump → B2 | ~$1 |
| Payments | Stripe | per-txn |
| **Total** | | **~$6–12** |

Cheapest ongoing, full control, no lock-in — but **you own** OS patching, Postgres
backups, TLS, uptime, and a single box = no failover. Poor fit if the maintainer
leaves. Hetzner's 20 TB is EU-only; for US users add a CDN or use Linode/DO 4 GB
(~$24/mo).

---

## Category notes & alternatives considered

**BaaS / backend.** Supabase is the standout — the only option bundling **Postgres +
Auth/RBAC + Storage + functions** in a free tier far exceeding our scale. Firebase is
out (NoSQL, not Postgres; uncapped read costs). Appwrite Cloud ($15/mo) is the
cheapest managed fallback if we outgrow Supabase. Railway/Render/Fly are app-PaaS,
not full BaaS (bring your own auth/storage); Render's free Postgres **expires after
30 days**, so not viable for production data.

**Auth / RBAC.** Free RBAC at our scale: **Supabase Auth** (if using Supabase) or
**Better Auth** (open-source, unlimited MAU, if self-hosting). **Avoid Clerk and
Auth0** — their polished UIs paywall custom roles ($100/mo and $35/mo), making them
the *most* expensive choice at our tiny scale.

**Storage / pictures.** **Cloudflare R2** for zero egress (the bill-killer for photo
galleries). **Backblaze B2** is even cheaper storage with free egress via Cloudflare,
one extra integration step. Add **imgproxy** (free, self-hosted) or Cloudflare Images
free tier for thumbnails. Avoid S3/Supabase Storage as the *primary* photo store —
their $0.09/GB egress is where the cost hides.

**Email.** Several free tiers were cut in late 2025. **Brevo's ~9,000/mo free**
covers our entire volume (newsletters + transactional) at $0. **Resend free
(3,000/mo)** is a clean developer API for transactional. **Amazon SES** is cheapest
at scale (~$0.50/mo) but needs technical DNS/DKIM upkeep. **Postmark ($15/mo)** has
best-in-class deliverability — worth it only for can't-lose transactional mail.

**Payments.** Stripe: **2.9% + $0.30** cards, no monthly fee; use **ACH (0.8%, $5
cap)** for large dues/camp fees ($500 dues = $4 ACH vs ~$11 card). Stripe's nonprofit
card discount (2.2% + $0.30) likely **won't** apply — it requires ≥80% donation
volume, and troop dues/fees/popcorn aren't donations.

**Tagging** is application logic on Postgres (a `tags` table + join, or a `text[]` /
`jsonb` column with a GIN index) — no separate service or cost.

---

## Unavoidable extras (not monthly)

- **Apple Developer: $99/year.** A **nonprofit fee waiver exists** but requires the
  enrolling entity to have its own IRS 501(c)(3)/EIN, *not* sign the Paid
  Applications Agreement, and the app to be **free with no in-app purchases**. A troop
  without its own EIN would enroll through its chartered org/council. Verify status.
- **Google Play: $25 one-time.**
- **Mobile CI:** free via GitHub Actions, or EAS free tier (15+15 builds/mo).

---

## Verify before committing (§6 open items)
1. Exact Hetzner EUR price (in flux after a mid-2026 adjustment).
2. Supabase free-tier pause policy / current Pro inclusions.
3. Stripe Billing rate (only if we ever do recurring subscriptions — skip for one-off dues).
4. Our troop / chartered org **501(c)(3) status** — gates both the Apple waiver and any Stripe nonprofit discount.
5. Brevo's current free-tier daily cap (~300/day) vs. our peak send.

---

## How this maps to the PRD

Satisfies PRD §10 (platform/technical approach) and §7 NFRs: single backend = no
web/mobile data divergence (NFR-1); managed daily backups (NFR-4); encryption at
rest + RLS least-privilege (NFR-5); one-click export / no lock-in (NFR-10). Resolves
open question **OQ-3 (hosting & sustainability)** in favor of **Stack B** to avoid
repeating TroopTrack's lean-team reliability problems.
