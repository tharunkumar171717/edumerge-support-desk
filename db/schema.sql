-- Idempotent. Everything lives in the support_desk schema; public is never touched.
CREATE SCHEMA IF NOT EXISTS support_desk;

CREATE TABLE IF NOT EXISTS support_desk.users (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL UNIQUE,
  role        text NOT NULL CHECK (role IN ('STUDENT', 'STAFF', 'MANAGER')),
  team        text CHECK (team IN ('ACCOUNTS', 'ACADEMICS', 'ADMIN_OFFICE', 'EXAMS')),
  roll_no     text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'STAFF') = (team IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS support_desk.tickets (
  id                serial PRIMARY KEY,
  student_id        integer NOT NULL REFERENCES support_desk.users(id),
  assignee_id       integer REFERENCES support_desk.users(id),
  category          text NOT NULL CHECK (category IN ('FEES', 'ATTENDANCE', 'ID_CARD', 'DOCUMENTS', 'CERTIFICATES', 'OTHER')),
  subject           text NOT NULL CHECK (length(subject) BETWEEN 5 AND 120),
  description       text NOT NULL CHECK (length(description) BETWEEN 10 AND 2000),
  priority          text NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
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
