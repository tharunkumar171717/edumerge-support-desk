import { setClock } from "../src/lib/clock";
import { sql } from "../src/lib/db";
import { campusDate } from "../src/lib/domain/priority";
import { runSlaSweep } from "../src/lib/services/sweep";
import { deactivateStaff, reactivateStaff } from "../src/lib/services/staff";
import * as svc from "../src/lib/services/tickets";
import { EXAMS_LEAVE, SCENARIOS, USERS, type Scenario, type Step } from "./scenarios";

const HOUR = 3_600_000;
const SWEEP_EVERY_HOURS = 2;

type Job = { at: number; order: number; run: () => Promise<unknown> };

/**
 * Replays ~2 weeks of activity through the real service functions with a mocked clock, so every
 * event, SLA field and escalation is exactly what the live app would have produced.
 */
export async function seed(): Promise<void> {
  const realNow = new Date();
  const at = (hoursAgo: number) => new Date(realNow.getTime() - hoursAgo * HOUR);

  await sql`TRUNCATE support_desk.notifications, support_desk.ticket_events, support_desk.comments,
                     support_desk.tickets, support_desk.users RESTART IDENTITY CASCADE`;
  const seedCreated = at(24 * 30);
  const ids = new Map<string, number>();
  for (const u of USERS) {
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO support_desk.users (name, email, role, team, roll_no, created_at)
      VALUES (${u.name}, ${u.email}, ${u.role}, ${u.team ?? null}, ${u.rollNo ?? null}, ${seedCreated})
      RETURNING id`;
    ids.set(u.name, row.id);
  }
  const id = (name: string) => ids.get(name)!;
  const managerId = id("Dr. Meera Krishnan");
  const ticketIds = new Map<Scenario, number>();

  const jobs: Job[] = [];
  SCENARIOS.forEach((sc, i) => {
    jobs.push({
      at: sc.created,
      order: i,
      run: async () => {
        const neededBy = sc.neededInDays != null ? campusDate(new Date(at(sc.created).getTime() + sc.neededInDays * 24 * HOUR)) : null;
        const res = await svc.createTicketFor(
          id(sc.student),
          { category: sc.category, subject: sc.subject, description: sc.description, neededBy },
          { createAnyway: true },
        );
        if (!res.ok) throw new Error("seed create failed");
        ticketIds.set(sc, res.id);
      },
    });
    sc.steps?.forEach((step, j) => jobs.push({ at: step.at, order: i + j / 100, run: () => runStep(sc, step) }));
  });
  jobs.push({ at: EXAMS_LEAVE.from, order: -1, run: () => deactivateStaff(managerId, id(EXAMS_LEAVE.who)) });
  jobs.push({ at: EXAMS_LEAVE.to, order: -1, run: () => reactivateStaff(managerId, id(EXAMS_LEAVE.who)) });
  const oldest = Math.max(...SCENARIOS.map((s) => s.created));
  for (let h = oldest; h > 0; h -= SWEEP_EVERY_HOURS) {
    jobs.push({ at: h - 0.5, order: 999, run: () => runSlaSweep(at(h - 0.5)) });
  }

  async function runStep(sc: Scenario, step: Step) {
    const tid = ticketIds.get(sc)!;
    const [t] = await sql<{ version: number; assigneeId: number | null; category: string }[]>`
      SELECT version, assignee_id, category FROM support_desk.tickets WHERE id = ${tid}`;
    const owner = t.assigneeId ?? managerId;
    const student = id(sc.student);
    switch (step.do) {
      case "start": return svc.startTicket(owner, tid, t.version);
      case "comment": return svc.commentOnTicket(owner, tid, t.version, step.text, false);
      case "internal": return svc.commentOnTicket(owner, tid, t.version, step.text, true);
      case "requestInfo": return svc.requestInfoOnTicket(owner, tid, t.version, step.text);
      case "reply": return svc.commentOnTicket(student, tid, t.version, step.text, false);
      case "resolve": return svc.resolveTicket(owner, tid, t.version, step.text);
      case "priority": return svc.changeTicketPriority(owner, tid, t.version, step.priority, step.text);
      case "close": return svc.closeTicket(student, tid, t.version);
      case "reopen": return svc.reopenTicket(student, tid, t.version, step.text);
      case "cancel": return svc.cancelTicket(student, tid, t.version, step.text);
      case "pickUp": return svc.pickUpTicket(id(step.by), tid, t.version);
      case "assign": {
        // Auto-assign may already have chosen the requested person; then move it to their teammate.
        const team = USERS.find((u) => u.name === step.to)!.team;
        const target = t.assigneeId === id(step.to) ? USERS.find((u) => u.team === team && u.name !== step.to)!.name : step.to;
        return svc.assignTicket(managerId, tid, t.version, id(target));
      }
    }
  }

  jobs.sort((a, b) => b.at - a.at || a.order - b.order);
  for (const job of jobs) {
    setClock(at(job.at));
    await job.run();
  }
  setClock(null);
  await runSlaSweep(realNow);

  // Older notifications would realistically have been seen already.
  await sql`UPDATE support_desk.notifications SET is_read = true WHERE created_at < ${at(24)}`;
  const [c] = await sql<{ tickets: number; events: number }[]>`
    SELECT (SELECT count(*)::int FROM support_desk.tickets) AS tickets,
           (SELECT count(*)::int FROM support_desk.ticket_events) AS events`;
  console.log(`Seeded ${USERS.length} users, ${c.tickets} tickets, ${c.events} events.`);
}
