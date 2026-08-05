import { Hono } from "hono";
import type { AppEnv, Dict, Env } from "../types";
import { addDaysISO, lastMonths, todayISO } from "../lib/util";
import { listBuildings } from "./buildings";

const dashboard = new Hono<AppEnv>();

/** All buildings for a user plus their cached NYC datasets, keyed per building. */
export async function portfolio(
  env: Env,
  userId: string,
): Promise<{ buildings: Dict[]; byBuilding: Record<string, Record<string, Dict>> }> {
  const buildings = await listBuildings(env, userId);
  const rs = await env.DB.prepare(
    "SELECT n.building_id AS building_id, n.data AS data FROM nyc_data n " +
      "JOIN buildings b ON b.id = n.building_id WHERE b.user_id = ? LIMIT 5000",
  )
    .bind(userId)
    .all();
  const byBuilding: Record<string, Record<string, Dict>> = {};
  for (const row of (rs.results ?? []) as Dict[]) {
    const data = JSON.parse(row.data as string);
    (byBuilding[row.building_id] ??= {})[data.key] = { ...data, building_id: row.building_id };
  }
  return { buildings, byBuilding };
}

const monthKey = (iso: string | null | undefined) => (iso ? iso.slice(0, 7) : null);

dashboard.get("/dashboard", async (c) => {
  const user = c.get("user");
  const { buildings, byBuilding } = await portfolio(c.env, user.id);
  const today = todayISO();
  const soon = addDaysISO(30);

  let units = 0;
  let marketValue = 0;
  const openByClass: Record<string, number> = { A: 0, B: 0, C: 0, I: 0 };
  const totals: Record<string, number> = {
    hpd_open: 0, dob_active: 0, ecb_active: 0, complaints_open: 0, urgent: 0,
  };
  const priorities: Dict[] = [];
  const trendOpened: Record<string, number> = {};
  const trendCleared: Record<string, number> = {};
  let lastSynced: string | null = null;

  for (const b of buildings) {
    const s = b.summary || {};
    const p = b.profile || {};
    units += p.units_res || b.legal_units || 0;
    marketValue += s.market_value || 0;
    for (const k of Object.keys(openByClass)) openByClass[k] += (s.hpd_by_class || {})[k] || 0;
    totals.hpd_open += s.hpd_open || 0;
    totals.dob_active += s.dob_active || 0;
    totals.ecb_active += s.ecb_active || 0;
    totals.complaints_open += (s.hpd_complaints_open || 0) + (s.c311_open || 0);
    totals.urgent += s.urgent || 0;
    if (b.last_synced && (lastSynced === null || b.last_synced > lastSynced)) lastSynced = b.last_synced;

    const ds = byBuilding[b.id] || {};

    // --- trend: HPD violations opened / cleared by month (last 12 months)
    for (const v of ds.hpd_violations?.items ?? []) {
      const mk = monthKey(v.date);
      if (mk) trendOpened[mk] = (trendOpened[mk] || 0) + 1;
      if (!v.extra.open) {
        const ck = monthKey(v.extra.status_date);
        if (ck) trendCleared[ck] = (trendCleared[ck] || 0) + 1;
      }
    }

    // --- priorities
    for (const v of ds.hpd_violations?.items ?? []) {
      const e = v.extra;
      if (e.open && (e.class === "C" || e.class === "I")) {
        const due = e.correct_by;
        const overdue = Boolean(due && due < today);
        priorities.push({
          sort: due || "9999",
          title: `Class ${e.class} · ${v.title}`,
          building: b.label,
          building_id: b.id,
          when: due ? `Correct by ${due}` : "No correction date",
          status: overdue ? "Overdue" : "Urgent",
        });
      }
    }
    for (const v of ds.ecb_violations?.items ?? []) {
      const e = v.extra;
      const hd = e.hearing_date;
      if (e.open && hd && today <= hd && hd <= soon) {
        priorities.push({
          sort: hd,
          title: `OATH hearing · ${v.title}`,
          building: b.label,
          building_id: b.id,
          when: `Hearing ${hd}`,
          status: "Scheduled",
        });
      }
    }
    if (!s.registration_current && b.hpd_building_id) {
      priorities.push({
        sort: "0000",
        title: "HPD registration not current",
        building: b.label,
        building_id: b.id,
        when: s.registration_end ? `Expired ${s.registration_end}` : "No active registration",
        status: "Overdue",
      });
    }
    const bd = s.boiler_due;
    if (bd && bd < today) {
      priorities.push({
        sort: bd,
        title: "Annual boiler inspection overdue",
        building: b.label,
        building_id: b.id,
        when: `Was due ${bd}`,
        status: "Overdue",
      });
    }
  }

  const rank: Record<string, number> = { Overdue: 0, Urgent: 1, Scheduled: 2 };
  priorities.sort((a, b) => {
    const ra = rank[a.status] ?? 3;
    const rb = rank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0;
  });

  const months = lastMonths(12);

  return c.json({
    tiles: {
      buildings: buildings.length,
      units,
      open_violations: totals.hpd_open,
      urgent: totals.urgent,
      market_value: Math.round(marketValue),
    },
    open_by_class: openByClass,
    totals,
    priorities: priorities.slice(0, 12),
    priorities_total: priorities.length,
    trend: months.map((m) => ({ month: m, opened: trendOpened[m] || 0, cleared: trendCleared[m] || 0 })),
    buildings: buildings.map((b) => ({
      id: b.id,
      label: b.label,
      borough: b.borough ?? null,
      units: (b.profile || {}).units_res || b.legal_units || null,
      summary: b.summary || {},
      last_synced: b.last_synced ?? null,
    })),
    last_synced: lastSynced,
  });
});

dashboard.get("/compliance", async (c) => {
  const user = c.get("user");
  const buildingIdParam = c.req.query("building_id");
  let { buildings, byBuilding } = await portfolio(c.env, user.id);
  if (buildingIdParam && buildingIdParam !== "portfolio") {
    buildings = buildings.filter((b) => b.id === buildingIdParam);
  }
  const today = todayISO();
  const items: Dict[] = [];

  const add = (when: string | null, title: string, building: Dict, status: string, kind: string) => {
    items.push({
      date: when,
      title,
      building: building.label,
      building_id: building.id,
      status,
      kind,
    });
  };

  const year = new Date().getUTCFullYear();
  const bedbugDue = `${year}-12-31`;
  const may1 = `${year}-05-01`;
  const benchmarkingDue = today <= may1 ? may1 : `${year + 1}-05-01`;

  for (const b of buildings) {
    const s = b.summary || {};
    const p = b.profile || {};
    const ds = byBuilding[b.id] || {};

    // HPD annual registration
    if (b.hpd_building_id) {
      if (s.registration_current) {
        add(s.registration_end ?? null, "HPD annual registration renewal", b, "Scheduled", "Registration");
      } else {
        add(today, "HPD registration lapsed — refile now", b, "Overdue", "Registration");
      }
    }

    // Boiler
    if (s.boiler_due) {
      const status = s.boiler_due < today ? "Overdue" : "Scheduled";
      add(s.boiler_due, "Annual boiler inspection (DOB NOW filing)", b, status, "Boiler");
    } else if (p.units_res && (p.units_res || 0) >= 6) {
      add(null, "No boiler filing on record — confirm exemption", b, "Awaiting Review", "Boiler");
    }

    // Facade (FISP) — buildings over 6 stories
    if ((p.floors || 0) > 6) {
      const fs = s.facade_status || "No filing found";
      const tone = fs.toLowerCase().includes("unsafe")
        ? "Overdue"
        : fs.toLowerCase().includes("swarmp")
          ? "In Progress"
          : "Scheduled";
      add(null, `FISP facade status: ${fs} (cycle ${s.facade_cycle || "—"})`, b, tone, "Facade");
    }

    // Bedbug annual filing
    if (b.hpd_building_id) {
      add(bedbugDue, "HPD annual bedbug report (Dec 1 – Dec 31)", b, "Scheduled", "Bedbug");
    }

    // Benchmarking LL84/LL97
    if ((p.bldg_area || 0) > 25000) {
      add(benchmarkingDue, "LL84 energy benchmarking submission", b, "Scheduled", "Energy");
    }

    // Open class C correction deadlines
    for (const v of ds.hpd_violations?.items ?? []) {
      const e = v.extra;
      if (e.open && (e.class === "C" || e.class === "I") && e.correct_by) {
        const status = e.correct_by < today ? "Overdue" : "Urgent";
        add(e.correct_by, `Correct class ${e.class} violation · ${v.title}`, b, status, "Violation");
      }
    }

    // Upcoming OATH hearings
    for (const v of ds.ecb_violations?.items ?? []) {
      const e = v.extra;
      if (e.open && e.hearing_date && e.hearing_date >= today) {
        add(e.hearing_date, `OATH hearing · ${v.title}`, b, "Scheduled", "Hearing");
      }
    }
  }

  const dated = items
    .filter((i) => i.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const undated = items.filter((i) => !i.date);
  return c.json({ items: [...dated, ...undated] });
});

export default dashboard;
