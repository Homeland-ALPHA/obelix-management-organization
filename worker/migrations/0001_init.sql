-- Obelix schema for Cloudflare D1.
--
-- The Mongo collections this replaces were schemaless with a whitelisted
-- field registry per entity, so each table keeps the queried keys as real
-- columns (user_id, building_id, entity, timestamps) and stores the rest of
-- the record as JSON in `data`. `data` never contains user_id; ownership
-- lives only in the column, so a row's JSON is already the public shape.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buildings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bbl TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_user_bbl ON buildings (user_id, bbl);
CREATE INDEX IF NOT EXISTS idx_buildings_user ON buildings (user_id);

-- Generic operational records: units, tenants, revenue, expenses, budgets,
-- loans, work_orders, vendors. One table drives them all, mirroring the
-- entity registry in the API.
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  building_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_records_lookup ON records (user_id, entity, building_id);

-- Cached NYC Open Data per building and dataset key.
CREATE TABLE IF NOT EXISTS nyc_data (
  building_id TEXT NOT NULL,
  key TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (building_id, key)
);

-- Document metadata; file bodies live in R2 under r2_key.
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  building_id TEXT,
  unit_id TEXT,
  tenant_id TEXT,
  vendor_id TEXT,
  work_order_id TEXT,
  loan_id TEXT,
  uploaded_at TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (user_id, building_id);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  building_id TEXT,
  at TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_activity_user_at ON activity (user_id, at DESC);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS violation_tracking (
  user_id TEXT NOT NULL,
  violation_id TEXT NOT NULL,
  building_id TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, violation_id)
);
CREATE INDEX IF NOT EXISTS idx_vtrack_building ON violation_tracking (user_id, building_id);

CREATE TABLE IF NOT EXISTS dismissed (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
