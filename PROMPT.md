# Build prompt: Edumerge Assignment 4, Student Support & Ticket Management

Paste everything below the line into Claude Code (or Cursor), run from `~/Documents/mtb/edumerge-support-desk`.

---

You are a senior full-stack product engineer. Build and deploy a complete, polished, working prototype for a hiring assignment. There's a hard time box of about 4 hours, so favour a finished, well-tested core over breadth. Work in small verified steps. After each step, run the app or tests and fix failures before moving on. Don't ask me questions unless you're truly blocked. Make reasonable assumptions and record them in `docs/APPROACH.md`.

## 1. The assignment (verbatim)

> **Assignment 4: Student Support & Ticket Management.** Students raise requests related to fees, attendance, ID cards, documents, certificates, and other administrative matters. Staff need to own, prioritize, process, and resolve these requests. Design a ticket/support system with statuses, priorities, assignment, SLAs, ageing, ownership, resolution tracking, activity history, and management visibility. Decide escalation and pending-action workflows.

Evaluated on: problem understanding, product thinking and assumptions, technical decisions, solution quality and usability, edge cases and failure scenarios, creativity and practicality, AI usage and validation, and the ability to explain decisions.

## 2. Workspace

- The original assignment brief is `assignment/Pre-Drive_Product_Engineering_Assignments.pdf`. Read it first, especially page 6 (submission expectations, the AI Usage Report template, evaluation areas). It's the company's document, so add `assignment/` to `.gitignore` and never commit it.
- Work in `~/Documents/mtb/edumerge-support-desk`. It contains an earlier **Python draft** (`app/`, `tests/`, `requirements.txt`). First read `app/domain.py` and `app/services/sla.py`, because they hold the state machine and SLA rules to port. Then delete the Python files (`app/`, `tests/`, `requirements.txt`, `.gitignore`) and scaffold fresh. Keep `PROMPT.md`, `assignment/` and `docs/`.
- Git identity for this repo only: `git config user.name "Tharun Kumar"` and `git config user.email "tharunkumar10@gmail.com"`. Never use the global (work) identity.

## 3. Stack (fixed)

- **Next.js (latest, App Router, TypeScript, `src/` dir)** with Server Components and Server Actions. One app, deployed to **Vercel**.
- **Tailwind CSS** for styling. Clean, modern, responsive admin UI. Use `lucide-react` icons. No heavy component library.
- **Supabase Postgres** accessed directly with the `postgres` (postgres.js) driver: `ssl: 'require'`, `max: 1`, `prepare: false`. No ORM. Plain SQL in a small data layer.
- **Vitest** for tests.
- Use the Node version that's installed. Pin dependency versions in `package.json`.

## 4. Database credentials

- Take `DATABASE_URL` from `~/Documents/mtb/task-manager-api-tharun/.env` (Supabase session pooler, port 5432, SSL). Copy **only that value** into this project's `.env.local` as `DATABASE_URL`. Never print secret values in the terminal, logs, code, docs or commits.
- Create `.env.example` with the variable names only.
- `.gitignore` must include `.env*` (but not `.env.example`), `node_modules`, `.next`, `.vercel`.
- That Supabase database already has tables `"Users"` and `"Tasks"` in `public` for another app. **Don't touch `public`.** Put everything in a dedicated schema `support_desk` (`CREATE SCHEMA IF NOT EXISTS support_desk`) and fully qualify every table.
- Provide `db/schema.sql` (idempotent), `db/seed.ts`, and npm scripts `db:setup` (schema + seed) and `db:reset` (drop the `support_desk` schema only, then set it up again).

## 5. Product rules (source of truth; implement exactly)

**Roles:** `STUDENT`, `STAFF` (belongs to one team), `MANAGER`.
**Auth (prototype):** a login page lists demo users grouped by role, and clicking one sets an httpOnly signed cookie (sign with `SESSION_SECRET` env var). Every server action re-checks permissions on the server. Document "real auth, e.g. Supabase Auth or college SSO" as future work.

**Category → owning team → default priority:**

| Category | Team | Default priority |
|---|---|---|
| Fees | Accounts Office | Medium |
| Attendance | Academic Office | Medium |
| ID Card | Administration Office | Low |
| Documents | Administration Office | Medium |
| Certificates | Examination Cell | High |
| Other | Administration Office | Low |

Students **don't pick priority**, because everyone would pick Urgent. An optional "needed by" date within 2 days raises the priority to at least High. Staff and managers can change priority, and a reason is required.

**SLA (calendar hours), priority → first response / resolution:** Urgent 2h/24h, High 4h/48h, Medium 8h/72h, Low 24h/120h.
- First response = the first visible staff action (public comment, start, request info, resolve). Never paused.
- The resolution clock runs from `sla_start_at` (creation or last reopen). It **pauses while the ticket is Waiting on Student**, and paused time extends the due date.
- SLA state per clock: `on_track`, `at_risk` (under 25% of the window left), `breached`, `paused`, `met`, `missed`. Changing priority recalculates both due dates from their start times.

**Statuses and the only allowed transitions:**
- NEW → ASSIGNED, CANCELLED
- ASSIGNED → IN_PROGRESS, WAITING_ON_STUDENT, RESOLVED, NEW (owner deactivated), CANCELLED
- IN_PROGRESS → ASSIGNED (reassigned), WAITING_ON_STUDENT, RESOLVED, NEW
- WAITING_ON_STUDENT → IN_PROGRESS (student replied), NEW (replied but no owner), RESOLVED
- RESOLVED → CLOSED (confirmed or auto-closed), ASSIGNED / NEW (reopened)
- CLOSED, CANCELLED → nothing (terminal; the student raises a new ticket)

Implement this as one pure `transitions` table plus `assertTransition()`. Every action goes through it.

**Actions and permissions:**
- Student: create; view only their own tickets; comment (public only); reply while waiting (resumes the SLA and changes the status); cancel only when NEW or ASSIGNED; confirm (close) or reopen (a reason is required) when RESOLVED.
- Staff: view their team's tickets and tickets assigned to them; pick up unassigned tickets from their own team's queue; for tickets they own: start, request info (a public message is required; pauses the SLA), resolve (a resolution note is required), change priority, comment public or **internal** (never shown to students).
- Manager: view everything; assign or reassign to any active staff member; do everything staff can; deactivate or reactivate staff.
- **Auto-assign** on create and reopen: the active staff member in the owning team with the fewest open tickets (tie → lowest id). If there's none, the ticket stays NEW in the queue and managers get a notification.
- **Deactivating staff:** their open tickets are unassigned (ASSIGNED/IN_PROGRESS → NEW, WAITING keeps its status), each ticket is auto-assigned to another team member where possible, and managers are notified.
- **Duplicate guard:** if the student already has an open ticket in the same category, show a warning linking to it, with a "create anyway" option.
- **Optimistic locking:** tickets have a `version` column. Every mutating form sends the version it was rendered with, and a mismatch shows "This ticket was updated by someone else, reload" and changes nothing.

**Escalation and pending-action workflow.** There are no background workers on Vercel, so run an idempotent `runSlaSweep()` on page loads of the dashboard and "My work" pages, and add a Vercel Cron (`vercel.json`, every 15 min) hitting `/api/cron/sla-sweep` protected by `CRON_SECRET`:
- First-response breached and `escalation_level < 1` → set level 1, log an event, notify managers and the assignee.
- Resolution breached and `escalation_level < 2` → set level 2, log an event, notify managers and the assignee.
- Waiting on student for over 48h → send the student one reminder (only once per waiting period).
- Resolved for over 72h with no response → auto-close by the system.
- Running the sweep twice must change nothing the second time.

**Audit:** an append-only `ticket_events` table (actor or system, kind, from, to, note, timestamp) written by every action. It's shown as a timeline on the ticket page.

## 6. Data model (schema `support_desk`)

`users(id, name, email unique, role, team, roll_no, is_active, created_at)`
`tickets(id, student_id, assignee_id, category, subject, description, priority, status, needed_by, created_at, updated_at, first_response_at, resolved_at, closed_at, sla_start_at, response_due_at, resolution_due_at, paused_at, paused_seconds, escalation_level, reopen_count, resolution_note, version)`, with indexes on status, assignee_id, student_id and category
`comments(id, ticket_id, author_id, body, is_internal, created_at)`
`ticket_events(id, ticket_id, actor_id null, kind, from_value, to_value, note, created_at)`
`notifications(id, user_id, ticket_id, message, is_read, created_at)`

Use `CHECK` constraints for role, status, priority and category. Store timestamps as `timestamptz`, and display them in Asia/Kolkata. Ticket code format: `SR-00012`. Do multi-step writes (status + event + notification) in a **transaction**.

## 7. Screens

1. **/login:** demo user cards grouped by role, with a one-line explanation of each role.
2. **/ (My work), role-aware pending actions:**
   - Student: "Needs your reply", "Awaiting your confirmation", "Open requests", and a big "Raise a request" button.
   - Staff: "Overdue / at risk", "My open tickets" sorted by SLA urgency, "Unassigned in my team" with a Pick up button.
   - Manager: KPI tiles plus breached, escalated and unassigned lists.
3. **/tickets:** filterable list (status, category, priority, assignee, SLA state, text search), sortable, showing status badge, priority, SLA chip, age and assignee.
4. **/tickets/new:** the form, with validation messages and the duplicate warning.
5. **/tickets/[id]:** header (code, subject, status, priority), details panel, **SLA panel with two progress bars and time remaining**, an actions panel showing only the actions the current user may take, the conversation (internal notes visually distinct), and the activity timeline.
6. **/dashboard (manager):** open tickets by status and category, **age buckets** (<1d, 1–3d, 3–7d, >7d), response and resolution SLA compliance %, average first-response and resolution time, reopen rate, a staff workload table (open, breached, resolved in the last 7 days, average resolution hours), and created vs resolved over the last 14 days. Draw charts with plain SVG/CSS bars (no chart library).
7. **/team (manager):** staff list with workload, and deactivate/reactivate.
8. **Notifications:** a bell with an unread count and a list page.

Handle empty states, loading states and error messages everywhere. It must work on mobile width.

## 8. Seed data (realistic, deterministic)

- 1 manager (Dean of Student Affairs), 6 staff across the 4 teams (one team has only 1 person), 8 students with Indian names and roll numbers.
- About 35 tickets over the last 14 days, with realistic subjects per category (e.g. "Fee receipt for Semester 3 not generated", "Attendance marked absent on 12 Sep though present", "Lost ID card, need replacement", "Bonafide certificate for bank loan"). Generate them by **calling the real service functions with a mocked clock**, so events and SLA fields stay consistent.
- The mix must make the dashboard interesting: some on track, some at risk, some breached and escalated, some waiting on the student, resolved, closed, reopened, one cancelled, and a couple unassigned.

## 9. Architecture and code quality

- `src/lib/domain/`: pure logic with no DB (statuses and transitions, permissions, SLA calculation, priority rules). This is what the tests target.
- `src/lib/services/`: ticket actions, assignment, sweep and reports. Every mutation runs in a transaction and writes events.
- `src/lib/db.ts`: a single postgres.js client.
- `src/lib/clock.ts`: an injectable `now()` for tests and the seed.
- Server Actions validate input with **zod**. Domain errors (permission denied, invalid transition, stale version, validation) map to friendly UI messages.
- Keep files under about 300 lines. Keep comments minimal and only for why, not what.

## 10. Tests (Vitest), all must pass

Put pure domain tests first, and at least 20 cases, including:
- Every allowed transition passes, and illegal ones throw (CLOSED→IN_PROGRESS, NEW→RESOLVED, CANCELLED→anything).
- Permissions: a student can't view another student's ticket or post an internal note; staff can't pick up another team's ticket or act on a ticket they don't own; a manager can.
- SLA: on_track, at_risk, breached; the pause extends the due date by the exact paused duration; a priority change recalculates due dates; met vs missed.
- The priority rule: "needed by" within 2 days → at least High.
- Auto-assign picks the least-loaded active staff member, and returns null when the team has nobody active.
- The sweep is idempotent (a second run makes no changes); escalation levels 1 and 2; auto-close after 72h.
- Reopen: only from RESOLVED, only by the owning student; it gives a fresh resolution window and increments reopen_count.
- Optimistic locking: a stale version is rejected.

## 11. Documentation

- **README.md:** what it is, a live demo URL, screenshots, a demo login guide ("log in as X to see Y"), a 2-minute demo script, the tech stack, local setup (`npm i`, `.env.local`, `npm run db:setup`, `npm run dev`), `npm test`, and the project structure.
- **docs/APPROACH.md:** problem understanding; users and their pain points; **assumptions** (list at least 10); status diagram (Mermaid); SLA and escalation design and why; data model (Mermaid ER); architecture and **trade-offs** (calendar vs business hours, sweep on read plus cron instead of a queue, demo login, no attachments or email); edge cases handled and how they're validated; what I'd build next.
- **docs/AI_USAGE_REPORT.md:** fill in the assignment's exact template (AI tool used; what I asked AI to do, 1–3; the most useful prompt; code generated by AI; code I modified; AI output that was wrong; how I identified the problem; how I fixed it). **Keep a running log in `docs/ai-log.md` as you work.** Whenever you hit a real bug, wrong assumption, failing test or deployment error, record what went wrong, how it was detected and how it was fixed. Use only genuine entries from that log in the report, never invented ones. Leave clearly marked `TODO (Tharun):` spots for my personal review notes.
- Save 5 screenshots to `docs/screenshots/` (login, student My work, ticket detail with SLA and timeline, staff queue, manager dashboard) using Playwright against the running app, and embed them in the README.

## 12. Deploy

1. GitHub: make sure `gh` is using the **tharunkumar171717** account (`gh auth status`; switch with `gh auth switch -u tharunkumar171717`, or ask me to log in if it's missing). Create a **public** repo `edumerge-support-desk` under that account and push `main`. Verify there are no secrets with `git grep -nE "postgres(ql)?://|sb_secret|SESSION_SECRET="` before the first push.
2. Vercel: confirm with `vercel whoami` that it's the account for tharunkumar10@gmail.com (if not, stop and ask me to run `vercel login`). Link the project, add the env vars `DATABASE_URL`, `SESSION_SECRET` and `CRON_SECRET` to Production and Preview with `vercel env add` (read values from `.env.local` without echoing them), deploy with `vercel --prod`, and connect the GitHub repo so pushes redeploy.
3. Smoke-test the production URL: log in as each role, raise a ticket as a student, resolve it as staff, and check the dashboard loads. Put the live URL in the README.

## 13. Definition of done (check each before you say it's finished)

- [ ] `npm run build`, `npm run lint` and `npm test` all pass with no errors.
- [ ] The full flow works locally and on the Vercel URL for all three roles.
- [ ] A student can never see another student's ticket or any internal note (verified by a test and manually).
- [ ] No secret is in git history, code, docs or logs.
- [ ] README, APPROACH and AI_USAGE_REPORT are complete, and screenshots are embedded.
- [ ] Finish with a short summary: the live URL, the repo URL, the test count, what was cut, and the remaining `TODO (Tharun):` items.
