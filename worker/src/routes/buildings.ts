import { Hono } from "hono";
import type { AppEnv, Dict, Env } from "../types";
import { ApiError, logActivity, rowData, rowsData } from "../lib/db";
import { nowISO } from "../lib/util";
import * as nyc from "../nyc";

// Auth guard is applied once in index.ts for every non-auth route.
const buildings = new Hono<AppEnv>();

const STALE_MINUTES = 30;

/** Persist a building's public doc (the `data` column IS the API shape). */
async function saveBuilding(env: Env, b: Dict): Promise<void> {
  await env.DB.prepare("UPDATE buildings SET data = ? WHERE id = ?")
    .bind(JSON.stringify(b), b.id)
    .run();
}

/** Fetch all NYC datasets for a building, store them, update the summary. */
async function syncBuilding(env: Env, building: Dict): Promise<Dict> {
  const results = await nyc.fetchAll(env, building);
  await env.DB.batch(
    results.map((r) =>
      env.DB.prepare(
        "INSERT INTO nyc_data (building_id, key, data) VALUES (?, ?, ?) " +
          "ON CONFLICT (building_id, key) DO UPDATE SET data = excluded.data",
      ).bind(building.id, r.key, JSON.stringify(r)),
    ),
  );
  const datasets = Object.fromEntries(results.map((r) => [r.key, r]));
  building.summary = nyc.computeSummary(datasets);
  building.last_synced = nowISO();
  await saveBuilding(env, building);
  return building;
}

async function getOwned(env: Env, buildingId: string, userId: string): Promise<Dict> {
  const row = await env.DB.prepare("SELECT data FROM buildings WHERE id = ? AND user_id = ?")
    .bind(buildingId, userId)
    .first<Dict>();
  const b = rowData(row);
  if (!b) throw new ApiError(404, "Building not found");
  return b;
}

export async function listBuildings(env: Env, userId: string): Promise<Dict[]> {
  const rs = await env.DB.prepare(
    "SELECT data FROM buildings WHERE user_id = ? ORDER BY created_at ASC LIMIT 200",
  )
    .bind(userId)
    .all();
  return rowsData(rs);
}

buildings.get("/geosearch", async (c) => {
  const q = c.req.query("q") ?? "";
  if (q.length < 3 || q.length > 120) return c.json({ detail: "q must be 3–120 characters" }, 422);
  try {
    return c.json(await nyc.geosearch(q));
  } catch (e: any) {
    return c.json({ detail: `GeoSearch unavailable: ${e?.name || "Error"}` }, 502);
  }
});

buildings.get("/buildings", async (c) => {
  return c.json(await listBuildings(c.env, c.get("user").id));
});

buildings.post("/buildings", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Dict;

  const bbl = String(body.bbl ?? "");
  if (bbl.length < 10 || bbl.length > 11) return c.json({ detail: "bbl must be 10–11 characters" }, 422);
  const bblDigits = bbl.replace(/\D/g, "");

  const dup = await c.env.DB.prepare("SELECT id FROM buildings WHERE user_id = ? AND bbl = ?")
    .bind(user.id, bblDigits)
    .first();
  if (dup) return c.json({ detail: "This building is already in your portfolio" }, 409);

  const parts = nyc.bblParts(bblDigits);
  const boro = parts ? parts[0] : "";
  const bin = String(body.bin ?? "");
  const [profile, hpd] = await Promise.all([
    nyc.plutoProfile(c.env, bblDigits),
    nyc.hpdBuildingLookup(c.env, bin, ...(parts ?? (["", "", ""] as [string, string, string]))),
  ]);

  const housenumber = String(body.housenumber ?? "");
  const street = String(body.street ?? "");
  const building: Dict = {
    id: crypto.randomUUID(),
    label: String(body.label ?? "") || `${housenumber} ${street}`.trim(),
    housenumber,
    street,
    borough: String(body.borough ?? "") || nyc.BORO_NAMES[boro] || "",
    zip: String(body.zip ?? "") || profile.zipcode || "",
    bbl: bblDigits,
    bin,
    ...hpd,
    profile,
    summary: {},
    created_at: nowISO(),
    last_synced: null,
  };

  await c.env.DB.prepare(
    "INSERT INTO buildings (id, user_id, bbl, created_at, data) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(building.id, user.id, bblDigits, building.created_at, JSON.stringify(building))
    .run();

  const synced = await syncBuilding(c.env, building);
  await logActivity(c.env, user, "added building", "buildings", { id: synced.id, building_id: synced.id }, synced.label, {
    buildingId: synced.id,
  });
  return c.json(synced);
});

const PROFILE_SECTIONS = ["ownership", "utilities", "valuation_user"];
const PROFILE_FIELDS = ["label", "property_type", "commercial_units", "notes"];

buildings.patch("/buildings/:buildingId", async (c) => {
  const user = c.get("user");
  const buildingId = c.req.param("buildingId");
  const payload = (await c.req.json().catch(() => ({}))) as Dict;

  const b = await getOwned(c.env, buildingId, user.id);
  const updates: Dict = {};
  const changes: Dict[] = [];
  for (const k of PROFILE_FIELDS) {
    if (k in payload && JSON.stringify(payload[k]) !== JSON.stringify(b[k] ?? null)) {
      updates[k] = payload[k];
      changes.push({ field: k, before: b[k] ?? null, after: payload[k] });
    }
  }
  for (const k of PROFILE_SECTIONS) {
    if (k in payload && payload[k] && typeof payload[k] === "object" && !Array.isArray(payload[k])) {
      const merged = { ...(b[k] || {}), ...payload[k] };
      if (JSON.stringify(merged) !== JSON.stringify(b[k] ?? null)) {
        updates[k] = merged;
        changes.push({ field: k, before: b[k] ?? null, after: merged });
      }
    }
  }
  if (Object.keys(updates).length) {
    Object.assign(b, updates);
    await saveBuilding(c.env, b);
    await logActivity(c.env, user, "updated", "buildings", { id: buildingId, building_id: buildingId }, b.label, {
      changes,
      buildingId,
    });
  }
  return c.json(b);
});

buildings.get("/buildings/:buildingId", async (c) => {
  return c.json(await getOwned(c.env, c.req.param("buildingId"), c.get("user").id));
});

buildings.post("/buildings/:buildingId/sync", async (c) => {
  const b = await getOwned(c.env, c.req.param("buildingId"), c.get("user").id);
  return c.json(await syncBuilding(c.env, b));
});

buildings.get("/buildings/:buildingId/data", async (c) => {
  const buildingId = c.req.param("buildingId");
  let b = await getOwned(c.env, buildingId, c.get("user").id);

  let stale = true;
  if (b.last_synced) {
    const last = Date.parse(b.last_synced);
    if (!Number.isNaN(last)) stale = Date.now() - last > STALE_MINUTES * 60 * 1000;
  }
  if (stale) b = await syncBuilding(c.env, b);

  const rs = await c.env.DB.prepare("SELECT data FROM nyc_data WHERE building_id = ? LIMIT 50")
    .bind(buildingId)
    .all();
  const datasets = Object.fromEntries(rowsData(rs).map((r) => [r.key, r]));
  return c.json({ building: b, datasets });
});

buildings.delete("/buildings/:buildingId", async (c) => {
  const user = c.get("user");
  const buildingId = c.req.param("buildingId");
  const b = await getOwned(c.env, buildingId, user.id);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM nyc_data WHERE building_id = ?").bind(buildingId),
    c.env.DB.prepare("DELETE FROM buildings WHERE id = ? AND user_id = ?").bind(buildingId, user.id),
  ]);
  await logActivity(c.env, user, "removed building", "buildings", { id: buildingId, building_id: buildingId }, b.label, {
    buildingId,
  });
  return c.json({ ok: true });
});

export default buildings;
