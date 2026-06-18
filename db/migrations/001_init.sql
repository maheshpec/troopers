-- Troopers initial schema (PRD §8 information model).
-- The API currently uses in-memory repositories (ponytail); these tables are
-- the upgrade target. Apply with: psql "$DATABASE_URL" -f db/migrations/001_init.sql
--
-- Every table carries id/created_at to match the Repository<Entity> contract,
-- so swapping an in-memory repo for a pg-backed one is a drop-in change.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- §5.1 People & Households -------------------------------------------------
CREATE TABLE households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id           UUID REFERENCES households(id) ON DELETE SET NULL,
  first_name             TEXT NOT NULL,
  last_name              TEXT NOT NULL,
  kind                   TEXT NOT NULL CHECK (kind IN ('youth','adult')),
  program                TEXT NOT NULL CHECK (program IN ('troop','pack')),
  bsa_member_id          TEXT UNIQUE,
  registration_expires_on DATE,
  registration_status    TEXT NOT NULL DEFAULT 'registered'
                           CHECK (registration_status IN ('registered','expiring','lapsed','dropped')),
  photo_consent          BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX members_reg_expiry_idx ON members (registration_expires_on);

-- §5.2 Roles & position-based permissions ----------------------------------
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position    TEXT NOT NULL,
  person_id   UUID REFERENCES members(id) ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  term_start  DATE,
  term_end    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §5.3 Advancement ----------------------------------------------------------
CREATE TABLE advancement_records (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bsa_member_id         TEXT NOT NULL,
  member_name           TEXT NOT NULL,
  advancement_type      TEXT NOT NULL CHECK (advancement_type IN ('rank','merit_badge','adventure','award')),
  advancement           TEXT NOT NULL,
  date_completed        DATE NOT NULL,
  approved              BOOLEAN NOT NULL DEFAULT false,
  submitted_to_council_on DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX advancement_unsubmitted_idx ON advancement_records (approved, submitted_to_council_on);

-- §5.5 Events ---------------------------------------------------------------
CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,
  location    TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  fee_cents   INTEGER NOT NULL DEFAULT 0,
  rsvp_deadline TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at >= starts_at)
);

CREATE TABLE rsvps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  response   TEXT NOT NULL CHECK (response IN ('going','not_going','maybe')),
  guests     INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);

-- §5.7 Money ----------------------------------------------------------------
CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  kind         TEXT NOT NULL,
  memo         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transactions_account_idx ON transactions (account_id);

-- §5.8 Activity logs --------------------------------------------------------
CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('service_hours','nights_camped','miles_hiked')),
  quantity    NUMERIC NOT NULL,
  occurred_on DATE NOT NULL,
  event_id    UUID REFERENCES events(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §5.9 Documents ------------------------------------------------------------
CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('medical','permission_slip','form','file')),
  storage_key TEXT NOT NULL,
  expires_on  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §5.13 Reminder rules ------------------------------------------------------
CREATE TABLE reminder_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,
  lead_days       INTEGER[] NOT NULL,
  channels        TEXT[] NOT NULL,
  recipient_roles TEXT[] NOT NULL DEFAULT '{parent}',
  enabled         BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §5.15 Photos --------------------------------------------------------------
CREATE TABLE photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id        TEXT NOT NULL,
  storage_key     TEXT NOT NULL,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  tagged_youth_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §5.14 Unit settings (singleton) ------------------------------------------
CREATE TABLE unit_settings (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings    JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
