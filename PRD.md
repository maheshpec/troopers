# Product Requirements Document — "Troopers"
### A Scouting Troop & Pack Management App (Web + iOS + Android)

| | |
|---|---|
| **Document owner** | maheshpec@gmail.com |
| **Status** | Draft v1.0 |
| **Last updated** | 2026-06-17 |
| **Programs supported** | Scouts BSA (Troop) and Cub Scouts (Pack) |
| **Deployment model** | Single-unit (self-hosted / private to our troop) |
| **Target platforms** | Responsive web app, iOS, Android |

---

## 1. Overview

### 1.1 Problem statement
Our troop currently runs on **TroopTrack**. While TroopTrack is not formally discontinued, it operates as a lean, slow-moving product: its mobile app is unreliable (≈2★, "loads about half the time," no calendar sync, data that doesn't transfer to web), advancement requires **double data entry** because there is no live sync with Scouting America's systems, and permissions are tied to individual users rather than roles — making leadership turnover painful. We want a modern, reliable, mobile-first replacement we control.

### 1.2 Vision
A single, reliable place for our troop and pack to manage **people, advancement, events, communication, and money** — with a genuinely good phone experience for parents and Scouts, and a frictionless, *validated* path to push advancement into Scouting America's official systems.

### 1.3 Goals
- **G1 — Reliable mobile experience.** Everything a parent or leader needs works on a phone, offline-tolerant, with no data-loss between app and web.
- **G2 — Single source of truth for advancement.** Track ranks, merit badges, and adventures per-requirement; eliminate re-entry.
- **G3 — Effortless official sync.** One-click generation of a **validated, pipe-delimited Scoutbook Plus advancement import file**, plus clean roster/training import from `my.scouting.org` exports.
- **G4 — Safe by design.** Youth-protection-compliant communication and COPPA-compliant data handling are built into the architecture, not bolted on.
- **G5 — Role-based administration.** Permissions follow leadership *positions*, so turnover is a reassignment, not a rebuild.

### 1.4 Non-goals (v1)
- Multi-tenant SaaS / billing / unit onboarding for other troops (single-unit only — see §13).
- Support for non-BSA programs (American Heritage Girls, Trail Life, Girl Scouts).
- A public-facing recruitment website / CMS.
- Venturing/Sea Scouts program models.
- A real-time, *automatic* two-way sync with Scouting America (technically impossible — see §6).

### 1.5 Key decisions (confirmed with stakeholder)
| Decision | Choice | Implication |
|---|---|---|
| Programs | Scouts BSA + Cub Scouts | Two advancement models; shared person/household core |
| Audience | Single troop (ours) | No multi-tenancy or billing; simpler auth; one config |
| Platforms | Web + iOS + Android | Installable **PWA** (web) ships first + cross-platform native mobile (see §10, §5.16) |
| BSA sync | Critical | But **file-based and one-way** — no public API exists |

---

## 2. Background research summary

### 2.1 TroopTrack feature baseline (what we must match)
Roster & households; advancement (ranks, merit badges, awards, per-requirement + bulk); email + true SMS; auto-generated newsletters; calendar with RSVP, fees, permission slips, attendance; **Scout money accounts** with PayPal/Stripe online payments; service hours / nights camped / miles hiked logging; equipment check-in/out; reports & backups; documents/forms storage; patrols/dens; leadership positions. Price anchor: **~$99/yr per unit**.

### 2.2 TroopTrack pain points (what we must beat)
- No live Scoutbook sync → duplicate entry.
- Unreliable mobile app; no calendar sync; app/web data divergence.
- Per-user (not role-based) permissions.
- Slow support; long-unresolved bugs.

### 2.3 Competitive landscape
- **Official (free):** Scoutbook / Scoutbook Plus / Internet Advancement / my.scouting.org — the *only* systems that officially sync to the national database.
- **Third-party (~$60–110/yr):** TroopMaster, TroopWebHost, ScoutTrack, Troop Kit; newer mobile-first entrants (Troop Campfire). All sync to BSA via **manual file upload only**.
- **Gap we exploit:** a polished, *reliable, mobile-native* experience with **frictionless, validated** official-file export.

### 2.4 Hard external constraints
- **No official public BSA API.** An unofficial community OpenAPI spec exists but is unsupported, may break, and carries ToS risk — *not* a dependency we build on.
- **Advancement export = pipe-delimited (`|`) text file**, uploaded manually into Scoutbook Plus. Format must be validated directly with BSA before launch.
- **Roster/training inbound = admin-downloaded exports** from my.scouting.org (not a live feed).
- **Safeguarding Youth Training (SYT)** replaced YPT (May 2025); now **annual** expiry. App must track currency.
- **Individual, anniversary-based registration renewal** (since 2024): unit renewal is separated from member renewal; each member renews on their own join-anniversary (national notifies starting 60 days out). Members lapse on different dates — the app must track and remind per-member (see §5.12, §5.13).
- **COPPA** applies (Cub Scouts are under 13); 2025 amendments require written security + data-retention/deletion policies, data minimization, and verifiable parental consent. Full-compliance deadline April 22, 2026.

---

## 3. Target users & personas

| Persona | Role | Primary needs |
|---|---|---|
| **Parent/Guardian** | Account holder for their Scout(s) | RSVP, pay fees, see advancement, get announcements, sign permission slips, manage their child's data |
| **Scout (11–17, Troop)** | Youth member | See own advancement, sign up for events, message patrol (within YP rules) |
| **Cub Scout (5–11, Pack)** | Youth member | *Parent-managed account*; minimal/no direct data entry (COPPA) |
| **Unit Leader** (Scoutmaster / Cubmaster) | Top program leader | Roster, advancement approvals, attendance, comms, reports |
| **Advancement Chair** | Tracks & reports advancement | Per-requirement entry, bulk awards, **generate Scoutbook file**, board-of-review prep |
| **Treasurer** | Money | Scout accounts, dues, online payments, reimbursements, ledgers |
| **Committee / Admin** | Unit governance | Role assignment, documents, compliance dashboards (SYT/medical expiry) |
| **Patrol Leader / Den Chief** (youth) | Youth leadership | Patrol/den rosters, event sign-ups, limited comms |

---

## 4. Scope — feature areas (v1)

1. People & Households (roster, profiles, relationships)
2. Roles & Permissions (position-based)
3. Advancement (Scouts BSA + Cub Scouts)
4. Official Scouting America sync (import/export)
5. Calendar & Events (RSVP, fees, permission slips, attendance)
6. Communication (announcements, email, SMS, messaging — YP-safe)
7. Money & Payments (Scout accounts, dues, online payments)
8. Activity Logs (service hours, nights camped, miles hiked)
9. Documents & Forms (medical, permission slips, files)
10. Equipment / Quartermaster
11. Reporting & Dashboards (incl. compliance: SYT, medical)
12. Mobile apps (iOS/Android) with offline tolerance & push
13. **Membership & Registration lifecycle** (join/renewal/recharter, anniversary-based)
14. **Reminders & Notifications engine** (configurable, cross-cutting)
15. **Unit settings & configuration** (configurable durations & rules)
16. Photos & Media (galleries with consent)
17. **Progressive Web App (PWA)** — installable, offline-capable web app

---

## 5. Detailed functional requirements

> Priority key: **P0** = must-have for v1 launch · **P1** = fast-follow · **P2** = later.

### 5.1 People & Households
- **FR-P-1 (P0)** Create/edit member profiles: name, BSA member ID, DOB, contact info, program (Troop/Pack), patrol/den, leadership position(s), join date, status (active/inactive).
- **FR-P-2 (P0)** **Household model**: group parents/guardians and Scouts into a household; one Scout may have multiple guardians; one guardian may have multiple Scouts (and across both Troop and Pack).
- **FR-P-3 (P0)** **Parent-managed youth accounts**: youth under 13 (all Cubs and younger Scouts) have no self-service login by default; their data is entered/controlled by a linked guardian under verifiable parental consent (COPPA — §9).
- **FR-P-4 (P0)** Store medical-form dates and expiry; flag "medical on file" status.
- **FR-P-5 (P1)** Order of the Arrow membership/dates; driver info for adults (for carpool/tour planning).
- **FR-P-6 (P0)** CSV/roster import from my.scouting.org council export; de-duplication by BSA member ID.
- **FR-P-7 (P1)** Member directory with privacy controls (members opt into directory visibility).

### 5.2 Roles & Permissions (position-based — fixes TroopTrack's #1 structural gripe)
- **FR-R-1 (P0)** Permissions are attached to **positions/roles**, not individuals. Assigning a person to "Treasurer" grants the treasurer permission set automatically.
- **FR-R-2 (P0)** Standard role library: Scoutmaster, Asst. Scoutmaster, Cubmaster, Committee Chair, Advancement Chair, Treasurer, Membership Chair, Admin, plus youth roles (SPL, ASPL, PL, Scribe, Quartermaster, Den Chief).
- **FR-R-3 (P0)** Granular permission scopes: manage_roster, manage_advancement, approve_advancement, manage_money, manage_events, send_comms, manage_documents, manage_equipment, view_reports, manage_roles.
- **FR-R-4 (P1)** Custom roles; effective-permission preview ("what can this person do?").
- **FR-R-5 (P0)** Leadership term tracking (start/end dates); reassigning a role instantly transfers access.

### 5.3 Advancement
- **FR-A-1 (P0)** **Scouts BSA model**: ranks Scout→Eagle with per-requirement tracking; merit badges (with requirement subitems); Eagle-required badge flags; partial completions; dates earned and approved-by.
- **FR-A-2 (P0)** **Cub Scouts model**: current adventure-based program — rank adventures, required vs. elective, belt loops/pins; tracked per-adventure/per-requirement.
- **FR-A-3 (P0)** **Bulk entry**: mark a requirement complete for many Scouts at once (e.g., from an event/campout).
- **FR-A-4 (P0)** Advancement approval workflow: leader review → approve → "ready to purchase/award" state → awarded (date).
- **FR-A-5 (P0)** **Maintained requirement catalogs** for both programs, versioned with effective dates (program changes happen — e.g., the 2024 Cub updates). Catalog updates shipped without app redeploy.
- **FR-A-6 (P1)** Board-of-review / Scoutmaster-conference prep view per Scout, with **scheduling** of conferences/BORs.
- **FR-A-7 (P1)** Award-ceremony / purchase-list management (what to buy at the Scout Shop).
- **FR-A-8 (P0)** Full advancement history & audit (who entered/approved, when).
- **FR-A-9 (P1)** **Position of Responsibility (PoR) & time-in-rank tracking**: many ranks require months serving in a leadership position and "active participation" — track tenure against requirements and flag when a Scout becomes eligible.
- **FR-A-10 (P1)** **Merit Badge Counselor registry**: counselor list, badges each is approved for, contact info; **blue-card workflow** (assign → in-progress → complete); YP-safe counselor↔Scout contact (§9).
- **FR-A-11 (P1)** **Eagle pipeline**: Life→Eagle tracking with the **age-18 deadline countdown**, Eagle-required badge checklist, Eagle service-project status, references, and rank-deadline alerts (ties to Reminders §5.14).
- **FR-A-12 (P2)** Other awards & recognitions: religious emblems, NOVA/Supernova STEM, special awards, knots, OA milestones.

### 5.4 Official Scouting America sync (P0 — the strategic differentiator)
- **FR-S-1 (P0)** **Export advancement** to a **pipe-delimited (`|`) Scoutbook Plus import file**, schema-validated against the current BSA spec, with a pre-export validation report (missing dates, malformed records flagged before download).
- **FR-S-2 (P0)** Export selects only **new/unsynced** advancement since last export; mark records "submitted to council" with date to prevent re-submission.
- **FR-S-3 (P0)** **Import roster & training** from my.scouting.org / council exports (membership, registration status, **SYT/training records**).
- **FR-S-4 (P0)** Reconciliation view: diff between local roster and imported council roster; surface adds/drops/mismatches.
- **FR-S-5 (P1)** Guided in-app instructions + deep link for uploading the file into Scoutbook Plus.
- **FR-S-6 (P2)** *Optional, clearly-labeled "experimental/unofficial"* convenience connector — **off by default**, with explicit warning that it is unsupported by BSA and may break. **No core feature depends on it.**
- **Constraint:** Validate the export column spec directly with BSA/Scoutbook before launch (format differs between legacy Scoutbook and Scoutbook Plus).

### 5.5 Calendar & Events
- **FR-E-1 (P0)** Create events: title, type, location (with map link), start/end, description, coordinator(s), cost/fee, RSVP deadline.
- **FR-E-2 (P0)** **RSVP** (going / not going / maybe) with guest count; per-Scout and per-household; RSVP roster export.
- **FR-E-3 (P0)** **Permission slips**: attach auto-filled, printable permission slip (event + Scout details); optional **digital signature** by guardian in-app; "permission required to attend" gate.
- **FR-E-4 (P0)** "Current medical required to attend" flag with auto-check against medical-form expiry.
- **FR-E-5 (P0)** **Attendance** capture (by leader) that simultaneously logs service hours, nights camped, miles, and requirement completions (one entry, many outputs).
- **FR-E-6 (P0)** **Two-way calendar sync**: subscribable **iCal/ICS feed** + Google Calendar; per-user feeds. (Directly fixes TroopTrack's missing calendar sync.)
- **FR-E-7 (P1)** Event-linked payments (pay the campout fee at RSVP — ties to §5.7).
- **FR-E-8 (P1)** Carpool/driver coordination using adult driver info.
- **FR-E-9 (P1)** Recurring events (weekly meetings).
- **FR-E-10 (P1)** **Volunteer / signup slots** per event (drivers, chaperones, snack/meal, gear, duty roster) with capacity limits — replaces ad-hoc SignUpGenius use.
- **FR-E-11 (P1)** **Event check-in / headcount & two-deep verification**: who is actually on the trip (safety roster), with registered-adult count surfaced.
- **FR-E-12 (P1)** **Trip/activity roster pack**: printable/offline roster with emergency contacts, allergies/meds, and medical-on-file status for the leader in charge.
- **FR-E-13 (P2)** Annual program planning calendar (plan the year; meeting agendas / plan-of-the-week).

### 5.6 Communication (Youth-Protection-safe by design — §9)
- **FR-C-1 (P0)** **Announcements** feed (unit-wide and group-targeted: patrol, den, committee).
- **FR-C-2 (P0)** **Email** to lists/groups; delivery tracking.
- **FR-C-3 (P0)** **SMS/text** to opted-in members (true SMS via gateway; per-recipient opt-in & STOP handling).
- **FR-C-4 (P0)** **Auto-generated newsletter** (weekly/monthly): upcoming events, assignments, recent/partial advancement, money-account balance — per household.
- **FR-C-5 (P0)** **Direct messaging with YP guardrails**: **no 1-on-1 adult↔youth messages.** Any adult↔youth thread **auto-includes** a second registered adult and/or the youth's parent (mirrors Scoutbook). Adult↔adult and parent-mediated youth threads allowed.
- **FR-C-6 (P0)** **No private/hidden channels** for adult-youth comms; all such communication is admin-monitorable and **retained/auditable**.
- **FR-C-7 (P0)** **Push notifications** (mobile) for announcements, event reminders, badge approvals, payments due.
- **FR-C-8 (P1)** Message templates; scheduled sends.

### 5.7 Money & Payments
- **FR-M-1 (P0)** **Scout/household money accounts** with full transaction ledger (date, type, amount, memo, receipt attachment, entered-by).
- **FR-M-2 (P0)** **Dues** management: assign, bill, track paid/unpaid.
- **FR-M-3 (P0)** **Online payments** via **Stripe** (primary) and optionally PayPal: pay dues, event fees, campouts; cart for multiple items. Fees disclosed at checkout.
- **FR-M-4 (P0)** Auto-bill accounts for paid events on RSVP; balance reflected in newsletter.
- **FR-M-5 (P1)** **Fund transfers** between accounts (paired debit/credit).
- **FR-M-6 (P1)** **Reimbursement requests** (leader submits receipt → treasurer approves → pays).
- **FR-M-7 (P1)** **Fundraising campaigns** (popcorn, camp cards, wreaths): track per-Scout sales and **credit a share of proceeds to that Scout's account** ("ideal year of Scouting"); campaign totals and goals.
- **FR-M-8 (P0)** Treasurer reports: balances, aging/unpaid dues, transaction export (CSV).
- **FR-M-9 (P1)** **Record offline payments** (cash/check) and **refunds**; per-household **account statements** parents can view/download.
- **FR-M-10 (P2)** Unit annual **budget** vs. actuals (income/expense categories).
- **FR-M-11 (P1)** **Registration-fee collection**: bill the annual national membership fee at renewal time and reconcile (ties to §5.12).
- **Constraint:** PCI scope minimized by using Stripe-hosted payment elements; the app never stores card data.

### 5.8 Activity Logs
- **FR-L-1 (P0)** Log **service hours**, **nights camped**, **miles hiked**, days of activity — per Scout, linked to events where possible.
- **FR-L-2 (P1)** Service-hour export compatible with Scouting America activity logs / Eagle requirements.
- **FR-L-3 (P1)** Per-Scout activity summary for awards (e.g., camping, hiking, service milestones).

### 5.9 Documents & Forms
- **FR-D-1 (P0)** Unit document library with folders & permissions (e.g., committee-only).
- **FR-D-2 (P0)** **Medical form (BSA Annual Health & Medical Record) storage** with expiry tracking and access restricted to authorized leaders.
- **FR-D-3 (P0)** Auto-generated, pre-filled **permission slips** per event (ties to FR-E-3).
- **FR-D-4 (P1)** Generated report/backup storage per user.
- **Constraint:** Medical/PII documents encrypted at rest; access logged.

### 5.10 Equipment / Quartermaster
- **FR-Q-1 (P1)** Equipment inventory with condition/notes.
- **FR-Q-2 (P1)** Check-out/check-in to members or patrols; overdue tracking.

### 5.11 Reporting & Dashboards
- **FR-RP-1 (P0)** Advancement reports (unit, patrol/den, individual); "ready to award" list.
- **FR-RP-2 (P0)** **Compliance dashboard**: **SYT/training currency** (annual expiry flagged), medical-form expiry, registration status — color-coded, with re-charter readiness view.
- **FR-RP-3 (P0)** Roster, attendance, participation, money, activity-log reports; CSV export.
- **FR-RP-4 (P0)** **Full data backup/export** (unit owns its data) — human-readable + machine-readable.
- **FR-RP-5 (P1)** Configurable/saved report views.
- **FR-RP-6 (P1)** **Renewal/recharter readiness report**: who is due/overdue to renew, training currency, and registered-adult counts — one screen to drive re-charter (ties to §5.12, §5.13).
- **FR-RP-7 (P2)** Journey to Excellence (JTE) metric tracking.

### 5.12 Membership & Registration lifecycle (P0 — the gap you flagged)
> As of 2024, Scouting America **separated unit renewal from individual membership renewal**. Each member now renews on **their own join-anniversary date** (national emails a renewal link starting **60 days before**), *not* a single synchronized unit recharter. Members who joined before Aug 1, 2023 keep a Dec 31 anniversary. So every Scout and adult can lapse on a **different day** — tracking this is now a core job, not a once-a-year task.

- **FR-MR-1 (P0)** Store each member's **registration anniversary/expiration date**, registration status (registered / expiring / lapsed / dropped), and membership term; imported from the council roster (§5.4) and editable.
- **FR-MR-2 (P0)** **Registration renewal tracking & reminders**: surface who is upcoming/overdue at **configurable lead times** (default 60/30/14/0 days, per §5.13/§5.14); drive automatic reminders to the member's household and the Membership Chair.
- **FR-MR-3 (P0)** **Unit charter renewal** (the separate unit-level annual process): track the unit charter expiration, a renewal **checklist** (registered adults trained, youth/adult counts, fees), and readiness status — distinct from individual renewals.
- **FR-MR-4 (P1)** **Join / prospect pipeline**: capture interested youth/leads → applied → registered; new-member onboarding checklist (application, fee, YPT/SYT for adults).
- **FR-MR-5 (P1)** **Lifecycle transitions**: Cub den progression (Lion→…→Arrow of Light), **Webelos/AOL crossover into a Troop**, transfers in/out, dual registration, and **graduation/alumni** status.
- **FR-MR-6 (P1)** **Membership fee at renewal**: show the current national fee, optionally collect it (§5.7 FR-M-11), and mark paid.
- **FR-MR-7 (P0)** **Registration history & audit** per member (terms, dates, status changes).

### 5.13 Reminders & Notifications engine (P0 — the gap you flagged)
A single, **configurable, cross-cutting** subsystem (not one-off reminders bolted onto each feature). Every time-bound thing in the app can emit reminders through one consistent engine, delivered via push / email / SMS / in-app per the recipient's preferences and YP rules.

- **FR-N-1 (P0)** **Reminder rule types** out of the box: registration renewal (§5.12), **SYT/training expiry**, **medical-form (AHMR) expiry**, unpaid dues / overdue balance, event RSVP deadline, event upcoming, payment due, **rank/Eagle age-18 deadline**, stalled advancement, permission-slip not signed.
- **FR-N-2 (P0)** **Configurable lead times & cadence per rule**: e.g., renewal at 60/30/14/0 days; medical at 45/14 days; configurable repeat interval and quiet hours. Sensible defaults shipped; admins adjust without code.
- **FR-N-3 (P0)** **Configurable recipients & escalation** per rule: notify the household, the member, and/or a responsible role (Membership Chair, Treasurer, Advancement Chair); optional escalation to a leader if unacknowledged.
- **FR-N-4 (P0)** **Multi-channel delivery** (push, email, SMS, in-app) honoring per-user channel preferences, opt-outs, and YP guardrails (§9 — no 1-on-1 adult↔youth).
- **FR-N-5 (P1)** **Acknowledgement / "action required" reminders**: recipient can mark done (e.g., "renewed," "medical uploaded"); reminders stop automatically when the underlying condition clears.
- **FR-N-6 (P1)** **Digest mode**: roll multiple reminders into the periodic newsletter/digest instead of separate messages.
- **FR-N-7 (P1)** **Admin reminder console**: see scheduled/sent reminders, snooze, resend, or trigger manually.
- **FR-N-8 (P0)** Reminders fire **server-side on schedule** (works even if no one opens the app) — implemented on the chosen hosting's scheduled-function/cron (see HOSTING.md).

### 5.14 Unit settings & configuration (P0 — "configurable durations etc.")
Centralized, admin-editable configuration so durations and rules are **data, not code** (NFR-8). All of the following are configurable without a redeploy:

- **FR-CFG-1 (P0)** **Configurable validity durations**: medical-form validity (default 12 mo), SYT/training validity (default 12 mo, annual), registration term, dues period/cycle, RSVP window default, payment-due window.
- **FR-CFG-2 (P0)** **Configurable reminder lead times & cadences** for every rule in §5.13.
- **FR-CFG-3 (P0)** **Unit profile & program year**: unit number(s), council/district, charter org, program-year start, meeting schedule, fiscal year, time zone.
- **FR-CFG-4 (P0)** **Roles & permission-set configuration** (ties to §5.2): which positions exist and what each can do.
- **FR-CFG-5 (P1)** **Dues amounts & fee schedule**, default event fees, late-fee rules.
- **FR-CFG-6 (P1)** **Communication defaults**: newsletter cadence, sender identity, channel defaults, quiet hours.
- **FR-CFG-7 (P1)** **Feature toggles** per unit (e.g., enable/disable fundraising, equipment, SMS).
- **FR-CFG-8 (P0)** All settings changes are **audit-logged**.

### 5.15 Photos & Media
- **FR-PH-1 (P1)** **Event photo galleries** (uploaded to object storage — see HOSTING.md), organized by event/album, with **tagging**.
- **FR-PH-2 (P0)** **Per-youth photo-consent flag** enforced: Scouts whose guardians have not consented are excluded from shared galleries/exports (§9, COPPA).
- **FR-PH-3 (P1)** Access controls (unit-only, committee-only) and download/share controls.

### 5.16 Progressive Web App (PWA)
The responsive web app ships as an **installable PWA** — a no-app-store path that delivers most of the phone experience on day one (and works on desktop). It lets us **launch on web + PWA before** the native iOS/Android apps clear store review, and stays a first-class target afterward.

- **FR-PWA-1 (P0)** **Web App Manifest** (name, icons, theme/background colors, standalone display) so users can **"Add to Home Screen"** on Android/iOS and install on desktop; launches full-screen without browser chrome.
- **FR-PWA-2 (P0)** **Service worker** providing an app shell + offline cache: roster, calendar, a Scout's advancement, and trip safety rosters remain **viewable offline** (mirrors NFR-2). Cache-busting/versioned updates with a "new version available" prompt.
- **FR-PWA-3 (P0)** **Installability & served over HTTPS** with a passing Lighthouse PWA audit; works on current Chrome/Edge/Firefox/Safari.
- **FR-PWA-4 (P1)** **Web Push notifications** for the reminders engine (§5.13) where the platform supports it (Android/desktop broadly; **iOS Safari ≥16.4 only when installed to Home Screen**). Falls back to email/SMS and to native push in the mobile apps where web push is unavailable.
- **FR-PWA-5 (P1)** **Background sync / queued writes**: actions taken offline (e.g., attendance at a campout) are queued in the service worker and synced on reconnect — parity with the native offline-write behavior (NFR-2).
- **FR-PWA-6 (P2)** Optional niceties: share-target, file-upload from camera for photos/medical docs, periodic background refresh of the newsletter/digest.
- **Constraint:** Sensitive data (medical/PII) is **not** persisted in offline caches beyond what a logged-in session needs; caches are cleared on logout, and the service worker honors the same role-based access as the API.

---

## 6. Integration architecture (Scouting America)

Because **no official public API exists**, integration is **file-mediated and admin-initiated**:

```
my.scouting.org / Council roster export  ──(admin download)──►  Troopers IMPORT
        (membership, registration, SYT/training)                     │
                                                                     ▼
                                                        Single source of truth
                                                        (roster + advancement)
                                                                     │
                                  Troopers EXPORT (pipe-delimited file) │
                                                                     ▼
                                              admin uploads to Scoutbook Plus
                                              (advancement → national database)
```

Design principles:
- **Inbound (roster/training):** parse admin-supplied council/my.scouting exports; reconcile by BSA member ID.
- **Outbound (advancement):** generate a **validated pipe-delimited file**; track submitted state to avoid duplicates.
- **No hard dependency** on the unofficial community API. Any connector is optional, opt-in, clearly labeled unsupported, and isolated behind an adapter so it can be disabled without affecting core flows.
- **Validate the file spec with BSA before launch** (open item — §14).

---

## 7. Non-functional requirements

| # | Requirement |
|---|---|
| **NFR-1 Reliability** | No data divergence between mobile and web — single backend, single source of truth; mobile writes are durable and sync on reconnect. Directly addresses TroopTrack's core failure. |
| **NFR-2 Offline tolerance** | Mobile apps cache roster/calendar/advancement read-only offline; queue writes (e.g., attendance taken at a campout with no signal) and sync when back online. |
| **NFR-3 Performance** | Common screens (roster, calendar, a Scout's advancement) load < 1.5s on a typical phone connection. |
| **NFR-4 Availability** | Target 99.5%+; graceful degradation; nightly automated backups with tested restore. |
| **NFR-5 Security** | TLS everywhere; encryption at rest for PII/medical; least-privilege via roles; full audit log of sensitive actions (advancement, money, medical, messaging). |
| **NFR-6 Privacy/Compliance** | COPPA + BSA youth-protection (§9); written security program & data-retention/deletion policy. |
| **NFR-7 Accessibility** | WCAG 2.1 AA for web; platform accessibility APIs on mobile. |
| **NFR-8 Maintainability** | Requirement catalogs & role definitions are **data, not code** — updatable without redeploy. |
| **NFR-9 Observability** | Error tracking, structured logs, uptime + delivery (email/SMS/push) monitoring. |
| **NFR-10 Data portability** | One-click full export; no lock-in (we left TroopTrack; others can leave us). |

---

## 8. Information model (high level)

Core entities and key relationships:

- **Unit** (our troop + pack; single tenant) → has **Programs** (Troop, Pack)
- **Person** → roles: youth or adult; belongs to **Household**(s)
- **Household** → links Guardians ↔ Scouts; owns a **MoneyAccount**
- **Membership** → Person↔Program, with Patrol/Den, status, BSA member ID
- **Position/Role** → assigned to Person (term-dated) → grants **Permissions**
- **AdvancementCatalog** (versioned) → Ranks/MeritBadges/Adventures → **Requirements**
- **AdvancementRecord** → Person × Requirement (status, dates, approved-by, submitted-to-council flag)
- **Event** → RSVPs, Fees, PermissionSlips, **AttendanceRecords**
- **AttendanceRecord** → feeds ActivityLogs + AdvancementRecords
- **MoneyAccount** → Transactions; **Payment** (Stripe) → Transaction
- **Message/Announcement** → audience, YP-copy rules, retention
- **Document** → type (medical/form/file), access scope, expiry
- **Equipment** → CheckoutRecord
- **Registration** → Person × term (anniversary/expiration date, status, fee) — drives renewal reminders
- **UnitCharter** → renewal date, checklist, status
- **ReminderRule** (config: type, lead times, recipients, channels) → generates **ReminderInstance**s
- **UnitSettings** → configurable durations, fee schedule, program year, feature toggles
- **MeritBadgeCounselor** → approved badges; **BlueCard** → Scout × badge × counselor × status
- **SignupSlot** → Event × role × capacity → Signups
- **FundraisingCampaign** → per-Scout Sales → MoneyAccount credits
- **PhotoAlbum** → Photos (tags, consent-filtered)

---

## 9. Safety, youth protection & privacy (design constraints, not features)

These are **architectural invariants**:

1. **No 1-on-1 adult↔youth communication** in any channel. The messaging system *cannot* create such a thread; it auto-adds a second adult and/or the youth's parent. Enforced server-side.
2. **No private/hidden adult-youth channels.** All adult-youth communication is visible to unit admins and **retained for audit**.
3. **Two-deep leadership** reflected in comms and event ownership.
4. **Parent-managed youth accounts** for under-13s; youth self-registration disabled by default.
5. **Verifiable parental consent** flow before collecting any youth PII (COPPA); privacy policy + direct parental notice.
6. **Data minimization**; **written data-retention & deletion policy** with enforced limits (delete youth data when no longer needed); **written information-security program** (2025 COPPA mandates; full compliance by April 22, 2026).
7. **Caution with biometrics/photos** — youth photos require parental consent to store/share; no facial recognition.
8. **SYT/training gating**: leaders with lapsed Safeguarding Youth Training (annual) are flagged and may be restricted from messaging/sensitive actions until current.

---

## 10. Platform & technical approach (proposed, for engineering review)

> Architecture is a recommendation; final choices owned by engineering.

- **Single backend API** (the source of truth) — e.g., a REST/GraphQL service with a relational DB (PostgreSQL). Guarantees web/mobile parity (NFR-1).
- **Web + PWA**: responsive SPA (e.g., React) built as an **installable, offline-capable PWA** (manifest + service worker; e.g., Vite PWA / Workbox) — §5.16. Ships first and serves both desktop admin work and a phone experience with no app-store dependency.
- **Mobile**: **one cross-platform codebase** (React Native or Flutter) shipping iOS + Android, sharing the same backend as the PWA — native push + offline cache for the best phone UX. The PWA covers phones in the interim and as a fallback.
- **Auth**: email/password + magic link; SSO optional; MFA for admin/treasurer roles.
- **Payments**: Stripe (hosted elements; minimal PCI scope).
- **Messaging infra**: transactional email provider; SMS gateway with opt-in/STOP; push via **Web Push (PWA)** and **APNs/FCM** (native).
- **Integration layer**: file import/export adapters; optional unsupported-connector isolated behind a flag.
- **Catalogs/roles as data**: seeded & updatable via admin tooling without redeploy.
- **Hosting**: single-unit can run on a small managed stack; nightly backups.

*Rationale for cross-platform mobile:* a single troop's dev capacity is limited; one mobile codebase + one web app + one backend minimizes the maintenance burden that sank TroopTrack's mobile reliability.

---

## 11. Success metrics

| Metric | Target |
|---|---|
| Parent/leader monthly active use | > 80% of households active monthly |
| Mobile crash-free sessions | > 99.5% |
| Advancement double-entry eliminated | 0 records manually re-entered into Scoutbook (all via export file) |
| Event RSVP completion | > 90% of households RSVP before deadline |
| Online dues paid digitally | > 70% of dues collected via app |
| Compliance visibility | 100% of SYT/medical expiries surfaced ≥ 30 days ahead |
| Data-loss incidents (app↔web) | 0 |
| Time to reassign a leadership role's access | < 1 minute (vs. manual per-user in TroopTrack) |

---

## 12. Release plan (phased)

**Phase 0 — Foundations (P0 infra)**
Auth, single-unit setup, Person/Household model, role-based permissions, my.scouting roster import, full backup/export.

**Phase 1 — MVP (replace TroopTrack core), shipped as a PWA first**
Delivered on the **installable PWA** (manifest + service-worker offline shell + web push) so we launch without waiting on app-store review: Advancement (Troop + Pack) with bulk entry & approval; **validated Scoutbook Plus export**; Calendar + RSVP + ICS sync; **registration-renewal tracking + the reminders engine**; Announcements + email + SMS; Documents incl. medical + permission slips; compliance dashboard (SYT/medical/registration). Native iOS/Android apps (push + offline read) follow on the same backend.

**Phase 2 — Money & engagement**
Scout accounts, dues, **Stripe online payments**, event-linked payments, auto-newsletter, attendance→activity-log automation, board-of-review prep.

**Phase 3 — Polish & extras**
Reimbursements, fund transfers, fundraisers, equipment/quartermaster, carpool, custom roles/reports, offline write-sync hardening.

**Migration**: import existing TroopTrack data (roster, advancement, money balances, documents) via CSV export → mapping → validation → load, run in parallel for one cycle before cutover.

---

## 13. Future considerations (explicitly out of scope for v1)
- Multi-unit / SaaS productization (if other troops want it) — the data model keeps a single `Unit` boundary so this remains *possible* without forcing the complexity now.
- Additional programs (Venturing, Sea Scouts; non-BSA orgs).
- Public recruitment website/CMS.
- Deeper official integration **if/when** Scouting America ships a real API.

---

## 14. Open questions / risks

| # | Item | Owner | Notes |
|---|---|---|---|
| OQ-1 | **Confirm current Scoutbook Plus pipe-delimited column spec** with BSA before building export | Eng/Advancement Chair | Format changed legacy→Plus; gate FR-S-1 on this |
| OQ-2 | Verifiable parental consent method (text-plus vs. signed form vs. ID) | Committee | COPPA full-compliance deadline 2026-04-22 |
| OQ-3 | Hosting & who maintains it long-term (single-unit sustainability) | Stakeholder | **Addressed in [HOSTING.md](./HOSTING.md)** — recommend Stack A (~$0/mo: Supabase Free + free keep-alive & backup crons); upgrade to Pro ($25/mo) only if the DB ceiling is approached |
| OQ-4 | SMS gateway choice & cost model | Eng | Per-message cost; opt-in management. See [HOSTING.md](./HOSTING.md) for email/payments choices |
| OQ-5 | Extent of offline *write* support at launch (attendance at campouts) | Eng/Product | Phase 1 read-only vs. Phase 3 full write-sync |
| OQ-6 | Data-retention periods for youth PII & medical | Committee/Legal | Required written policy (COPPA 2025) |
| OQ-7 | Will we attempt the optional unofficial connector at all? | Stakeholder | ToS & breakage risk; recommend deferring to P2/no |

---

*This PRD is intentionally scoped to a single troop+pack we operate ourselves, with reliability, role-based administration, and a frictionless validated path into Scouting America's official systems as the three things we do markedly better than the tool we're leaving.*
