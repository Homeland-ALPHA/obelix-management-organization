/**
 * NYC Open Data (Socrata) client, dataset normalizers and building sync.
 *
 * Every dataset is fetched live from data.cityofnewyork.us. Field names differ
 * per dataset and occasionally change, so each fetcher tries a list of
 * candidate $where filters and every normalizer reads fields defensively.
 *
 * Port of backend/nyc.py to fetch()/Workers.
 */
import type { Dict } from "./types";
import { addDaysISO, money0, todayISO } from "./lib/util";

const SOCRATA_BASE = "https://data.cityofnewyork.us/resource";
const GEOSEARCH_URL = "https://geosearch.planninglabs.nyc/v2/autocomplete";
const TIMEOUT_MS = 25_000;

export const BORO_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

type NycEnv = { NYC_APP_TOKEN?: string };

// ---------------------------------------------------------------- http helpers
function headers(env: NycEnv): Record<string, string> {
  return env.NYC_APP_TOKEN ? { "X-App-Token": env.NYC_APP_TOKEN } : {};
}

async function sodaGet(env: NycEnv, dataset: string, params: Dict): Promise<Dict[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await fetch(`${SOCRATA_BASE}/${dataset}.json?${qs}`, {
    headers: headers(env),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${dataset}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as Dict[]) : [];
}

/** Try candidate $where filters until one returns rows. Returns [rows, error]. */
async function sodaTry(
  env: NycEnv,
  dataset: string,
  whereCandidates: string[],
  order: string | null = null,
  limit = 250,
): Promise<[Dict[], string | null]> {
  let lastErr: string | null = null;
  let validButEmpty = false;
  for (const where of whereCandidates) {
    if (!where) continue;
    const params: Dict = { $limit: limit, $where: where };
    if (order) params.$order = order;
    try {
      const rows = await sodaGet(env, dataset, params);
      if (rows.length) return [rows, null];
      validButEmpty = true;
    } catch (e: any) {
      lastErr = `${e?.name || "Error"}: ${String(e?.message ?? e).slice(0, 220)}`;
      if (order) {
        // the order field may be the problem — retry once without it
        try {
          const rows = await sodaGet(env, dataset, { $limit: limit, $where: where });
          if (rows.length) return [rows, null];
          validButEmpty = true;
        } catch (e2: any) {
          lastErr = `${e2?.name || "Error"}: ${String(e2?.message ?? e2).slice(0, 220)}`;
        }
      }
    }
  }
  if (validButEmpty) return [[], null];
  return [[], lastErr || "no filter candidates"];
}

// ---------------------------------------------------------------- small utils
function validISODate(y: string, m: string, d: string): string | null {
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null;
}

export function parseDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T]|$)/);
  if (m) return validISODate(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: \d{1,2}:\d{2}:\d{2})?$/);
  if (m) return validISODate(m[3], m[1], m[2]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return validISODate(m[1], m[2], m[3]);
  return null;
}

export function clip(text: unknown, n = 220): string {
  if (!text) return "";
  const s = String(text).replace(/\s+/g, " ").trim();
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function titleCase(s: unknown): string {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[A-Za-z]+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function bblParts(bbl: unknown): [string, string, string] | null {
  const s = String(bbl ?? "").replace(/\D/g, "");
  if (s.length < 10) return null;
  return [s[0], s.slice(1, 6), s.slice(6, 10)]; // boro, block (5), lot (4)
}

export type NycItem = {
  id: string;
  date: string | null;
  title: string;
  sub: string;
  badge: string;
  tone: string; // urgent | warn | ok | neutral
  extra: Dict;
};

function item(
  id: unknown,
  date: string | null,
  title: unknown,
  sub: unknown = "",
  badge = "",
  tone = "neutral",
  extra: Dict | null = null,
): NycItem {
  return {
    id: String(id ?? ""),
    date,
    title: clip(title, 160),
    sub: clip(sub, 160),
    badge,
    tone,
    extra: extra || {},
  };
}

const bydateDesc = (items: NycItem[]) =>
  [...items].sort((a, b) => ((b.date || "0000") < (a.date || "0000") ? -1 : (b.date || "0000") > (a.date || "0000") ? 1 : 0));

const joinParts = (parts: unknown[]) => parts.filter((x) => x).join(" · ");

const toInt = (v: unknown): number | null => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

// ---------------------------------------------------------------- geosearch
export async function geosearch(text: string, size = 6): Promise<Dict[]> {
  const qs = new URLSearchParams({ text, size: String(size) });
  const res = await fetch(`${GEOSEARCH_URL}?${qs}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from GeoSearch`);
  const body = (await res.json()) as Dict;
  const out: Dict[] = [];
  for (const f of body.features ?? []) {
    const p = f.properties ?? {};
    const pad = (p.addendum ?? {}).pad ?? {};
    const bbl = pad.bbl ?? p.pad_bbl;
    const bin = pad.bin ?? p.pad_bin;
    if (!bbl) continue;
    out.push({
      label: p.label ?? "",
      housenumber: p.housenumber ?? "",
      street: p.street ?? "",
      borough: p.borough ?? "",
      zip: p.postalcode ?? "",
      bbl: String(bbl),
      bin: String(bin ?? ""),
    });
  }
  return out;
}

// ---------------------------------------------------------------- lookups used at creation
export async function plutoProfile(env: NycEnv, bbl: string): Promise<Dict> {
  let rows: Dict[] = [];
  try {
    rows = await sodaGet(env, "64uk-42ks", { $limit: 1, $where: `bbl=${Number(bbl)}` });
  } catch {
    rows = [];
  }
  if (!rows.length) return {};
  const r = rows[0];
  const num = (k: string) => toInt(r[k]);
  return {
    units_res: num("unitsres"),
    units_total: num("unitstotal"),
    floors: num("numfloors"),
    year_built: num("yearbuilt"),
    building_class: r.bldgclass,
    owner: titleCase(r.ownername),
    bldg_area: num("bldgarea"),
    lot_area: num("lotarea"),
    zipcode: r.zipcode,
    latitude: r.latitude,
    longitude: r.longitude,
  };
}

export async function hpdBuildingLookup(
  env: NycEnv,
  bin: string,
  boro: string,
  block5: string,
  lot4: string,
): Promise<Dict> {
  const candidates: string[] = [];
  if (bin) candidates.push(`bin='${bin}'`);
  if (boro && block5 && lot4) {
    candidates.push(`boroid='${boro}' AND block='${Number(block5)}' AND lot='${Number(lot4)}'`);
    candidates.push(`boroid=${Number(boro)} AND block=${Number(block5)} AND lot=${Number(lot4)}`);
  }
  const [rows] = await sodaTry(env, "kj4p-ruqc", candidates, null, 5);
  if (!rows.length) return {};
  const r = rows[0];
  const num = (k: string) => toInt(r[k]);
  const classA = num("legalclassa") || 0;
  const classB = num("legalclassb") || 0;
  return {
    hpd_building_id: String(r.buildingid ?? ""),
    registration_id: String(r.registrationid ?? ""),
    legal_stories: num("legalstories"),
    legal_units: classA + classB || null,
    hpd_lifecycle: r.lifecycle,
  };
}

// ---------------------------------------------------------------- per-dataset fetchers
type Ctx = {
  bbl: string;
  bin: string;
  boro: string;
  block5: string;
  lot4: string;
  hpd_id: string;
  addr: string;
  borough_name: string;
};

/** Common query context derived from a building doc. */
function ctxOf(b: Dict): Ctx {
  const parts = bblParts(b.bbl);
  const [boro, block5, lot4] = parts ?? ["", "", ""];
  const addr = `${b.housenumber ?? ""} ${b.street ?? ""}`.trim().toUpperCase();
  return {
    bbl: String(b.bbl ?? "").replace(/\D/g, ""),
    bin: String(b.bin ?? ""),
    boro,
    block5,
    lot4,
    hpd_id: String(b.hpd_building_id ?? ""),
    addr,
    borough_name: b.borough ?? "",
  };
}

type FetchResult = [NycItem[], string | null];
type Fetcher = (env: NycEnv, c: Ctx) => Promise<FetchResult>;

const fetchHpdViolations: Fetcher = async (env, c) => {
  const [rows, err] = await sodaTry(env, "wvxf-dwi5", [`bbl='${c.bbl}'`], "inspectiondate DESC");
  const items: NycItem[] = [];
  for (const r of rows) {
    const klass = String(r.class ?? "?").toUpperCase();
    const isOpen = String(r.violationstatus ?? "").toLowerCase() === "open";
    const correctBy = parseDate(r.newcorrectbydate || r.originalcorrectbydate);
    let tone = "neutral";
    if (isOpen) tone = klass === "C" || klass === "I" ? "urgent" : "warn";
    items.push(
      item(
        r.violationid,
        parseDate(r.inspectiondate),
        r.novdescription || "HPD violation",
        joinParts([
          `Class ${klass}`,
          r.apartment ? `Apt ${r.apartment}` : "",
          isOpen && correctBy ? `Correct by ${correctBy}` : "",
        ]),
        isOpen ? "Open" : "Cleared",
        tone,
        {
          class: klass,
          open: isOpen,
          correct_by: correctBy,
          apartment: clip(r.apartment, 20),
          status_date: parseDate(r.currentstatusdate),
          current_status: clip(r.currentstatus, 60),
        },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchHpdComplaints: Fetcher = async (env, c) => {
  const [rows, err] = await sodaTry(
    env,
    "ygpa-z7cr",
    [`bbl='${c.bbl}'`, c.hpd_id ? `buildingid='${c.hpd_id}'` : ""],
    "receiveddate DESC",
  );
  const items: NycItem[] = [];
  for (const r of rows) {
    const status = titleCase(r.complaintstatus || r.problemstatus || "");
    const isOpen = status.toLowerCase() === "open";
    const cat = [titleCase(r.majorcategory), titleCase(r.minorcategory)].filter((x) => x).join(" / ");
    items.push(
      item(
        r.problemid || r.complaintid,
        parseDate(r.receiveddate),
        cat || "Housing complaint",
        joinParts([
          r.apartment ? `Apt ${r.apartment}` : "",
          titleCase(r.unittype || r.spacetype),
          clip(r.statusdescription, 90),
        ]),
        isOpen ? "Open" : status || "Closed",
        isOpen ? "warn" : "neutral",
        { open: isOpen },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchDobViolations: Fetcher = async (env, c) => {
  const [rows, err] = await sodaTry(env, "3h2n-5cm9", c.bin ? [`bin='${c.bin}'`] : [], "issue_date DESC");
  const items: NycItem[] = [];
  for (const r of rows) {
    const disposed = Boolean(r.disposition_date);
    const vtype = r.violation_type || r.violation_category || "DOB violation";
    items.push(
      item(
        r.isn_dob_bis_viol || r.number,
        parseDate(r.issue_date),
        clip(vtype, 120),
        joinParts([r.number ? `No. ${r.number}` : "", clip(r.description, 90)]),
        disposed ? "Resolved" : "Active",
        disposed ? "neutral" : "warn",
        { open: !disposed },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchEcbViolations: Fetcher = async (env, c) => {
  const [rows, err] = await sodaTry(env, "6bgk-3dad", c.bin ? [`bin='${c.bin}'`] : [], "issue_date DESC");
  const items: NycItem[] = [];
  for (const r of rows) {
    const status = titleCase(r.ecb_violation_status ?? "");
    const isActive = status.toLowerCase() === "active";
    const hearing = parseDate(r.hearing_date);
    const balance = Number.isFinite(parseFloat(r.balance_due)) ? parseFloat(r.balance_due) : 0.0;
    items.push(
      item(
        r.ecb_violation_number,
        parseDate(r.issue_date),
        clip(r.violation_description || r.violation_type || "ECB violation", 130),
        joinParts([
          titleCase(r.severity),
          hearing ? `Hearing ${hearing}` : "",
          balance ? `Balance $${money0(balance)}` : "",
        ]),
        status || "Unknown",
        isActive ? "warn" : "neutral",
        { open: isActive, hearing_date: hearing, hearing_status: titleCase(r.hearing_status), balance },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchDobComplaints: Fetcher = async (env, c) => {
  const [rows, err] = await sodaTry(env, "eabe-havv", c.bin ? [`bin='${c.bin}'`] : []);
  const items: NycItem[] = [];
  for (const r of rows) {
    const status = titleCase(r.status ?? "");
    const isOpen = status.toLowerCase().includes("active");
    items.push(
      item(
        r.complaint_number,
        parseDate(r.date_entered),
        `Complaint category ${r.complaint_category || "?"}`,
        joinParts([
          r.priority ? `Priority ${r.priority}` : "",
          r.inspection_date ? `Inspected ${parseDate(r.inspection_date)}` : "",
        ]),
        status || "Unknown",
        isOpen ? "warn" : "neutral",
        { open: isOpen },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetch311: Fetcher = async (env, c) => {
  const floor = addDaysISO(-730);
  const base = `created_date > '${floor}'`;
  const candidates = [`bbl='${c.bbl}' AND ${base}`];
  if (c.addr && c.borough_name) {
    candidates.push(
      `upper(incident_address)='${c.addr}' AND upper(borough)='${c.borough_name.toUpperCase()}' AND ${base}`,
    );
  }
  const [rows, err] = await sodaTry(env, "erm2-nwe9", candidates, "created_date DESC", 150);
  const items: NycItem[] = [];
  for (const r of rows) {
    const status = titleCase(r.status ?? "");
    const isOpen = ["open", "in progress", "pending", "assigned", "started"].includes(status.toLowerCase());
    items.push(
      item(
        r.unique_key,
        parseDate(r.created_date),
        clip(r.complaint_type || "311 request", 90),
        joinParts([clip(r.descriptor, 80), String(r.agency ?? "").toUpperCase()]),
        status || "Unknown",
        isOpen ? "warn" : "neutral",
        { open: isOpen },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchRegistration: Fetcher = async (env, c) => {
  const candidates: string[] = [];
  if (c.bin) candidates.push(`bin='${c.bin}'`);
  if (c.boro && c.block5 && c.lot4) {
    candidates.push(`boroid='${c.boro}' AND block='${Number(c.block5)}' AND lot='${Number(c.lot4)}'`);
    candidates.push(`boroid=${Number(c.boro)} AND block=${Number(c.block5)} AND lot=${Number(c.lot4)}`);
  }
  const [rows, err] = await sodaTry(env, "tesw-yqqr", candidates, null, 10);
  const items: NycItem[] = [];
  for (const r of rows) {
    const end = parseDate(r.registrationenddate);
    const current = Boolean(end && end >= todayISO());
    items.push(
      item(
        r.registrationid,
        parseDate(r.lastregistrationdate),
        `HPD registration #${r.registrationid}`,
        end ? `Expires ${end}` : "",
        current ? "Current" : "Expired",
        current ? "ok" : "urgent",
        { end, current },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchBoiler: Fetcher = async (env, c) => {
  const [rows, err] = await sodaTry(env, "52dp-yji6", c.bin ? [`bin_number='${c.bin}'`] : [], null, 100);
  const items: NycItem[] = [];
  for (const r of rows) {
    const insp = parseDate(r.inspection_date);
    const defects = ["yes", "true", "y"].includes(String(r.defects_exist ?? "").trim().toLowerCase());
    items.push(
      item(
        r.tracking_number,
        insp,
        `Boiler ${r.boiler_id || ""} · ${titleCase(r.inspection_type || r.report_type || "inspection")}`,
        joinParts([
          titleCase(r.boiler_make),
          titleCase(r.pressure_type),
          r.report_status ? `Status ${titleCase(r.report_status)}` : "",
        ]),
        defects ? "Defects" : "No defects",
        defects ? "warn" : "ok",
        { defects },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchFacades: Fetcher = async (env, c) => {
  const [rows, err] = await sodaTry(env, "xubg-57si", c.bin ? [`bin='${c.bin}'`] : [], null, 50);
  const items: NycItem[] = [];
  for (const r of rows) {
    const status = titleCase(r.filing_status || r.current_status || "Filed");
    const unsafe = status.toLowerCase().includes("unsafe");
    const swarmp = status.toLowerCase().includes("swarmp");
    items.push(
      item(
        r.tr6_no || r.control_no,
        parseDate(r.submitted_on || r.filing_date),
        `FISP cycle ${r.cycle || "?"} · ${titleCase(r.filing_type || "filing")}`,
        clip(r.comments, 90),
        status,
        unsafe ? "urgent" : swarmp ? "warn" : "ok",
        { status, cycle: r.cycle },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchBedbugs: Fetcher = async (env, c) => {
  const candidates = [`bbl='${c.bbl}'`];
  if (c.hpd_id) {
    candidates.push(`building_id='${c.hpd_id}'`);
    if (/^\d+$/.test(c.hpd_id)) candidates.push(`building_id=${Number(c.hpd_id)}`);
  }
  const [rows, err] = await sodaTry(env, "wz6d-d3jb", candidates, null, 30);
  const items: NycItem[] = [];
  for (const r of rows) {
    const infested = toInt(r.infested_dwelling_unit_count) || 0;
    const periodEnd = parseDate(r.filling_period_end_date || r.filing_period_end_date);
    items.push(
      item(
        r.registration_id,
        parseDate(r.filing_date) || periodEnd,
        `Annual bedbug filing · ${infested} infested unit${infested !== 1 ? "s" : ""}`,
        periodEnd ? `Period ends ${periodEnd}` : "",
        infested ? "Infestation" : "Filed",
        infested ? "warn" : "ok",
        { infested },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchLitigation: Fetcher = async (env, c) => {
  const candidates = [`bbl='${c.bbl}'`];
  if (c.hpd_id) candidates.push(`buildingid='${c.hpd_id}'`);
  const [rows, err] = await sodaTry(env, "59kj-x8nc", candidates, null, 100);
  const items: NycItem[] = [];
  for (const r of rows) {
    const status = titleCase(r.casestatus);
    const isOpen = status ? !status.toLowerCase().includes("closed") : false;
    items.push(
      item(
        r.litigationid,
        parseDate(r.caseopendate),
        titleCase(r.casetype || "HPD litigation"),
        joinParts([
          clip(titleCase(r.respondent), 60),
          r.penalty ? `Penalty ${r.penalty}` : "",
          String(r.openjudgement ?? "").toLowerCase() === "yes" ? "Open judgement" : "",
        ]),
        status || "Unknown",
        isOpen ? "warn" : "neutral",
        { open: isOpen },
      ),
    );
  }
  return [bydateDesc(items), err];
};

const fetchValuation: Fetcher = async (env, c) => {
  const candidates: string[] = [];
  if (c.bbl) candidates.push(`bble='${c.bbl}'`);
  if (c.boro && c.block5 && c.lot4) {
    candidates.push(`boro='${c.boro}' AND block='${Number(c.block5)}' AND lot='${Number(c.lot4)}'`);
    candidates.push(`boro=${Number(c.boro)} AND block=${Number(c.block5)} AND lot=${Number(c.lot4)}`);
  }
  const [rows, err] = await sodaTry(env, "yjxr-fw8i", candidates, null, 40);

  const moneyOf = (r: Dict, ...keys: string[]): number | null => {
    for (const k of keys) {
      const v = parseFloat(r[k]);
      if (Number.isFinite(v) && v > 0) return v;
    }
    return null;
  };

  const items: NycItem[] = [];
  for (const r of rows) {
    const year = String(r.year ?? r.yr ?? "");
    const market = moneyOf(r, "fullval", "curmktval", "curmkttot", "pymktval");
    const assessed = moneyOf(r, "avtot", "curavt_act", "curtxbtot");
    items.push(
      item(
        `${year}-${r.bble ?? ""}`,
        /^\d{4}/.test(year) ? `${year.slice(0, 4)}-01-01` : null,
        year ? `Assessment roll ${year}` : "Assessment roll",
        joinParts([
          market ? `Market $${money0(market)}` : "",
          assessed ? `Assessed $${money0(assessed)}` : "",
          r.taxclass ? `Tax class ${r.taxclass}` : "",
        ]),
        titleCase(r.bldgcl ?? "") || "DOF",
        "neutral",
        { year, market, assessed, owner: titleCase(r.owner) },
      ),
    );
  }
  return [bydateDesc(items), err];
};

export const DATASETS: { key: string; label: string; source: string; fetch: Fetcher }[] = [
  { key: "hpd_violations", label: "HPD Violations", source: "wvxf-dwi5", fetch: fetchHpdViolations },
  { key: "hpd_complaints", label: "HPD Complaints", source: "ygpa-z7cr", fetch: fetchHpdComplaints },
  { key: "dob_violations", label: "DOB Violations", source: "3h2n-5cm9", fetch: fetchDobViolations },
  { key: "ecb_violations", label: "OATH / ECB Violations", source: "6bgk-3dad", fetch: fetchEcbViolations },
  { key: "dob_complaints", label: "DOB Complaints", source: "eabe-havv", fetch: fetchDobComplaints },
  { key: "c311", label: "311 Service Requests", source: "erm2-nwe9", fetch: fetch311 },
  { key: "registration", label: "HPD Registration", source: "tesw-yqqr", fetch: fetchRegistration },
  { key: "boiler", label: "Boiler Inspections", source: "52dp-yji6", fetch: fetchBoiler },
  { key: "facades", label: "Facade Filings (FISP)", source: "xubg-57si", fetch: fetchFacades },
  { key: "bedbugs", label: "Bedbug Filings", source: "wz6d-d3jb", fetch: fetchBedbugs },
  { key: "litigation", label: "HPD Litigation", source: "59kj-x8nc", fetch: fetchLitigation },
  { key: "valuation", label: "DOF Valuation", source: "yjxr-fw8i", fetch: fetchValuation },
];

export type DatasetResult = {
  key: string;
  label: string;
  source: string;
  items: NycItem[];
  count: number;
  error: string | null;
  fetched_at: string;
};

async function fetchOne(env: NycEnv, ds: (typeof DATASETS)[number], building: Dict): Promise<DatasetResult> {
  const c = ctxOf(building);
  let items: NycItem[] = [];
  let err: string | null = null;
  try {
    [items, err] = await ds.fetch(env, c);
  } catch (e: any) {
    // a single dataset must never sink the sync
    items = [];
    err = `${e?.name || "Error"}: ${String(e?.message ?? e).slice(0, 220)}`;
  }
  return {
    key: ds.key,
    label: ds.label,
    source: ds.source,
    items: items.slice(0, 250),
    count: items.length,
    error: err,
    fetched_at: new Date().toISOString(),
  };
}

export async function fetchAll(env: NycEnv, building: Dict): Promise<DatasetResult[]> {
  return Promise.all(DATASETS.map((ds) => fetchOne(env, ds, building)));
}

// ---------------------------------------------------------------- summary
export function computeSummary(datasets: Record<string, DatasetResult | undefined>): Dict {
  const items = (key: string): NycItem[] => datasets[key]?.items ?? [];

  const hpd = items("hpd_violations");
  const byClass: Record<string, number> = { A: 0, B: 0, C: 0, I: 0 };
  for (const v of hpd) {
    if (v.extra.open) {
      const k = v.extra.class;
      if (k in byClass) byClass[k] += 1;
    }
  }
  const hpdOpen = Object.values(byClass).reduce((a, b) => a + b, 0);

  const today = todayISO();
  const soon = addDaysISO(14);

  const reg = items("registration");
  const regCurrent = reg.some((r) => r.extra.current);
  const regEnd = reg.reduce((acc, r) => ((r.extra.end || "") > acc ? r.extra.end : acc), "") || null;

  const boiler = items("boiler");
  const boilerLast = boiler.length ? boiler[0].date : null;
  let boilerDue: string | null = null;
  if (boilerLast && /^\d{4}-\d{2}-\d{2}$/.test(boilerLast)) {
    boilerDue = addDaysISO(365, boilerLast);
  }

  const facades = items("facades");
  const valuation = items("valuation");
  const val = valuation.length ? valuation[0].extra : {};

  const ecbOpen = items("ecb_violations").filter((v) => v.extra.open);
  const urgent =
    byClass.C +
    byClass.I +
    ecbOpen.filter((v) => v.extra.hearing_date && today <= v.extra.hearing_date && v.extra.hearing_date <= soon).length +
    (regCurrent || !reg.length ? 0 : 1);

  const recentFloor = addDaysISO(-90);
  const bedbugs = items("bedbugs");

  return {
    hpd_open: hpdOpen,
    hpd_by_class: byClass,
    hpd_total: datasets.hpd_violations?.count ?? 0,
    hpd_complaints_open: items("hpd_complaints").filter((x) => x.extra.open).length,
    dob_active: items("dob_violations").filter((x) => x.extra.open).length,
    dob_complaints_active: items("dob_complaints").filter((x) => x.extra.open).length,
    ecb_active: ecbOpen.length,
    ecb_balance: Math.round(ecbOpen.reduce((a, v) => a + (v.extra.balance || 0), 0)),
    c311_open: items("c311").filter((x) => x.extra.open).length,
    c311_recent: items("c311").filter((x) => (x.date || "") >= recentFloor).length,
    litigation_open: items("litigation").filter((x) => x.extra.open).length,
    registration_current: regCurrent,
    registration_end: regEnd,
    boiler_last: boilerLast,
    boiler_due: boilerDue,
    facade_status: facades.length ? facades[0].extra.status : null,
    facade_cycle: facades.length ? facades[0].extra.cycle : null,
    bedbug_infested: bedbugs.length ? bedbugs[0].extra.infested : null,
    market_value: val.market ?? null,
    assessed_value: val.assessed ?? null,
    urgent,
  };
}
