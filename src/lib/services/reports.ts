import { Op } from "sequelize";
import { models } from "@/lib/db";
import { isOpen, STATUS_LABELS } from "@/lib/domain/config";
import { campusDate } from "@/lib/domain/priority";
import { isBreached, resolutionClock, responseClock } from "@/lib/domain/sla";
import { STATUSES, type Ticket } from "@/lib/domain/types";
import { getCatalog } from "./catalog";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (num: number, den: number) => (den ? Math.round((num / den) * 100) : null);

export interface StaffRow { id: number; name: string; team: string; teamLabel: string; isActive: boolean; open: number; breached: number; resolved7d: number; avgResolutionHours: number | null }

/** Management view computed from live ticket state, so it always agrees with what staff see. */
export async function dashboardReport(now: Date) {
  const { TicketModel, UserModel, TicketEventModel } = models();
  const [catalog, ticketRows, staff, resolvedEvents] = await Promise.all([
    getCatalog(),
    TicketModel.findAll(),
    UserModel.findAll({ where: { role: "STAFF" }, attributes: ["id", "name", "team", "isActive"], order: [["team", "ASC"], ["name", "ASC"]] }),
    TicketEventModel.findAll({
      where: { kind: "status_changed", toValue: "Resolved", createdAt: { [Op.gt]: new Date(now.getTime() - 15 * DAY) } },
      attributes: ["createdAt"],
    }),
  ]);
  const tickets = ticketRows.map((t) => t.get({ plain: true }) as Ticket);

  const open = tickets.filter((t) => isOpen(t.status));
  const byStatus = STATUSES.filter((s) => isOpen(s)).map((s) => ({
    label: STATUS_LABELS[s],
    key: s,
    value: open.filter((t) => t.status === s).length,
  }));
  const byCategory = catalog.categories
    .map((c) => ({ label: c.label, key: c.code, value: open.filter((t) => t.category === c.code).length }))
    // A retired category only shows while it still has open work.
    .filter((row, i) => catalog.categories[i].isActive || row.value > 0);

  const age = (t: Ticket) => now.getTime() - t.createdAt.getTime();
  const ageBuckets = [
    { label: "< 1 day", value: open.filter((t) => age(t) < DAY).length },
    { label: "1–3 days", value: open.filter((t) => age(t) >= DAY && age(t) < 3 * DAY).length },
    { label: "3–7 days", value: open.filter((t) => age(t) >= 3 * DAY && age(t) < 7 * DAY).length },
    { label: "> 7 days", value: open.filter((t) => age(t) >= 7 * DAY).length },
  ];

  const live = tickets.filter((t) => t.status !== "CANCELLED");
  const resp = live.map((t) => responseClock(t, now).state);
  const respMet = resp.filter((s) => s === "met").length;
  const respMissed = resp.filter((s) => s === "missed" || s === "breached").length;
  const reso = live.map((t) => resolutionClock(t, now).state);
  const resoMet = reso.filter((s) => s === "met").length;
  const resoMissed = reso.filter((s) => s === "missed" || s === "breached").length;

  const firstResponseHours = avg(
    live.filter((t) => t.firstResponseAt).map((t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / HOUR),
  );
  const resolved = live.filter((t) => t.resolvedAt);
  const resolutionHours = avg(resolved.map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / HOUR));
  const everResolved = live.filter((t) => t.resolvedAt || t.reopenCount > 0 || t.status === "CLOSED");
  const reopenRate = pct(everResolved.filter((t) => t.reopenCount > 0).length, everResolved.length);

  const weekAgo = now.getTime() - 7 * DAY;
  const staffRows: StaffRow[] = staff.map(({ id, name, team, isActive }) => ({ id, name, team: team ?? "", isActive })).map((s) => {
    const mine = tickets.filter((t) => t.assigneeId === s.id);
    const done = mine.filter((t) => t.resolvedAt);
    return {
      ...s,
      teamLabel: catalog.teamLabel(s.team),
      open: mine.filter((t) => isOpen(t.status)).length,
      breached: mine.filter((t) => isOpen(t.status) && isBreached(t, now)).length,
      resolved7d: done.filter((t) => t.resolvedAt!.getTime() > weekAgo).length,
      avgResolutionHours: avg(done.map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / HOUR)),
    };
  });

  const days = Array.from({ length: 14 }, (_, i) => campusDate(new Date(now.getTime() - (13 - i) * DAY)));
  const trend = days.map((day) => ({
    day,
    created: tickets.filter((t) => campusDate(t.createdAt) === day).length,
    resolved: resolvedEvents.filter((e) => campusDate(e.createdAt) === day).length,
  }));

  return {
    kpis: {
      open: open.length,
      breached: open.filter((t) => isBreached(t, now)).length,
      escalated: open.filter((t) => t.escalationLevel > 0).length,
      unassigned: open.filter((t) => t.assigneeId === null).length,
      responseCompliance: pct(respMet, respMet + respMissed),
      resolutionCompliance: pct(resoMet, resoMet + resoMissed),
      firstResponseHours,
      resolutionHours,
      reopenRate,
    },
    byStatus,
    byCategory,
    ageBuckets,
    staff: staffRows,
    trend,
  };
}

export type DashboardReport = Awaited<ReturnType<typeof dashboardReport>>;
