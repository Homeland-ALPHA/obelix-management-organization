/**
 * Remediation tracking for city-issued violations.
 *
 * The violation records themselves come from NYC Open Data and are read-only,
 * so everything a team does about one — stage, assigned vendor, artifacts
 * collected, who changed what — lives here, keyed by the agency's violation id.
 */
import { Hono } from "hono";
import type { AppEnv, Dict } from "../types";
import { logActivity, rowData, rowsData } from "../lib/db";
import { nowISO } from "../lib/util";

const violations = new Hono<AppEnv>();

// Ordered remediation stages. "detected" is implicit (the agency issued it) and
// "cleared" is driven by the agency closing the record, not by us.
const STAGES = ["detected", "explained", "assigned", "corrected", "documented", "certified", "cleared"];

// Requirements that must be met before a violation can be certified. The first
// three are satisfied by the agency record itself; the rest are our team's work.
const ARTIFACTS = ["access_confirmed", "before_photos", "treatment_report", "certification"];

const TRACKED_FIELDS = new Set([
  "stage", "unit", "vendor_id", "assignee", "target_date", "summary", "notes", ...ARTIFACTS,
]);

violations.get("/tracking", async (c) => {
  const user = c.get("user");
  const buildingId = c.req.query("building_id");
  const filter = buildingId && buildingId !== "portfolio" ? " AND building_id = ?" : "";
  const stmt = c.env.DB.prepare(
    `SELECT data FROM violation_tracking WHERE user_id = ?${filter} LIMIT 2000`,
  );
  const rs = await (filter ? stmt.bind(user.id, buildingId) : stmt.bind(user.id)).all();
  const docs = rowsData(rs);
  return c.json(Object.fromEntries(docs.map((d) => [d.violation_id, d])));
});

violations.get("/:violationId/tracking", async (c) => {
  const user = c.get("user");
  const row = await c.env.DB.prepare(
    "SELECT data FROM violation_tracking WHERE user_id = ? AND violation_id = ?",
  )
    .bind(user.id, c.req.param("violationId"))
    .first<Dict>();
  return c.json(rowData(row));
});

violations.put("/:violationId/tracking", async (c) => {
  const user = c.get("user");
  const violationId = c.req.param("violationId");
  const body = (await c.req.json().catch(() => ({}))) as Dict;

  if (!body.building_id) return c.json({ detail: "building_id is required" }, 422);
  if (body.stage !== undefined && body.stage !== null && !STAGES.includes(body.stage)) {
    return c.json({ detail: `Unknown stage '${body.stage}'` }, 422);
  }
  const entry = body.entry !== undefined && body.entry !== null ? String(body.entry).slice(0, 500) : null;

  const building = await c.env.DB.prepare("SELECT id FROM buildings WHERE user_id = ? AND id = ?")
    .bind(user.id, body.building_id)
    .first();
  if (!building) return c.json({ detail: "Building not found" }, 404);

  const existingRow = await c.env.DB.prepare(
    "SELECT data FROM violation_tracking WHERE user_id = ? AND violation_id = ?",
  )
    .bind(user.id, violationId)
    .first<Dict>();
  const existing = rowData(existingRow);

  const patch: Dict = {};
  for (const [k, v] of Object.entries(body)) {
    if (TRACKED_FIELDS.has(k) && v !== null && v !== undefined) patch[k] = v;
  }

  const show = (v: unknown): string => {
    if (v === null || v === undefined || v === "") return "not set";
    if (typeof v === "boolean") return v ? "yes" : "no";
    return String(v);
  };

  const changes = Object.entries(patch)
    .filter(([k, v]) => !existing || JSON.stringify(existing[k] ?? null) !== JSON.stringify(v))
    .map(([k, v]) => {
      const field = k.replace(/_/g, " ");
      const label = field.charAt(0).toUpperCase() + field.slice(1);
      return `${label}: ${show(existing ? existing[k] : null)} → ${show(v)}`;
    });
  if (!changes.length && !entry) return c.json(existing);

  const history = [...((existing || {}).history || [])];
  history.push({
    at: nowISO(),
    by: user.name || user.email,
    stage: patch.stage || (existing || {}).stage || "detected",
    note: entry || changes.join("; ").slice(0, 500),
  });

  const doc: Dict = {
    ...(existing || {
      id: crypto.randomUUID(),
      violation_id: violationId,
      stage: "detected",
      created_at: nowISO(),
    }),
    ...patch,
    building_id: body.building_id,
    history: history.slice(-60),
    updated_at: nowISO(),
  };

  await c.env.DB.prepare(
    "INSERT INTO violation_tracking (user_id, violation_id, building_id, data) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (user_id, violation_id) DO UPDATE SET building_id = excluded.building_id, data = excluded.data",
  )
    .bind(user.id, violationId, body.building_id, JSON.stringify(doc))
    .run();

  await logActivity(
    c.env,
    user,
    existing ? "updated" : "started tracking",
    "violations",
    { id: violationId },
    `Violation #${violationId}`,
    { changes, buildingId: body.building_id },
  );
  return c.json(doc);
});

export default violations;
