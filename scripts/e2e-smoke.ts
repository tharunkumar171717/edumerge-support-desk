/**
 * End-to-end smoke test against a running app (local or production):
 *   BASE_URL=http://localhost:3000 npx tsx scripts/e2e-smoke.ts [--screenshots]
 * Creates one ticket as a student, works it as staff, confirms it as the student,
 * checks privacy rules and optimistic locking, and loads the manager dashboard.
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.argv.includes("--screenshots");
const results: string[] = [];

function check(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  results.push(`ok  ${msg}`);
}

async function see(page: Page, text: string, opts: { exact?: boolean } | string, msg?: string) {
  const exact = typeof opts === "object" ? opts.exact : undefined;
  await page.getByText(text, { exact }).first().waitFor({ timeout: 30_000 });
  check(true, typeof opts === "string" ? opts : msg!);
}

async function loginAs(page: Page, name: string) {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForURL(`${BASE}/`);
}

async function shot(page: Page, file: string) {
  if (SHOTS) await page.screenshot({ path: `docs/screenshots/${file}`, fullPage: true });
}

async function openAction(page: Page, title: string) {
  await page.locator("summary", { hasText: title }).click();
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const stamp = Date.now().toString(36);

  await page.goto(`${BASE}/login`);
  await see(page, "Students", { exact: true }, "login page lists demo users by role");
  await shot(page, "01-login.png");

  // Student: duplicate guard, then create.
  await loginAs(page, "Aarav Sharma");
  await see(page, "Needs your reply", "student sees pending-action sections");
  await shot(page, "02-student-my-work.png");
  await page.goto(`${BASE}/tickets/new`);
  await page.selectOption("#category", "FEES");
  await page.fill("#subject", `Smoke test fee query ${stamp}`);
  await page.fill("#description", "Created by the automated smoke test. Safe to ignore.");
  await page.getByRole("button", { name: "Submit request" }).click();
  await page.getByText("You already have an open request in this category").waitFor();
  check(true, "duplicate guard warns about an open ticket in the same category");
  await page.getByRole("button", { name: /create anyway/ }).click();
  await page.waitForURL(/\/tickets\/\d+\?created=1/);
  const ticketId = Number(page.url().match(/tickets\/(\d+)/)![1]);
  check(ticketId > 0, `student created ticket #${ticketId} after confirming`);
  const owner = (await page.locator("dt:has-text('Owner') + dd").innerText()).trim();
  check(owner && owner !== "Unassigned", `auto-assigned to ${owner}`);

  // Privacy: another student's ticket is not visible.
  // Streaming means notFound() can arrive with HTTP 200, so assert on content.
  await page.goto(`${BASE}/tickets/19`);
  await page.getByText("Not found", { exact: true }).waitFor();
  check(!(await page.content()).includes("Attendance shortage warning"), "student can't open another student's ticket (Not found, no data leaked)");

  // Staff works the ticket.
  await loginAs(page, owner);
  await page.goto(`${BASE}/tickets/${ticketId}`);
  await page.getByRole("button", { name: "Start work" }).click();
  await page.getByText("Marked as in progress.").waitFor();
  // The message arrives with the action result; wait for the refreshed page (new version) to commit.
  await page.getByRole("button", { name: "Start work" }).waitFor({ state: "detached" });
  const secret = `Internal check ${stamp}: bank statement verified`;
  await page.fill("#composer", secret);
  await page.check("input[name=internal]");
  await page.getByRole("button", { name: "Post" }).click();
  await page.getByText("Message posted.").waitFor();
  await page.getByText(secret).waitFor();
  await openAction(page, "Resolve");
  await page.fill("details[open] textarea[name=body]", "Receipt regenerated during the smoke test.");
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await page.getByText("Ticket resolved.").waitFor();
  await page.getByText("Resolution:").waitFor();
  check(true, "staff started, added an internal note, and resolved");

  // Student cannot see the internal note, then confirms.
  await loginAs(page, "Aarav Sharma");
  await page.goto(`${BASE}/tickets/${ticketId}`);
  check(!(await page.content()).includes(secret), "internal note is hidden from the student");
  await page.getByRole("button", { name: /Close it/ }).click();
  await page.getByText("The ticket is closed.").waitFor();
  check(true, "student confirmed and closed the ticket");

  // Optimistic locking: two tabs as manager, act in one, the other goes stale.
  await loginAs(page, "Meera Krishnan");
  await see(page, "Today's attention list", "manager My work loads");
  const target = 26;
  const other = await ctx.newPage();
  await page.goto(`${BASE}/tickets/${target}`);
  await other.goto(`${BASE}/tickets/${target}`);
  await openAction(page, "Change priority");
  await page.selectOption("select[name=priority]", "HIGH");
  await page.fill("details[open] input[name=body]", "Library access blocked for exams");
  await page.getByRole("button", { name: "Update priority" }).click();
  await page.getByText("Priority updated").waitFor();
  await openAction(other, "Change priority");
  await other.selectOption("select[name=priority]", "URGENT");
  await other.fill("details[open] input[name=body]", "Second tab edit");
  await other.getByRole("button", { name: "Update priority" }).click();
  await other.getByText("updated by someone else").waitFor();
  check(true, "a stale second tab is rejected with the reload message");
  await other.close();

  await page.goto(`${BASE}/tickets/17`);
  await shot(page, "03-ticket-detail.png");
  await page.goto(`${BASE}/dashboard`);
  await see(page, "Staff workload", "manager dashboard loads");
  await shot(page, "05-manager-dashboard.png");
  await page.goto(`${BASE}/team`);
  await see(page, "Examination Cell", "team page loads");

  await loginAs(page, "Suresh Rao");
  await see(page, "Unassigned in my team", "staff sees the team queue");
  await shot(page, "04-staff-queue.png");

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await mobile.newPage();
  await m.goto(`${BASE}/login`);
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, "login fits a 390px phone without horizontal scroll");

  await browser.close();
  console.log(results.join("\n"));
  console.log(`\n${results.length} checks passed against ${BASE}`);
}

main().catch((e) => {
  console.log(results.join("\n"));
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
