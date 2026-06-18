-- §5.6 Communication: persist message threads so adult<->youth communication
-- is retained and auditable by unit admins (PRD §9). Participants are stored as
-- a JSON string for a simple, queryable audit record.
BEGIN;

CREATE TABLE IF NOT EXISTS messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject           TEXT NOT NULL,
  body              TEXT NOT NULL,
  participants      TEXT NOT NULL,        -- JSON array of {id,kind,isParentOfYouth}
  participant_count INTEGER NOT NULL,
  sender_role       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
