-- Tables for feature areas that were CRUD-only in the first cut, plus the
-- household relationship columns. Apply after 001.
BEGIN;

-- §5.10 Equipment / quartermaster
CREATE TABLE IF NOT EXISTS equipment (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  condition     TEXT NOT NULL DEFAULT 'good'
                  CHECK (condition IN ('new','good','fair','poor','retired')),
  checked_out_to TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §5.12 Registrations (per-member term/anniversary records)
CREATE TABLE IF NOT EXISTS registrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      TEXT NOT NULL,
  anniversary_on DATE NOT NULL,
  expires_on     DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'registered'
                   CHECK (status IN ('registered','expiring','lapsed','dropped')),
  fee_paid       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registrations_expiry_idx ON registrations (expires_on);

-- §5.6 Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  audience   TEXT NOT NULL DEFAULT 'unit'
               CHECK (audience IN ('unit','patrol','den','committee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- §5.1 Household membership arrays (denormalized convenience alongside members.household_id)
ALTER TABLE households ADD COLUMN IF NOT EXISTS guardian_ids TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE households ADD COLUMN IF NOT EXISTS scout_ids    TEXT[] NOT NULL DEFAULT '{}';

COMMIT;
