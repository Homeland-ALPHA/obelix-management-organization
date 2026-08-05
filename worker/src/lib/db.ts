import type { Dict, Env, User } from "../types";
import { nowISO } from "./util";

/** Parse the JSON `data` column of every row in a D1 result. */
export function rowsData<T = Dict>(rs: D1Result): T[] {
  return ((rs.results ?? []) as Dict[]).map((r) => JSON.parse(r.data as string));
}

export function rowData<T = Dict>(row: Dict | null): T | null {
  return row ? (JSON.parse(row.data as string) as T) : null;
}

/**
 * HTTP-shaped error the top-level onError handler turns into
 * {"detail": ...} with the right status — the FastAPI error contract the
 * frontend's apiError() expects.
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

export type ActivityMeta = {
  changes?: unknown[];
  buildingId?: string | null;
  source?: string;
};

/** Every mutation writes an activity entry (audit trail). */
export async function logActivity(
  env: Env,
  user: User,
  action: string,
  entity: string,
  record: Dict,
  label: string,
  meta: ActivityMeta = {},
): Promise<void> {
  const id = crypto.randomUUID();
  const buildingId = meta.buildingId ?? record.building_id ?? null;
  const doc = {
    id,
    actor: user.name || user.email,
    at: nowISO(),
    action,
    entity,
    entity_id: record.id,
    label,
    building_id: buildingId,
    changes: meta.changes ?? [],
    source: meta.source ?? "user",
  };
  await env.DB.prepare(
    "INSERT INTO activity (id, user_id, building_id, at, data) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, user.id, buildingId, doc.at, JSON.stringify(doc))
    .run();
}
