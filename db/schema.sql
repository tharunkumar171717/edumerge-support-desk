-- Idempotent. Everything lives in the support_desk schema; public is never touched.
CREATE SCHEMA IF NOT EXISTS support_desk;

-- Master data. The app loads these at runtime; rows below are only inserted when missing,
-- so edits made directly in the database survive re-running this file.
CREATE TABLE IF NOT EXISTS support_desk.teams (
  code        text PRIMARY KEY,
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0
);

-- Priority codes are fixed because workflow rules refer to them (a near deadline raises to HIGH);
-- labels, ordering and SLA windows are data.
CREATE TABLE IF NOT EXISTS support_desk.priorities (
  code              text PRIMARY KEY CHECK (code IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  label             text NOT NULL,
  rank              integer NOT NULL UNIQUE, -- higher = more urgent
  response_hours    numeric NOT NULL CHECK (response_hours > 0),
  resolution_hours  numeric NOT NULL CHECK (resolution_hours > 0)
);

CREATE TABLE IF NOT EXISTS support_desk.categories (
  code              text PRIMARY KEY,
  label             text NOT NULL,
  team_code         text NOT NULL REFERENCES support_desk.teams(code),
  default_priority  text NOT NULL REFERENCES support_desk.priorities(code),
  sort_order        integer NOT NULL DEFAULT 0,
  is_active         boolean NOT NULL DEFAULT true -- inactive: kept for old tickets, not offered for new ones
);

INSERT INTO support_desk.teams (code, label, sort_order) VALUES
  ('ACCOUNTS', 'Accounts Office', 1),
  ('ACADEMICS', 'Academic Office', 2),
  ('ADMIN_OFFICE', 'Administration Office', 3),
  ('EXAMS', 'Examination Cell', 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO support_desk.priorities (code, label, rank, response_hours, resolution_hours) VALUES
  ('LOW', 'Low', 1, 24, 120),
  ('MEDIUM', 'Medium', 2, 8, 72),
  ('HIGH', 'High', 3, 4, 48),
  ('URGENT', 'Urgent', 4, 2, 24)
ON CONFLICT (code) DO NOTHING;

INSERT INTO support_desk.categories (code, label, team_code, default_priority, sort_order) VALUES
  ('FEES', 'Fees', 'ACCOUNTS', 'MEDIUM', 1),
  ('ATTENDANCE', 'Attendance', 'ACADEMICS', 'MEDIUM', 2),
  ('ID_CARD', 'ID Card', 'ADMIN_OFFICE', 'LOW', 3),
  ('DOCUMENTS', 'Documents', 'ADMIN_OFFICE', 'MEDIUM', 4),
  ('CERTIFICATES', 'Certificates', 'EXAMS', 'HIGH', 5),
  ('OTHER', 'Other', 'ADMIN_OFFICE', 'LOW', 6)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS support_desk.users (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  role        text NOT NULL CHECK (role IN ('STUDENT', 'STAFF', 'MANAGER')),
  team        text REFERENCES support_desk.teams(code),
  roll_no     text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'STAFF') = (team IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS support_desk.tickets (
  id                serial PRIMARY KEY,
  student_id        integer NOT NULL REFERENCES support_desk.users(id),
  assignee_id       integer REFERENCES support_desk.users(id),
  category          text NOT NULL REFERENCES support_desk.categories(code),
  subject           text NOT NULL CHECK (length(subject) BETWEEN 5 AND 120),
  description       text NOT NULL CHECK (length(description) BETWEEN 10 AND 2000),
  priority          text NOT NULL REFERENCES support_desk.priorities(code),
  status            text NOT NULL CHECK (status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_ON_STUDENT', 'RESOLVED', 'CLOSED', 'CANCELLED')),
  needed_by         date,
  created_at        timestamptz NOT NULL,
  updated_at        timestamptz NOT NULL,
  first_response_at timestamptz,
  resolved_at       timestamptz,
  closed_at         timestamptz,
  sla_start_at      timestamptz NOT NULL,
  response_due_at   timestamptz NOT NULL,
  resolution_due_at timestamptz NOT NULL,
  paused_at         timestamptz,
  paused_seconds    integer NOT NULL DEFAULT 0 CHECK (paused_seconds >= 0),
  escalation_level  smallint NOT NULL DEFAULT 0 CHECK (escalation_level BETWEEN 0 AND 2),
  reopen_count      integer NOT NULL DEFAULT 0,
  resolution_note   text,
  reminder_sent_at  timestamptz,
  version           integer NOT NULL DEFAULT 1,
  -- Waiting on the student is the only state in which the resolution clock may be paused.
  CHECK ((status = 'WAITING_ON_STUDENT') = (paused_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS tickets_status_idx ON support_desk.tickets(status);
CREATE INDEX IF NOT EXISTS tickets_assignee_idx ON support_desk.tickets(assignee_id);
CREATE INDEX IF NOT EXISTS tickets_student_idx ON support_desk.tickets(student_id);
CREATE INDEX IF NOT EXISTS tickets_category_idx ON support_desk.tickets(category);

CREATE TABLE IF NOT EXISTS support_desk.comments (
  id          serial PRIMARY KEY,
  ticket_id   integer NOT NULL REFERENCES support_desk.tickets(id),
  author_id   integer NOT NULL REFERENCES support_desk.users(id),
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  is_internal boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_ticket_idx ON support_desk.comments(ticket_id);

-- Append-only audit trail; the app never updates or deletes rows here.
CREATE TABLE IF NOT EXISTS support_desk.ticket_events (
  id          serial PRIMARY KEY,
  ticket_id   integer NOT NULL REFERENCES support_desk.tickets(id),
  actor_id    integer REFERENCES support_desk.users(id),
  kind        text NOT NULL,
  from_value  text,
  to_value    text,
  note        text,
  created_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ticket_events_ticket_idx ON support_desk.ticket_events(ticket_id);

CREATE TABLE IF NOT EXISTS support_desk.notifications (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES support_desk.users(id),
  ticket_id   integer REFERENCES support_desk.tickets(id),
  message     text NOT NULL,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON support_desk.notifications(user_id, is_read);

-- Upgrade databases created before master data moved out of code: swap the hardcoded
-- CHECK lists for foreign keys. Each step is skipped once it has been applied.
ALTER TABLE support_desk.users DROP CONSTRAINT IF EXISTS users_team_check;
ALTER TABLE support_desk.tickets DROP CONSTRAINT IF EXISTS tickets_category_check;
ALTER TABLE support_desk.tickets DROP CONSTRAINT IF EXISTS tickets_priority_check;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_team_fkey' AND connamespace = 'support_desk'::regnamespace) THEN
    ALTER TABLE support_desk.users ADD CONSTRAINT users_team_fkey FOREIGN KEY (team) REFERENCES support_desk.teams(code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_category_fkey' AND connamespace = 'support_desk'::regnamespace) THEN
    ALTER TABLE support_desk.tickets ADD CONSTRAINT tickets_category_fkey FOREIGN KEY (category) REFERENCES support_desk.categories(code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_priority_fkey' AND connamespace = 'support_desk'::regnamespace) THEN
    ALTER TABLE support_desk.tickets ADD CONSTRAINT tickets_priority_fkey FOREIGN KEY (priority) REFERENCES support_desk.priorities(code);
  END IF;
END $$;
