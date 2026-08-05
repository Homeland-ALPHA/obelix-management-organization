/** Building command center, computed notification center, global search. */
import { Hono } from "hono";
import type { AppEnv, Dict, Env, User } from "../types";
import { rowsData } from "../lib/db";
import { addDaysISO, f, money0, todayISO } from "../lib/util";
import { listBuildings } from "./buildings";
import { listDocuments, listRecords } from "./entities";
import { financialSummary } from "./finance";

const overview = new Hono<AppEnv>();

const WO_DONE = new Set(["Completed", "Inspected", "Closed"]);

type Loaded = {
  tenants: Dict[];
  wos: Dict[];
  expenses: Dict[];
  loans: Dict[];
  vendors: Dict[];
  nyc: Dict[];
  balances: Record<string, number>;
};

async function loadAll(env: Env, user: User, single: string | null): Promise<Loaded> {
  const tenants = await listRecords(env, user.id, "tenants", single, 5000);
  const wos = await listRecords(env, user.id, "work_orders", single, 5000);
  const expenses = await listRecords(env, user.id, "expenses", single, 5000);
  const loans = await listRecords(env, user.id, "loans", single, 500);
  const revenue = await listRecords(env, user.id, "revenue", single, 5000);
  const vendors = await listRecords(env, user.id, "vendors", null, 1000);

  const nycStmt = single
    ? env.DB.prepare("SELECT building_id, data FROM nyc_data WHERE building_id = ? LIMIT 5000").bind(single)
    : env.DB.prepare(
        "SELECT n.building_id AS building_id, n.data AS data FROM nyc_data n " +
          "JOIN buildings b ON b.id = n.building_id WHERE b.user_id = ? LIMIT 5000",
      ).bind(user.id);
  const nycRs = await nycStmt.all();
  const nyc = ((nycRs.results ?? []) as Dict[]).map((r) => ({
    ...JSON.parse(r.data as string),
    building_id: r.building_id,
  }));

  const balances: Record<string, number> = {};
  for (const r of revenue) {
    if (r.tenant_id) {
      balances[r.tenant_id] = (balances[r.tenant_id] || 0) + Math.max(f(r.expected) - f(r.received), 0);
    }
  }
  return { tenants, wos, expenses, loans, vendors, nyc, balances };
}

/** Build the prioritized attention/notification list. */
function attention(buildings: Record<string, Dict>, loaded: Loaded): Dict[] {
  const { tenants, wos, expenses, loans, vendors, nyc, balances } = loaded;
  const today = todayISO();
  const soon14 = addDaysISO(14);
  const soon30 = addDaysISO(30);
  const soon90 = addDaysISO(90);
  const bname = (i: string | null | undefined) => (i && buildings[i] ? (buildings[i].label ?? "") : "");
  const items: Dict[] = [];

  const add = (
    key: string,
    priority: number, // 1 emergency, 2 overdue/urgent, 3 waiting, 4 upcoming
    title: string,
    sub: string,
    buildingId: string | null,
    due: string | null,
    status: string,
    tab: string,
    action: string,
  ) => {
    items.push({
      key, priority, title, sub,
      building_id: buildingId,
      building: bname(buildingId),
      due, status, tab, action,
    });
  };

  for (const w of wos) {
    if (WO_DONE.has(w.status)) continue;
    if (w.emergency || w.priority === "emergency") {
      add(`wo-em-${w.id}`, 1, `Emergency · ${w.title}`, `Assigned to ${w.assignee || "—"}`,
        w.building_id, w.target_date ?? null, w.status, "work-orders", "Dispatch and resolve now");
    } else if (w.target_date && w.target_date < today) {
      add(`wo-over-${w.id}`, 2, `Overdue work order · ${w.title}`, `Assigned to ${w.assignee || "—"}`,
        w.building_id, w.target_date, w.status, "work-orders", "Reschedule or reassign");
    } else if (w.status === "Approval Required") {
      add(`wo-appr-${w.id}`, 3, `Approval waiting · ${w.title}`,
        `Estimated $${money0(f(w.est_cost))} · ${w.assignee || "unassigned"}`,
        w.building_id, (w.approval || {}).deadline ?? null, "Awaiting Approval", "work-orders", "Approve or decline");
    }
  }

  for (const e of expenses) {
    if (e.approval_status === "pending") {
      add(`exp-appr-${e.id}`, 3, `Invoice awaiting approval · ${String(e.category || "").replace(/_/g, " ")}`,
        `$${money0(f(e.amount))}`, e.building_id, e.due_date ?? null, "Awaiting Approval",
        "financials", "Approve or decline");
    } else if (e.status === "unpaid" && e.due_date && e.due_date < today) {
      add(`exp-over-${e.id}`, 2, `Unpaid vendor invoice · ${String(e.category || "").replace(/_/g, " ")}`,
        `$${money0(f(e.amount))}`, e.building_id, e.due_date, "Overdue", "financials", "Pay or dispute");
    }
  }

  for (const t of tenants) {
    const bal = balances[t.id] || 0;
    if (bal > 0) {
      add(`arrears-${t.id}`, 2, `Unpaid rent · ${t.name}`, `Balance $${money0(bal)}`,
        t.building_id, null, "Overdue", "rent-roll", "Send arrears notice");
    }
    const le = t.lease_end;
    if (le && today <= le && le <= soon90) {
      add(`lease-${t.id}`, 4, `Lease expiring · ${t.name}`, `Ends ${le}`,
        t.building_id, le, "Scheduled", "tenants", "Start renewal");
    }
  }

  for (const l of loans) {
    const np = l.next_payment_date;
    if (np && np <= soon14) {
      const overdue = np < today;
      add(`loan-${l.id}`, overdue ? 2 : 4, `Mortgage payment · ${l.lender}`,
        `$${money0(f(l.monthly_payment))} due ${np}`, l.building_id, np,
        overdue ? "Overdue" : "Scheduled", "financials", "Record payment");
    }
  }

  for (const v of vendors) {
    for (const [fld, label] of [["insurance_exp", "Insurance"], ["license_exp", "License"]] as const) {
      const d = v[fld];
      if (d && d <= soon30) {
        add(`vendor-${fld}-${v.id}`, d < today ? 2 : 4, `${label} expiring · ${v.name}`,
          `${d < today ? "Expired" : "Expires"} ${d}`, null, d,
          d < today ? "Overdue" : "Scheduled", "vendors", "Request updated certificate");
      }
    }
  }

  for (const row of nyc) {
    const bid = row.building_id;
    if (row.key === "hpd_violations") {
      for (const it of row.items ?? []) {
        const e = it.extra || {};
        if (e.open && (e.class === "C" || e.class === "I")) {
          const overdue = Boolean(e.correct_by && e.correct_by < today);
          add(`viol-${it.id}`, 2, `Class ${e.class} violation · ${String(it.title).slice(0, 90)}`,
            `Correct by ${e.correct_by || "—"}`, bid, e.correct_by ?? null,
            overdue ? "Overdue" : "Urgent", "compliance", "Create work order and certify");
        }
      }
    }
    if (row.key === "ecb_violations") {
      for (const it of row.items ?? []) {
        const e = it.extra || {};
        if (e.open && e.hearing_date && today <= e.hearing_date && e.hearing_date <= soon30) {
          add(`hearing-${it.id}`, 4, `OATH hearing · ${String(it.title).slice(0, 90)}`, `Hearing ${e.hearing_date}`,
            bid, e.hearing_date, "Scheduled", "compliance", "Prepare hearing response");
        }
      }
    }
    if (row.error) {
      add(`sync-${bid}-${row.key}`, 3, `Data sync issue · ${row.label}`, String(row.error).slice(0, 120),
        bid, null, "Awaiting Review", "compliance", "Refresh the source");
    }
  }

  for (const b of Object.values(buildings)) {
    const s = b.summary || {};
    if (b.hpd_building_id && !s.registration_current) {
      add(`reg-${b.id}`, 2, "HPD registration lapsed", `Expired ${s.registration_end || "—"}`,
        b.id, null, "Overdue", "compliance", "Refile registration");
    }
    if (s.boiler_due && s.boiler_due < today) {
      add(`boiler-${b.id}`, 2, "Annual boiler inspection overdue", `Was due ${s.boiler_due}`,
        b.id, s.boiler_due, "Overdue", "compliance", "Schedule inspection");
    }
  }

  items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const da = a.due || "9999";
    const db = b.due || "9999";
    return da < db ? -1 : da > db ? 1 : 0;
  });
  return items;
}

overview.get("/overview", async (c) => {
  const user = c.get("user");
  const buildingId = c.req.query("building_id") ?? "portfolio";

  const blist = await listBuildings(c.env, user.id);
  const buildings: Record<string, Dict> = Object.fromEntries(blist.map((b) => [b.id, b]));
  const isSingle = buildingId !== "portfolio" && buildingId in buildings;
  const ids = isSingle ? [buildingId] : Object.keys(buildings);

  const loaded = await loadAll(c.env, user, isSingle ? buildingId : null);
  const fin = await financialSummary(c.env, user, isSingle ? buildingId : "portfolio");
  let att = attention(buildings, loaded);
  if (buildingId !== "portfolio") {
    att = att.filter((a) => a.building_id === buildingId || a.building_id === null);
  }

  const actStmt = isSingle
    ? c.env.DB.prepare(
        "SELECT data FROM activity WHERE user_id = ? AND building_id = ? ORDER BY at DESC LIMIT 20",
      ).bind(user.id, buildingId)
    : c.env.DB.prepare("SELECT data FROM activity WHERE user_id = ? ORDER BY at DESC LIMIT 20").bind(user.id);
  const activity = rowsData(await actStmt.all());

  const inScope = (i: string) => ids.includes(i);
  const hpdOpen = Object.entries(buildings)
    .filter(([i]) => inScope(i))
    .reduce((a, [, b]) => a + ((b.summary || {}).hpd_open || 0), 0);
  const hpdTotal = Object.entries(buildings)
    .filter(([i]) => inScope(i))
    .reduce((a, [, b]) => a + ((b.summary || {}).hpd_total || 0), 0);
  const emergencies = loaded.wos.filter(
    (w) => (w.emergency || w.priority === "emergency") && !WO_DONE.has(w.status),
  ).length;
  const approvals =
    loaded.wos.filter((w) => w.status === "Approval Required").length +
    loaded.expenses.filter((e) => e.approval_status === "pending").length;

  let dof: Dict;
  if (buildingId !== "portfolio") {
    const b = buildings[buildingId] || {};
    const s = b.summary || {};
    const valRow = loaded.nyc.find((r) => r.building_id === buildingId && r.key === "valuation");
    let year: string | null = null;
    if (valRow && valRow.items?.length) year = (valRow.items[0].extra || {}).year ?? null;
    dof = {
      value: s.market_value ?? null,
      assessed: s.assessed_value ?? null,
      tax_year: year,
      synced_at: b.last_synced ?? null,
      source: "NYC DOF assessment roll",
    };
  } else {
    const total = Object.values(buildings).reduce((a, b) => a + ((b.summary || {}).market_value || 0), 0);
    const synced = Object.values(buildings).reduce<string>(
      (acc, b) => ((b.last_synced || "") > acc ? b.last_synced : acc),
      "",
    );
    dof = {
      value: total || null,
      assessed: null,
      tax_year: null,
      synced_at: synced || null,
      source: "NYC DOF assessment roll",
    };
  }

  return c.json({
    mode: buildingId === "portfolio" ? "portfolio" : "building",
    buildings_count: ids.length,
    financial: fin,
    hpd_open: hpdOpen,
    hpd_cleared: Math.max(hpdTotal - hpdOpen, 0),
    emergencies,
    approvals_waiting: approvals,
    dof,
    attention: att.slice(0, 25),
    attention_total: att.length,
    activity,
  });
});

async function currentNotifications(env: Env, user: User): Promise<Dict[]> {
  const blist = await listBuildings(env, user.id);
  const buildings: Record<string, Dict> = Object.fromEntries(blist.map((b) => [b.id, b]));
  const loaded = await loadAll(env, user, null);
  return attention(buildings, loaded);
}

overview.get("/notifications", async (c) => {
  const user = c.get("user");
  const items = await currentNotifications(c.env, user);
  const rs = await c.env.DB.prepare("SELECT key FROM dismissed WHERE user_id = ?").bind(user.id).all();
  const dismissed = new Set(((rs.results ?? []) as Dict[]).map((r) => r.key));
  for (const it of items) it.read = dismissed.has(it.key);
  const unread = items.filter((i) => !i.read).length;
  return c.json({ items: items.slice(0, 50), unread });
});

overview.post("/notifications/dismiss", async (c) => {
  const user = c.get("user");
  const payload = (await c.req.json().catch(() => ({}))) as Dict;
  if (payload.key) {
    await c.env.DB.prepare("INSERT OR IGNORE INTO dismissed (user_id, key) VALUES (?, ?)")
      .bind(user.id, String(payload.key))
      .run();
  }
  return c.json({ ok: true });
});

overview.post("/notifications/dismiss-all", async (c) => {
  const user = c.get("user");
  const items = await currentNotifications(c.env, user);
  if (items.length) {
    await c.env.DB.batch(
      items.map((it) =>
        c.env.DB.prepare("INSERT OR IGNORE INTO dismissed (user_id, key) VALUES (?, ?)").bind(user.id, it.key),
      ),
    );
  }
  return c.json({ ok: true, dismissed: items.length });
});

overview.get("/search", async (c) => {
  const user = c.get("user");
  const q = c.req.query("q") ?? "";
  if (q.length < 2 || q.length > 80) return c.json({ detail: "q must be 2–80 characters" }, 422);
  const needle = q.toLowerCase();
  const matches = (v: unknown) => String(v ?? "").toLowerCase().includes(needle);

  const blist = await listBuildings(c.env, user.id);
  const buildings: Record<string, Dict> = Object.fromEntries(blist.map((b) => [b.id, b]));
  const bname = (i: string | null | undefined) => (i && buildings[i] ? (buildings[i].label ?? "") : "");
  const out: Dict[] = [];

  for (const b of blist) {
    if (matches(`${b.label ?? ""} ${b.street ?? ""} ${b.bbl ?? ""}`)) {
      out.push({ type: "building", id: b.id, label: b.label, sub: b.borough ?? "", building_id: b.id });
    }
  }

  const tenants = await listRecords(c.env, user.id, "tenants", null, 5000);
  for (const t of tenants.filter((t) => matches(t.name)).slice(0, 8)) {
    out.push({ type: "tenant", id: t.id, label: t.name, sub: bname(t.building_id), building_id: t.building_id });
  }

  const units = await listRecords(c.env, user.id, "units", null, 5000);
  for (const u of units.filter((u) => matches(u.number)).slice(0, 8)) {
    out.push({ type: "unit", id: u.id, label: `Unit ${u.number}`, sub: bname(u.building_id), building_id: u.building_id });
  }

  const wos = await listRecords(c.env, user.id, "work_orders", null, 5000);
  for (const w of wos.filter((w) => matches(w.title)).slice(0, 8)) {
    out.push({
      type: "work_order", id: w.id, label: w.title,
      sub: `${w.status} · ${bname(w.building_id)}`, building_id: w.building_id,
    });
  }

  const vendors = await listRecords(c.env, user.id, "vendors", null, 5000);
  for (const v of vendors.filter((v) => matches(v.name)).slice(0, 8)) {
    out.push({ type: "vendor", id: v.id, label: v.name, sub: v.category ?? "", building_id: null });
  }

  const documents = await listDocuments(c.env, user.id);
  for (const d of documents.filter((d) => matches(d.name)).slice(0, 8)) {
    out.push({ type: "document", id: d.id, label: d.name, sub: bname(d.building_id), building_id: d.building_id });
  }

  return c.json({ results: out.slice(0, 24) });
});

export default overview;
