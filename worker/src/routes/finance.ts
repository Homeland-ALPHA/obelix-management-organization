/** Financial aggregates, chart series, rent roll and CSV reports. */
import { Hono } from "hono";
import type { AppEnv, Dict, Env, User } from "../types";
import { ApiError, rowsData } from "../lib/db";
import { csvResponse, f, lastMonths, round2, todayISO } from "../lib/util";
import { listRecords } from "./entities";

const finance = new Hono<AppEnv>();

const OPEX_EXCLUDED = new Set(["mortgage_interest", "capital_improvements"]); // excluded from NOI opex

const month = (d: unknown) => String(d ?? "").slice(0, 7);

/**
 * null means "every building the user owns" (portfolio); otherwise a single
 * verified building id. Mirrors _building_ids in the FastAPI backend.
 */
export async function resolveScope(env: Env, userId: string, buildingId?: string): Promise<string[] | null> {
  if (buildingId && buildingId !== "portfolio") {
    const b = await env.DB.prepare("SELECT id FROM buildings WHERE id = ? AND user_id = ?")
      .bind(buildingId, userId)
      .first();
    if (!b) throw new ApiError(404, "Building not found");
    return [buildingId];
  }
  return null;
}

export async function docs(env: Env, userId: string, entity: string, scope: string[] | null): Promise<Dict[]> {
  return listRecords(env, userId, entity, scope ? scope[0] : null, 5000);
}

async function buildingLabels(env: Env, userId: string): Promise<Record<string, string>> {
  const rs = await env.DB.prepare("SELECT id, data FROM buildings WHERE user_id = ? LIMIT 200")
    .bind(userId)
    .all();
  return Object.fromEntries(
    ((rs.results ?? []) as Dict[]).map((r) => [r.id, JSON.parse(r.data as string).label ?? ""]),
  );
}

const AGING_BUCKETS: [string, string][] = [
  ["current", "Current"],
  ["d1_30", "1 – 30 days"],
  ["d31_60", "31 – 60 days"],
  ["d61_90", "61 – 90 days"],
  ["d90_plus", "90+ days — housing court"],
];

/**
 * Split billed revenue into current vs. overdue balances by age.
 *
 * Anything received is current by definition; an unpaid balance ages from the
 * date it was billed, so the buckets always sum back to total billed.
 */
function aging(revenue: Dict[]): Dict {
  const today = new Date(`${todayISO()}T00:00:00Z`).getTime();
  const totals: Record<string, number> = Object.fromEntries(AGING_BUCKETS.map(([k]) => [k, 0]));
  for (const r of revenue) {
    const expected = f(r.expected);
    const received = f(r.received);
    totals.current += expected ? Math.min(received, expected) : received;
    const balance = Math.max(expected - received, 0);
    if (balance <= 0) continue;
    let days = 0;
    const billed = Date.parse(`${String(r.date ?? "").slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(billed)) days = Math.floor((today - billed) / 86_400_000);
    if (days <= 0) totals.current += balance;
    else if (days <= 30) totals.d1_30 += balance;
    else if (days <= 60) totals.d31_60 += balance;
    else if (days <= 90) totals.d61_90 += balance;
    else totals.d90_plus += balance;
  }

  const grand = Object.values(totals).reduce((a, b) => a + b, 0);
  return {
    total: round2(grand),
    buckets: AGING_BUCKETS.map(([key, label]) => ({
      key,
      label,
      amount: round2(totals[key]),
      pct: grand ? Math.round((totals[key] / grand) * 1000) / 10 : 0,
      overdue: key !== "current",
    })),
  };
}

/** Highest monthly NOI across the portfolio, for the leader callout. */
async function noiLeader(env: Env, userId: string, labels: Record<string, string>): Promise<Dict | null> {
  const thisMonth = todayISO().slice(0, 7);
  const revenue = await docs(env, userId, "revenue", null);
  const expenses = await docs(env, userId, "expenses", null);

  let best: Dict | null = null;
  for (const [id, label] of Object.entries(labels)) {
    const rev = revenue
      .filter((r) => r.building_id === id && month(r.date) === thisMonth)
      .reduce((a, r) => a + f(r.received), 0);
    const opex = expenses
      .filter((e) => e.building_id === id && month(e.invoice_date) === thisMonth && !OPEX_EXCLUDED.has(e.category))
      .reduce((a, e) => a + f(e.amount), 0);
    if (!rev && !opex) continue;
    const noi = rev - opex;
    if (best === null || noi > best.noi) best = { building_id: id, label, noi: round2(noi) };
  }
  return best;
}

export async function financialSummary(env: Env, user: User, buildingId: string): Promise<Dict> {
  const scope = await resolveScope(env, user.id, buildingId);
  const units = await docs(env, user.id, "units", scope);
  const tenants = await docs(env, user.id, "tenants", scope);
  const revenue = await docs(env, user.id, "revenue", scope);
  const expenses = await docs(env, user.id, "expenses", scope);
  const loans = await docs(env, user.id, "loans", scope);

  const thisMonth = todayISO().slice(0, 7);
  const yearStart = `${todayISO().slice(0, 4)}-01`;
  const t12Start = month(new Date(Date.now() - 365 * 86_400_000).toISOString());

  const gpr = tenants.reduce((a, t) => a + f(t.current_rent), 0);
  const collectedMonth = revenue.filter((r) => month(r.date) === thisMonth).reduce((a, r) => a + f(r.received), 0);
  const expectedMonth =
    revenue.filter((r) => month(r.date) === thisMonth).reduce((a, r) => a + f(r.expected), 0) || gpr;
  const arrears = revenue.reduce((a, r) => a + Math.max(f(r.expected) - f(r.received), 0), 0);

  const opexMonth = expenses
    .filter((e) => month(e.invoice_date) === thisMonth && !OPEX_EXCLUDED.has(e.category))
    .reduce((a, e) => a + f(e.amount), 0);
  const opexT12 = expenses
    .filter((e) => month(e.invoice_date) >= t12Start && !OPEX_EXCLUDED.has(e.category))
    .reduce((a, e) => a + f(e.amount), 0);
  const revT12 = revenue.filter((r) => month(r.date) >= t12Start).reduce((a, r) => a + f(r.received), 0);
  const capexYtd = expenses
    .filter((e) => e.category === "capital_improvements" && month(e.invoice_date) >= yearStart)
    .reduce((a, e) => a + f(e.amount), 0);

  const debtMonthly = loans.reduce((a, l) => a + f(l.monthly_payment), 0);
  const debtBalance = loans.reduce((a, l) => a + f(l.balance), 0);
  const paymentDates = loans.map((l) => l.next_payment_date).filter((d) => d);
  const nextPayment = paymentDates.length ? paymentDates.sort()[0] : null;

  const noiMonth = collectedMonth - opexMonth;
  const noiT12 = revT12 - opexT12;
  const dscr = debtMonthly ? round2(noiT12 / (debtMonthly * 12)) : null;

  const occupied = new Set(tenants.filter((t) => t.unit_id).map((t) => t.unit_id)).size;
  const totalUnits = units.length;

  let leader: Dict | null = null;
  if (buildingId === "portfolio" || !buildingId) {
    const labels = await buildingLabels(env, user.id);
    if (Object.keys(labels).length > 1) leader = await noiLeader(env, user.id, labels);
  }

  const ecount = revenue.length + expenses.length;
  return {
    has_data: Boolean(units.length || tenants.length || ecount),
    aging: aging(revenue),
    noi_leader: leader,
    units: totalUnits,
    occupied,
    occupancy: totalUnits ? Math.round((occupied / totalUnits) * 1000) / 10 : null,
    gpr: gpr || null,
    expected_month: expectedMonth || null,
    collected_month: collectedMonth,
    collection_rate: expectedMonth ? Math.round((collectedMonth / expectedMonth) * 1000) / 10 : null,
    arrears,
    opex_month: opexMonth,
    capex_ytd: capexYtd,
    debt_monthly: debtMonthly || null,
    debt_balance: debtBalance || null,
    next_payment: nextPayment,
    noi_month: collectedMonth || opexMonth ? noiMonth : null,
    cash_flow_month: (collectedMonth || opexMonth) && debtMonthly ? noiMonth - debtMonthly : null,
    dscr,
    cash_balance: null, // banking not connected
  };
}

finance.get("/financials/summary", async (c) => {
  const buildingId = c.req.query("building_id") ?? "portfolio";
  return c.json(await financialSummary(c.env, c.get("user"), buildingId));
});

finance.get("/financials/series", async (c) => {
  const user = c.get("user");
  const buildingId = c.req.query("building_id") ?? "portfolio";
  const granularity = c.req.query("granularity") ?? "month"; // month | year
  const months = Math.min(parseInt(c.req.query("months") ?? "12", 10) || 12, 600);

  const scope = await resolveScope(c.env, user.id, buildingId);
  const tenants = await docs(c.env, user.id, "tenants", scope);
  const revenue = await docs(c.env, user.id, "revenue", scope);
  const expenses = await docs(c.env, user.id, "expenses", scope);
  const budgets = await docs(c.env, user.id, "budgets", scope);

  const gpr = tenants.reduce((a, t) => a + f(t.current_rent), 0);
  const budgetByYear: Record<string, number> = {};
  for (const b of budgets) {
    for (const line of b.lines || []) {
      if (line.kind === "expense") {
        const y = String(b.year ?? "");
        budgetByYear[y] = (budgetByYear[y] || 0) + f(line.annual);
      }
    }
  }

  const revBy: Record<string, { expected: number; actual: number }> = {};
  for (const r of revenue) {
    const k = month(r.date);
    if (k) {
      revBy[k] ??= { expected: 0, actual: 0 };
      revBy[k].expected += f(r.expected);
      revBy[k].actual += f(r.received);
    }
  }
  const expBy: Record<string, number> = {};
  for (const e of expenses) {
    const k = month(e.invoice_date);
    if (k) expBy[k] = (expBy[k] || 0) + f(e.amount);
  }

  const out: Dict[] = [];
  if (granularity === "year") {
    const years = [
      ...new Set([
        ...Object.keys(revBy).map((k) => k.slice(0, 4)),
        ...Object.keys(expBy).map((k) => k.slice(0, 4)),
        ...Object.keys(budgetByYear),
      ]),
    ]
      .filter((y) => y)
      .sort();
    for (const y of years) {
      const actualRev = Object.entries(revBy)
        .filter(([k]) => k.slice(0, 4) === y)
        .reduce((a, [, v]) => a + v.actual, 0);
      const expectedRev =
        Object.entries(revBy)
          .filter(([k]) => k.slice(0, 4) === y)
          .reduce((a, [, v]) => a + v.expected, 0) || (gpr ? gpr * 12 : 0);
      const actualExp = Object.entries(expBy)
        .filter(([k]) => k.slice(0, 4) === y)
        .reduce((a, [, v]) => a + v, 0);
      out.push({
        period: y,
        expected_revenue: Math.round(expectedRev),
        actual_revenue: Math.round(actualRev),
        expected_expenses: Math.round(budgetByYear[y] || 0),
        actual_expenses: Math.round(actualExp),
        noi: Math.round(actualRev - actualExp),
      });
    }
  } else {
    const keys = lastMonths(Math.min(months, 240));
    for (const k of keys) {
      const rv = revBy[k] ?? { expected: 0, actual: 0 };
      const expectedRev = rv.expected || gpr;
      const actualExp = expBy[k] || 0;
      const budgetMonth = (budgetByYear[k.slice(0, 4)] || 0) / 12;
      out.push({
        period: k,
        expected_revenue: Math.round(expectedRev),
        actual_revenue: Math.round(rv.actual),
        expected_expenses: Math.round(budgetMonth),
        actual_expenses: Math.round(actualExp),
        noi: Math.round(rv.actual - actualExp),
      });
    }
  }
  return c.json({ series: out, has_data: Boolean(revenue.length || expenses.length || tenants.length) });
});

export async function rentRollRows(env: Env, user: User, buildingId: string): Promise<Dict[]> {
  const scope = await resolveScope(env, user.id, buildingId);
  const units = await docs(env, user.id, "units", scope);
  const tenants = await docs(env, user.id, "tenants", scope);
  const revenue = await docs(env, user.id, "revenue", scope);

  const byTenant: Record<string, { balance: number; last_payment: string | null }> = {};
  for (const r of revenue) {
    const tid = r.tenant_id;
    if (!tid) continue;
    byTenant[tid] ??= { balance: 0, last_payment: null };
    byTenant[tid].balance += Math.max(f(r.expected) - f(r.received), 0);
    if (f(r.received) > 0) {
      const d = r.date;
      if (d && (byTenant[tid].last_payment || "") < d) byTenant[tid].last_payment = d;
    }
  }

  const tenantByUnit: Record<string, Dict> = {};
  for (const t of tenants) {
    if (t.unit_id) tenantByUnit[t.unit_id] = t;
  }

  const tenantFields = (t: Dict | null): Dict => ({
    tenant_id: t ? t.id : null,
    tenant: t ? (t.name ?? null) : null,
    lease_start: t ? (t.lease_start ?? null) : null,
    lease_end: t ? (t.lease_end ?? null) : null,
    legal_rent: t ? (t.legal_rent ?? null) : null,
    preferential_rent: t ? (t.preferential_rent ?? null) : null,
    current_rent: t ? (t.current_rent ?? null) : null,
    subsidy_amount: t ? (t.subsidy_amount ?? null) : null,
    tenant_portion: t ? (t.tenant_portion ?? null) : null,
    deposit: t ? (t.deposit ?? null) : null,
    stabilized: t ? (t.stabilized ?? null) : null,
    renewal_status: t ? (t.renewal_status ?? null) : null,
  });

  const rows: Dict[] = [];
  for (const u of [...units].sort((a, b) => String(a.number ?? "").localeCompare(String(b.number ?? "")))) {
    const t = tenantByUnit[u.id] ?? null;
    const bal = t ? byTenant[t.id] : undefined;
    rows.push({
      unit_id: u.id,
      unit: u.number ?? null,
      status: t ? "Occupied" : "Vacant",
      ...tenantFields(t),
      balance: bal ? round2(bal.balance) : 0,
      last_payment: bal ? bal.last_payment : null,
    });
  }
  // tenants with no unit assigned still appear
  for (const t of tenants) {
    if (!t.unit_id) {
      const bal = byTenant[t.id];
      rows.push({
        unit_id: null,
        unit: "—",
        status: "Occupied",
        ...tenantFields(t),
        balance: bal ? round2(bal.balance) : 0,
        last_payment: bal ? bal.last_payment : null,
      });
    }
  }
  return rows;
}

finance.get("/rentroll", async (c) => {
  const buildingId = c.req.query("building_id");
  if (!buildingId) return c.json({ detail: "building_id is required" }, 422);
  return c.json({ rows: await rentRollRows(c.env, c.get("user"), buildingId) });
});

// --------------------------------------------------------------- CSV reports
finance.get("/reports/:kind", async (c) => {
  const user = c.get("user");
  const kind = c.req.param("kind");
  const buildingId = c.req.query("building_id") ?? "portfolio";
  const scope = await resolveScope(c.env, user.id, buildingId);
  const labels = await buildingLabels(c.env, user.id);
  const ids = scope ?? Object.keys(labels);
  const bname = (i: string | null | undefined) => (i ? (labels[i] ?? "") : "");

  if (kind === "rent_roll") {
    const rows = ids.length ? await rentRollRows(c.env, user, buildingId) : [];
    return csvResponse(
      ["Unit", "Tenant", "Status", "Lease start", "Lease end", "Legal rent", "Current rent", "Subsidy", "Balance", "Last payment"],
      rows.map((r) => [
        r.unit, r.tenant || "", r.status, r.lease_start || "", r.lease_end || "",
        r.legal_rent || "", r.current_rent || "", r.subsidy_amount || "",
        r.balance, r.last_payment || "",
      ]),
      "rent_roll.csv",
    );
  }

  if (kind === "arrears") {
    const rows: unknown[][] = [];
    for (const bid of ids) {
      for (const r of await rentRollRows(c.env, user, bid)) {
        if (f(r.balance) > 0) rows.push([bname(bid), r.unit, r.tenant || "", r.balance, r.last_payment || ""]);
      }
    }
    return csvResponse(["Building", "Unit", "Tenant", "Balance due", "Last payment"], rows, "arrears.csv");
  }

  if (kind === "income_expense") {
    const revenue = await docs(c.env, user.id, "revenue", scope);
    const expenses = await docs(c.env, user.id, "expenses", scope);
    const rows = [
      ...revenue.map((r) => [
        r.date || "", bname(r.building_id), "Revenue", r.category || "", r.expected || "", r.received || "",
      ]),
      ...expenses.map((e) => [
        e.invoice_date || "", bname(e.building_id), "Expense", e.category || "", "", e.amount || "",
      ]),
    ].sort((a, b) => (String(a[0]) < String(b[0]) ? 1 : String(a[0]) > String(b[0]) ? -1 : 0));
    return csvResponse(["Date", "Building", "Type", "Category", "Expected", "Amount"], rows, "income_expense.csv");
  }

  if (kind === "work_orders") {
    const wos = await docs(c.env, user.id, "work_orders", scope);
    return csvResponse(
      ["Created", "Building", "Title", "Priority", "Status", "Assignee", "Est. cost", "Final cost"],
      wos.map((w) => [
        String(w.created_at ?? "").slice(0, 10), bname(w.building_id), w.title || "", w.priority || "",
        w.status || "", w.assignee || "", w.est_cost || "", w.final_cost || "",
      ]),
      "work_orders.csv",
    );
  }

  if (kind === "violations") {
    const rows: unknown[][] = [];
    for (const bid of ids) {
      const rs = await c.env.DB.prepare(
        "SELECT data FROM nyc_data WHERE building_id = ? AND key IN ('hpd_violations', 'dob_violations', 'ecb_violations')",
      )
        .bind(bid)
        .all();
      for (const d of rowsData(rs)) {
        for (const it of d.items ?? []) {
          rows.push([bname(bid), d.label, it.date || "", it.title || "", it.badge || "", (it.extra || {}).class || ""]);
        }
      }
    }
    rows.sort((a, b) => (String(a[2]) < String(b[2]) ? 1 : String(a[2]) > String(b[2]) ? -1 : 0));
    return csvResponse(["Building", "Source", "Date", "Description", "Status", "Class"], rows, "violations.csv");
  }

  if (kind === "mortgage") {
    const loans = await docs(c.env, user.id, "loans", scope);
    return csvResponse(
      ["Building", "Lender", "Balance", "Rate", "Monthly payment", "Maturity", "Next payment"],
      loans.map((l) => [
        bname(l.building_id), l.lender || "", l.balance || "", l.rate || "",
        l.monthly_payment || "", l.maturity_date || "", l.next_payment_date || "",
      ]),
      "mortgage.csv",
    );
  }

  return c.json({ detail: "Unknown report" }, 404);
});

export default finance;
