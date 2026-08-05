/**
 * Generic entity CRUD with an audit trail.
 *
 * One registry drives create/list/update/delete for every operational record
 * type (units, tenants, revenue, expenses, budgets, loans, work orders,
 * vendors, documents). Every mutation writes an activity entry.
 */
import { Hono } from "hono";
import type { AppEnv, Dict, Env } from "../types";
import { ApiError, logActivity, rowData, rowsData } from "../lib/db";
import { nowISO, round2 } from "../lib/util";

const entities = new Hono<AppEnv>();

type EntitySpec = {
  buildingScoped: boolean;
  label: (d: Dict) => string;
  fields: Set<string>;
};

// fields: whitelisted top-level keys the client may set.
export const ENTITIES: Record<string, EntitySpec> = {
  units: {
    buildingScoped: true,
    label: (d) => `Unit ${d.number ?? "?"}`,
    fields: new Set([
      "number", "floor", "beds", "baths", "sqft", "status", "appliances",
      "access_notes", "keys", "notes",
    ]),
  },
  tenants: {
    buildingScoped: true,
    label: (d) => d.name || "Tenant",
    fields: new Set([
      "name", "unit_id", "phone", "email", "emergency_contact",
      "lease_start", "lease_end", "legal_rent", "preferential_rent",
      "current_rent", "subsidy_program", "subsidy_amount", "tenant_portion",
      "deposit", "stabilized", "renewal_status", "notes",
    ]),
  },
  revenue: {
    buildingScoped: true,
    label: (d) => `${titleWords(d.category || "revenue")} · $${d.received || 0}`,
    fields: new Set([
      "date", "unit_id", "tenant_id", "category", "expected", "received",
      "method", "status", "notes",
    ]),
  },
  expenses: {
    buildingScoped: true,
    label: (d) => `${titleWords(d.category || "expense")} · $${d.amount || 0}`,
    fields: new Set([
      "vendor_id", "category", "unit_id", "invoice_date", "due_date",
      "amount", "status", "paid_date", "method", "approval_status", "notes",
    ]),
  },
  budgets: {
    buildingScoped: true,
    label: (d) => `Budget ${d.year ?? ""}`,
    fields: new Set(["year", "lines", "notes"]),
  },
  loans: {
    buildingScoped: true,
    label: (d) => `Loan · ${d.lender ?? "?"}`,
    fields: new Set([
      "lender", "original_principal", "balance", "rate", "loan_type",
      "fixed", "monthly_payment", "escrow", "maturity_date",
      "amortization_years", "next_payment_date", "notes",
    ]),
  },
  work_orders: {
    buildingScoped: true,
    label: (d) => d.title || "Work order",
    fields: new Set([
      "title", "category", "description", "unit_id", "area", "priority",
      "emergency", "status", "reported_by", "tenant_contact",
      "entry_permission", "access_time", "assignee", "vendor_id",
      "est_cost", "final_cost", "approval_required", "approval",
      "target_date", "completed", "related_violation", "notes",
    ]),
  },
  vendors: {
    buildingScoped: false,
    label: (d) => d.name || "Vendor",
    fields: new Set([
      "name", "category", "phone", "email", "contact", "address",
      "insurance_exp", "license_exp", "contract_terms", "rating", "notes",
    ]),
  },
};

function titleWords(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export const WO_STATUSES = [
  "Submitted", "Under Review", "Approval Required", "Approved", "Assigned",
  "Scheduled", "In Progress", "Waiting for Parts", "Waiting for Access",
  "Completed", "Inspected", "Closed",
];

export function entityLabel(entity: string, record: Dict): string {
  return entity in ENTITIES ? ENTITIES[entity].label(record) : record.label || entity;
}

function clean(entityKey: string, payload: Dict): Dict {
  const allowed = ENTITIES[entityKey].fields;
  return Object.fromEntries(Object.entries(payload).filter(([k]) => allowed.has(k)));
}

async function owned(env: Env, entityKey: string, recordId: string, userId: string): Promise<Dict> {
  const row = await env.DB.prepare(
    "SELECT data FROM records WHERE id = ? AND user_id = ? AND entity = ?",
  )
    .bind(recordId, userId, entityKey)
    .first<Dict>();
  const doc = rowData(row);
  if (!doc) throw new ApiError(404, "Record not found");
  return doc;
}

async function saveRecord(env: Env, userId: string, entityKey: string, doc: Dict): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO records (id, user_id, entity, building_id, created_at, updated_at, data) VALUES (?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT (id) DO UPDATE SET building_id = excluded.building_id, updated_at = excluded.updated_at, data = excluded.data",
  )
    .bind(doc.id, userId, entityKey, doc.building_id ?? null, doc.created_at, doc.updated_at, JSON.stringify(doc))
    .run();
}

export async function listRecords(
  env: Env,
  userId: string,
  entityKey: string,
  buildingId?: string | null,
  limit = 2000,
): Promise<Dict[]> {
  const filter = buildingId ? " AND building_id = ?" : "";
  const stmt = env.DB.prepare(
    `SELECT data FROM records WHERE user_id = ? AND entity = ?${filter} ORDER BY created_at DESC LIMIT ?`,
  );
  const rs = await (buildingId
    ? stmt.bind(userId, entityKey, buildingId, limit)
    : stmt.bind(userId, entityKey, limit)
  ).all();
  return rowsData(rs);
}

// --------------------------------------------------------------- generic CRUD
entities.get("/e/:entityKey", async (c) => {
  const entityKey = c.req.param("entityKey");
  if (!(entityKey in ENTITIES)) return c.json({ detail: "Unknown entity" }, 404);
  const buildingId = c.req.query("building_id");
  const scoped = ENTITIES[entityKey].buildingScoped;
  return c.json(await listRecords(c.env, c.get("user").id, entityKey, scoped ? buildingId : null));
});

entities.post("/e/:entityKey", async (c) => {
  const entityKey = c.req.param("entityKey");
  if (!(entityKey in ENTITIES)) return c.json({ detail: "Unknown entity" }, 404);
  const user = c.get("user");
  const payload = (await c.req.json().catch(() => ({}))) as Dict;
  const spec = ENTITIES[entityKey];

  const doc = clean(entityKey, payload);
  if (spec.buildingScoped) {
    const buildingId = payload.building_id;
    if (!buildingId) return c.json({ detail: "building_id is required" }, 422);
    const b = await c.env.DB.prepare("SELECT id FROM buildings WHERE id = ? AND user_id = ?")
      .bind(buildingId, user.id)
      .first();
    if (!b) return c.json({ detail: "Building not found" }, 404);
    doc.building_id = buildingId;
  }
  if (entityKey === "work_orders") {
    doc.status = doc.status ?? "Submitted";
    doc.priority = doc.priority ?? "medium";
  }
  if (entityKey === "loans") {
    doc.payments = doc.payments ?? [];
  }
  Object.assign(doc, { id: crypto.randomUUID(), created_at: nowISO(), updated_at: nowISO() });
  await saveRecord(c.env, user.id, entityKey, doc);
  await logActivity(c.env, user, "created", entityKey, doc, entityLabel(entityKey, doc));
  return c.json(doc);
});

entities.patch("/e/:entityKey/:recordId", async (c) => {
  const entityKey = c.req.param("entityKey");
  if (!(entityKey in ENTITIES)) return c.json({ detail: "Unknown entity" }, 404);
  const user = c.get("user");
  const payload = (await c.req.json().catch(() => ({}))) as Dict;

  const doc = await owned(c.env, entityKey, c.req.param("recordId"), user.id);
  const updates = clean(entityKey, payload);
  if (entityKey === "work_orders" && "status" in updates && !WO_STATUSES.includes(updates.status)) {
    return c.json({ detail: "Invalid work order status" }, 422);
  }
  const changes = Object.entries(updates)
    .filter(([k, v]) => JSON.stringify(doc[k] ?? null) !== JSON.stringify(v ?? null))
    .map(([k, v]) => ({ field: k, before: doc[k] ?? null, after: v }));
  if (changes.length) {
    Object.assign(doc, updates, { updated_at: nowISO() });
    await saveRecord(c.env, user.id, entityKey, doc);
    await logActivity(c.env, user, "updated", entityKey, doc, entityLabel(entityKey, doc), { changes });
  }
  return c.json(doc);
});

entities.delete("/e/:entityKey/:recordId", async (c) => {
  const entityKey = c.req.param("entityKey");
  if (!(entityKey in ENTITIES)) return c.json({ detail: "Unknown entity" }, 404);
  const user = c.get("user");
  const doc = await owned(c.env, entityKey, c.req.param("recordId"), user.id);
  await c.env.DB.prepare("DELETE FROM records WHERE id = ? AND user_id = ?").bind(doc.id, user.id).run();
  await logActivity(c.env, user, "deleted", entityKey, doc, entityLabel(entityKey, doc));
  return c.json({ ok: true });
});

// --------------------------------------------------------------- loan payments
entities.post("/e/loans/:loanId/payments", async (c) => {
  const user = c.get("user");
  const loan = await owned(c.env, "loans", c.req.param("loanId"), user.id);
  const payload = (await c.req.json().catch(() => ({}))) as Dict;
  const payment = {
    id: crypto.randomUUID(),
    date: payload.date ?? null,
    amount: payload.amount ?? null,
    principal: payload.principal ?? null,
    interest: payload.interest ?? null,
    escrow: payload.escrow ?? null,
    method: payload.method ?? null,
    notes: payload.notes ?? null,
  };
  let newBalance = loan.balance ?? null;
  if (newBalance !== null && payment.principal) {
    const bal = parseFloat(String(newBalance));
    const principal = parseFloat(String(payment.principal));
    if (Number.isFinite(bal) && Number.isFinite(principal)) newBalance = round2(bal - principal);
  }
  loan.payments = [...(loan.payments || []), payment];
  loan.balance = newBalance;
  loan.updated_at = nowISO();
  await saveRecord(c.env, user.id, "loans", loan);
  await logActivity(c.env, user, "recorded payment on", "loans", loan, entityLabel("loans", loan), {
    changes: [{ field: "payment", before: null, after: payment.amount }],
  });
  return c.json(loan);
});

entities.delete("/e/loans/:loanId/payments/:paymentId", async (c) => {
  const user = c.get("user");
  const paymentId = c.req.param("paymentId");
  const loan = await owned(c.env, "loans", c.req.param("loanId"), user.id);
  loan.payments = (loan.payments || []).filter((p: Dict) => p.id !== paymentId);
  await saveRecord(c.env, user.id, "loans", loan);
  await logActivity(c.env, user, "removed payment on", "loans", loan, entityLabel("loans", loan));
  return c.json({ ok: true });
});

// --------------------------------------------------------------- documents
const DOC_LINKS = ["building_id", "unit_id", "tenant_id", "vendor_id", "work_order_id", "loan_id"];
const MAX_UPLOAD = 25 * 1024 * 1024;

export async function listDocuments(
  env: Env,
  userId: string,
  filters: { building_id?: string | null; link?: string | null; link_id?: string | null } = {},
): Promise<Dict[]> {
  let sql = "SELECT data FROM documents WHERE user_id = ?";
  const binds: unknown[] = [userId];
  if (filters.building_id) {
    sql += " AND building_id = ?";
    binds.push(filters.building_id);
  }
  if (filters.link && filters.link_id && DOC_LINKS.includes(filters.link)) {
    sql += ` AND ${filters.link} = ?`;
    binds.push(filters.link_id);
  }
  sql += " ORDER BY uploaded_at DESC LIMIT 1000";
  const rs = await env.DB.prepare(sql).bind(...binds).all();
  return rowsData(rs);
}

entities.get("/documents", async (c) => {
  return c.json(
    await listDocuments(c.env, c.get("user").id, {
      building_id: c.req.query("building_id"),
      link: c.req.query("link"),
      link_id: c.req.query("link_id"),
    }),
  );
});

const R2_MISSING = "Document storage is not configured (enable R2 and add the DOCS bucket binding)";

entities.post("/documents", async (c) => {
  if (!c.env.DOCS) return c.json({ detail: R2_MISSING }, 503);
  const user = c.get("user");
  const form = await c.req.formData().catch(() => null);
  const file = (form?.get("file") ?? null) as unknown;
  if (!form || !(file instanceof File)) return c.json({ detail: "file is required" }, 422);
  if (file.size > MAX_UPLOAD) return c.json({ detail: "File too large (25 MB max)" }, 413);

  const field = (k: string) => String(form.get(k) ?? "");
  const safeName = (file.name || "document").replace(/[^\w.\- ]/g, "_");
  const docId = crypto.randomUUID();
  const r2Key = `${user.id}/${docId}_${safeName}`;

  await c.env.DOCS.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  const doc: Dict = {
    id: docId,
    name: safeName,
    size: file.size,
    content_type: file.type || null,
    category: field("category") || "other",
    tags: field("tags").split(",").map((t) => t.trim()).filter((t) => t),
    building_id: field("building_id") || null,
    unit_id: field("unit_id") || null,
    tenant_id: field("tenant_id") || null,
    vendor_id: field("vendor_id") || null,
    work_order_id: field("work_order_id") || null,
    loan_id: field("loan_id") || null,
    uploaded_at: nowISO(),
  };
  await c.env.DB.prepare(
    "INSERT INTO documents (id, user_id, building_id, unit_id, tenant_id, vendor_id, work_order_id, loan_id, uploaded_at, r2_key, data) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      docId, user.id, doc.building_id, doc.unit_id, doc.tenant_id, doc.vendor_id,
      doc.work_order_id, doc.loan_id, doc.uploaded_at, r2Key, JSON.stringify(doc),
    )
    .run();
  await logActivity(c.env, user, "uploaded", "documents", { id: docId, building_id: doc.building_id }, safeName, {
    buildingId: doc.building_id,
  });
  return c.json(doc);
});

entities.get("/documents/:docId/download", async (c) => {
  if (!c.env.DOCS) return c.json({ detail: R2_MISSING }, 503);
  const user = c.get("user");
  const row = await c.env.DB.prepare("SELECT r2_key, data FROM documents WHERE id = ? AND user_id = ?")
    .bind(c.req.param("docId"), user.id)
    .first<Dict>();
  if (!row) return c.json({ detail: "Document not found" }, 404);
  const object = await c.env.DOCS.get(row.r2_key as string);
  if (!object) return c.json({ detail: "Document not found" }, 404);
  const doc = JSON.parse(row.data as string);
  return new Response(object.body, {
    headers: {
      "Content-Type": doc.content_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${doc.name}"`,
    },
  });
});

entities.delete("/documents/:docId", async (c) => {
  const user = c.get("user");
  const row = await c.env.DB.prepare("SELECT r2_key, data FROM documents WHERE id = ? AND user_id = ?")
    .bind(c.req.param("docId"), user.id)
    .first<Dict>();
  if (!row) return c.json({ detail: "Document not found" }, 404);
  const doc = JSON.parse(row.data as string);
  try {
    await c.env.DOCS?.delete(row.r2_key as string);
  } catch {
    // metadata cleanup still proceeds
  }
  await c.env.DB.prepare("DELETE FROM documents WHERE id = ? AND user_id = ?").bind(doc.id, user.id).run();
  await logActivity(c.env, user, "deleted", "documents", { id: doc.id, building_id: doc.building_id }, doc.name, {
    buildingId: doc.building_id,
  });
  return c.json({ ok: true });
});

// --------------------------------------------------------------- activity feed
entities.get("/activity", async (c) => {
  const user = c.get("user");
  const buildingId = c.req.query("building_id");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10) || 100, 500);
  const filter = buildingId ? " AND building_id = ?" : "";
  const stmt = c.env.DB.prepare(
    `SELECT data FROM activity WHERE user_id = ?${filter} ORDER BY at DESC LIMIT ?`,
  );
  const rs = await (buildingId ? stmt.bind(user.id, buildingId, limit) : stmt.bind(user.id, limit)).all();
  return c.json(rowsData(rs));
});

// --------------------------------------------------------------- settings
const DEFAULT_SETTINGS: Dict = { company_name: "", approval_threshold: 1000, default_cap_rate: 6.0 };

async function getSettings(env: Env, userId: string): Promise<Dict> {
  const row = await env.DB.prepare("SELECT data FROM settings WHERE user_id = ?").bind(userId).first<Dict>();
  return { ...DEFAULT_SETTINGS, ...(rowData(row) || {}) };
}

entities.get("/settings", async (c) => c.json(await getSettings(c.env, c.get("user").id)));

entities.put("/settings", async (c) => {
  const user = c.get("user");
  const payload = (await c.req.json().catch(() => ({}))) as Dict;
  const updates = Object.fromEntries(
    Object.keys(DEFAULT_SETTINGS).filter((k) => k in payload).map((k) => [k, payload[k]]),
  );
  const current = await getSettings(c.env, user.id);
  const merged = { ...current, ...updates };
  await c.env.DB.prepare(
    "INSERT INTO settings (user_id, data) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data",
  )
    .bind(user.id, JSON.stringify(merged))
    .run();
  return c.json(merged);
});

export default entities;
