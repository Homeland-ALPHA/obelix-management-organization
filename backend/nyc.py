"""NYC Open Data (Socrata) client, dataset normalizers and building sync.

Every dataset is fetched live from data.cityofnewyork.us. Field names differ
per dataset and occasionally change, so each fetcher tries a list of candidate
$where filters and every normalizer reads fields defensively.
"""
import asyncio
import os
import re
from datetime import date, datetime, timedelta, timezone

import requests

SOCRATA_BASE = "https://data.cityofnewyork.us/resource"
GEOSEARCH_URL = "https://geosearch.planninglabs.nyc/v2/autocomplete"
APP_TOKEN = os.environ.get("NYC_APP_TOKEN", "")
TIMEOUT = 25

BORO_NAMES = {"1": "Manhattan", "2": "Bronx", "3": "Brooklyn", "4": "Queens", "5": "Staten Island"}


# ---------------------------------------------------------------- http helpers
def _headers():
    return {"X-App-Token": APP_TOKEN} if APP_TOKEN else {}


def soda_get(dataset: str, params: dict) -> list:
    r = requests.get(f"{SOCRATA_BASE}/{dataset}.json", params=params, headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    return data if isinstance(data, list) else []


def soda_try(dataset: str, where_candidates: list, order: str = None, limit: int = 250):
    """Try candidate $where filters until one returns rows. Returns (rows, error)."""
    last_err = None
    valid_but_empty = False
    for where in where_candidates:
        if not where:
            continue
        params = {"$limit": limit, "$where": where}
        if order:
            params["$order"] = order
        try:
            rows = soda_get(dataset, params)
            if rows:
                return rows, None
            valid_but_empty = True
        except Exception as e:
            last_err = f"{type(e).__name__}: {str(e)[:220]}"
            if order:
                # the order field may be the problem — retry once without it
                try:
                    rows = soda_get(dataset, {"$limit": limit, "$where": where})
                    if rows:
                        return rows, None
                    valid_but_empty = True
                except Exception as e2:
                    last_err = f"{type(e2).__name__}: {str(e2)[:220]}"
    if valid_but_empty:
        return [], None
    return [], last_err or "no filter candidates"


# ---------------------------------------------------------------- small utils
def parse_date(v):
    if not v:
        return None
    s = str(v).strip()
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y", "%Y%m%d"):
        try:
            return datetime.strptime(s[:26], fmt).date().isoformat()
        except ValueError:
            continue
    return None


def clip(text, n=220):
    if not text:
        return ""
    s = re.sub(r"\s+", " ", str(text)).strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def title_case(s):
    return re.sub(r"\s+", " ", str(s or "")).strip().title()


def bbl_parts(bbl):
    s = re.sub(r"\D", "", str(bbl or ""))
    if len(s) < 10:
        return None
    return s[0], s[1:6], s[6:10]  # boro, block (5), lot (4)


def item(id_, date_, title, sub="", badge="", tone="neutral", extra=None):
    return {
        "id": str(id_ or ""),
        "date": date_,
        "title": clip(title, 160),
        "sub": clip(sub, 160),
        "badge": badge,
        "tone": tone,  # urgent | warn | ok | neutral
        "extra": extra or {},
    }


def _sorted(items):
    return sorted(items, key=lambda x: x.get("date") or "0000", reverse=True)


# ---------------------------------------------------------------- geosearch
def geosearch(text: str, size: int = 6) -> list:
    r = requests.get(GEOSEARCH_URL, params={"text": text, "size": size}, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for f in r.json().get("features", []):
        p = f.get("properties", {})
        pad = (p.get("addendum") or {}).get("pad") or {}
        bbl = pad.get("bbl") or p.get("pad_bbl")
        bin_ = pad.get("bin") or p.get("pad_bin")
        if not bbl:
            continue
        out.append(
            {
                "label": p.get("label", ""),
                "housenumber": p.get("housenumber", ""),
                "street": p.get("street", ""),
                "borough": p.get("borough", ""),
                "zip": p.get("postalcode", ""),
                "bbl": str(bbl),
                "bin": str(bin_ or ""),
            }
        )
    return out


# ---------------------------------------------------------------- lookups used at creation
def pluto_profile(bbl: str) -> dict:
    try:
        rows = soda_get("64uk-42ks", {"$limit": 1, "$where": f"bbl={int(bbl)}"})
    except Exception:
        rows = []
    if not rows:
        return {}
    r = rows[0]

    def num(k):
        try:
            return int(float(r.get(k)))
        except (TypeError, ValueError):
            return None

    return {
        "units_res": num("unitsres"),
        "units_total": num("unitstotal"),
        "floors": num("numfloors"),
        "year_built": num("yearbuilt"),
        "building_class": r.get("bldgclass"),
        "owner": title_case(r.get("ownername")),
        "bldg_area": num("bldgarea"),
        "lot_area": num("lotarea"),
        "zipcode": r.get("zipcode"),
        "latitude": r.get("latitude"),
        "longitude": r.get("longitude"),
    }


def hpd_building_lookup(bin_: str, boro: str, block5: str, lot4: str) -> dict:
    candidates = []
    if bin_:
        candidates.append(f"bin='{bin_}'")
    if boro and block5 and lot4:
        candidates.append(f"boroid='{boro}' AND block='{int(block5)}' AND lot='{int(lot4)}'")
        candidates.append(f"boroid={int(boro)} AND block={int(block5)} AND lot={int(lot4)}")
    rows, _err = soda_try("kj4p-ruqc", candidates, limit=5)
    if not rows:
        return {}
    r = rows[0]

    def num(k):
        try:
            return int(float(r.get(k)))
        except (TypeError, ValueError):
            return None

    class_a = num("legalclassa") or 0
    class_b = num("legalclassb") or 0
    return {
        "hpd_building_id": str(r.get("buildingid") or ""),
        "registration_id": str(r.get("registrationid") or ""),
        "legal_stories": num("legalstories"),
        "legal_units": (class_a + class_b) or None,
        "hpd_lifecycle": r.get("lifecycle"),
    }


# ---------------------------------------------------------------- per-dataset fetchers
def _ctx(b: dict) -> dict:
    """Common query context derived from a building doc."""
    parts = bbl_parts(b.get("bbl"))
    boro, block5, lot4 = parts if parts else ("", "", "")
    addr = f"{b.get('housenumber', '')} {b.get('street', '')}".strip().upper()
    return {
        "bbl": re.sub(r"\D", "", str(b.get("bbl") or "")),
        "bin": str(b.get("bin") or ""),
        "boro": boro,
        "block5": block5,
        "lot4": lot4,
        "hpd_id": str(b.get("hpd_building_id") or ""),
        "addr": addr,
        "borough_name": b.get("borough", ""),
    }


def fetch_hpd_violations(c):
    rows, err = soda_try(
        "wvxf-dwi5",
        [f"bbl='{c['bbl']}'"],
        order="inspectiondate DESC",
    )
    items = []
    for r in rows:
        klass = (r.get("class") or "?").upper()
        is_open = (r.get("violationstatus") or "").lower() == "open"
        correct_by = parse_date(r.get("newcorrectbydate") or r.get("originalcorrectbydate"))
        tone = "neutral"
        if is_open:
            tone = "urgent" if klass in ("C", "I") else "warn"
        items.append(
            item(
                r.get("violationid"),
                parse_date(r.get("inspectiondate")),
                r.get("novdescription") or "HPD violation",
                sub=" · ".join(
                    x
                    for x in [
                        f"Class {klass}",
                        f"Apt {r.get('apartment')}" if r.get("apartment") else "",
                        f"Correct by {correct_by}" if (is_open and correct_by) else "",
                    ]
                    if x
                ),
                badge="Open" if is_open else "Cleared",
                tone=tone,
                extra={
                    "class": klass,
                    "open": is_open,
                    "correct_by": correct_by,
                    "apartment": clip(r.get("apartment"), 20),
                    "status_date": parse_date(r.get("currentstatusdate")),
                    "current_status": clip(r.get("currentstatus"), 60),
                },
            )
        )
    return _sorted(items), err


def fetch_hpd_complaints(c):
    rows, err = soda_try(
        "ygpa-z7cr",
        [
            f"bbl='{c['bbl']}'",
            f"buildingid='{c['hpd_id']}'" if c["hpd_id"] else "",
        ],
        order="receiveddate DESC",
    )
    items = []
    for r in rows:
        status = (r.get("complaintstatus") or r.get("problemstatus") or "").title()
        is_open = status.lower() == "open"
        cat = " / ".join(x for x in [title_case(r.get("majorcategory")), title_case(r.get("minorcategory"))] if x)
        items.append(
            item(
                r.get("problemid") or r.get("complaintid"),
                parse_date(r.get("receiveddate")),
                cat or "Housing complaint",
                sub=" · ".join(
                    x
                    for x in [
                        f"Apt {r.get('apartment')}" if r.get("apartment") else "",
                        title_case(r.get("unittype") or r.get("spacetype")),
                        clip(r.get("statusdescription"), 90),
                    ]
                    if x
                ),
                badge="Open" if is_open else (status or "Closed"),
                tone="warn" if is_open else "neutral",
                extra={"open": is_open},
            )
        )
    return _sorted(items), err


def fetch_dob_violations(c):
    rows, err = soda_try(
        "3h2n-5cm9",
        [f"bin='{c['bin']}'"] if c["bin"] else [],
        order="issue_date DESC",
    )
    items = []
    for r in rows:
        disposed = bool(r.get("disposition_date"))
        vtype = r.get("violation_type") or r.get("violation_category") or "DOB violation"
        items.append(
            item(
                r.get("isn_dob_bis_viol") or r.get("number"),
                parse_date(r.get("issue_date")),
                clip(vtype, 120),
                sub=" · ".join(
                    x
                    for x in [
                        f"No. {r.get('number')}" if r.get("number") else "",
                        clip(r.get("description"), 90),
                    ]
                    if x
                ),
                badge="Resolved" if disposed else "Active",
                tone="neutral" if disposed else "warn",
                extra={"open": not disposed},
            )
        )
    return _sorted(items), err


def fetch_ecb_violations(c):
    rows, err = soda_try(
        "6bgk-3dad",
        [f"bin='{c['bin']}'"] if c["bin"] else [],
        order="issue_date DESC",
    )
    items = []
    for r in rows:
        status = (r.get("ecb_violation_status") or "").title()
        is_active = status.lower() == "active"
        hearing = parse_date(r.get("hearing_date"))
        try:
            balance = float(r.get("balance_due"))
        except (TypeError, ValueError):
            balance = 0.0
        items.append(
            item(
                r.get("ecb_violation_number"),
                parse_date(r.get("issue_date")),
                clip(r.get("violation_description") or r.get("violation_type") or "ECB violation", 130),
                sub=" · ".join(
                    x
                    for x in [
                        title_case(r.get("severity")),
                        f"Hearing {hearing}" if hearing else "",
                        f"Balance ${balance:,.0f}" if balance else "",
                    ]
                    if x
                ),
                badge=status or "Unknown",
                tone="warn" if is_active else "neutral",
                extra={"open": is_active, "hearing_date": hearing, "hearing_status": title_case(r.get("hearing_status")), "balance": balance},
            )
        )
    return _sorted(items), err


def fetch_dob_complaints(c):
    rows, err = soda_try(
        "eabe-havv",
        [f"bin='{c['bin']}'"] if c["bin"] else [],
    )
    items = []
    for r in rows:
        status = (r.get("status") or "").title()
        is_open = "active" in status.lower()
        items.append(
            item(
                r.get("complaint_number"),
                parse_date(r.get("date_entered")),
                f"Complaint category {r.get('complaint_category') or '?'}",
                sub=" · ".join(
                    x
                    for x in [
                        f"Priority {r.get('priority')}" if r.get("priority") else "",
                        f"Inspected {parse_date(r.get('inspection_date'))}" if r.get("inspection_date") else "",
                    ]
                    if x
                ),
                badge=status or "Unknown",
                tone="warn" if is_open else "neutral",
                extra={"open": is_open},
            )
        )
    return _sorted(items), err


def fetch_311(c):
    floor = (date.today() - timedelta(days=730)).isoformat()
    base = f"created_date > '{floor}'"
    candidates = [f"bbl='{c['bbl']}' AND {base}"]
    if c["addr"] and c["borough_name"]:
        candidates.append(f"upper(incident_address)='{c['addr']}' AND upper(borough)='{c['borough_name'].upper()}' AND {base}")
    rows, err = soda_try("erm2-nwe9", candidates, order="created_date DESC", limit=150)
    items = []
    for r in rows:
        status = (r.get("status") or "").title()
        is_open = status.lower() in ("open", "in progress", "pending", "assigned", "started")
        items.append(
            item(
                r.get("unique_key"),
                parse_date(r.get("created_date")),
                clip(r.get("complaint_type") or "311 request", 90),
                sub=" · ".join(
                    x
                    for x in [clip(r.get("descriptor"), 80), (r.get("agency") or "").upper()]
                    if x
                ),
                badge=status or "Unknown",
                tone="warn" if is_open else "neutral",
                extra={"open": is_open},
            )
        )
    return _sorted(items), err


def fetch_registration(c):
    candidates = []
    if c["bin"]:
        candidates.append(f"bin='{c['bin']}'")
    if c["boro"] and c["block5"] and c["lot4"]:
        candidates.append(f"boroid='{c['boro']}' AND block='{int(c['block5'])}' AND lot='{int(c['lot4'])}'")
        candidates.append(f"boroid={int(c['boro'])} AND block={int(c['block5'])} AND lot={int(c['lot4'])}")
    rows, err = soda_try("tesw-yqqr", candidates, limit=10)
    items = []
    for r in rows:
        end = parse_date(r.get("registrationenddate"))
        current = bool(end and end >= date.today().isoformat())
        items.append(
            item(
                r.get("registrationid"),
                parse_date(r.get("lastregistrationdate")),
                f"HPD registration #{r.get('registrationid')}",
                sub=f"Expires {end}" if end else "",
                badge="Current" if current else "Expired",
                tone="ok" if current else "urgent",
                extra={"end": end, "current": current},
            )
        )
    return _sorted(items), err


def fetch_boiler(c):
    rows, err = soda_try(
        "52dp-yji6",
        [f"bin_number='{c['bin']}'"] if c["bin"] else [],
        limit=100,
    )
    items = []
    for r in rows:
        insp = parse_date(r.get("inspection_date"))
        defects = (r.get("defects_exist") or "").strip().lower() in ("yes", "true", "y")
        items.append(
            item(
                r.get("tracking_number"),
                insp,
                f"Boiler {r.get('boiler_id') or ''} · {title_case(r.get('inspection_type') or r.get('report_type') or 'inspection')}",
                sub=" · ".join(
                    x
                    for x in [
                        title_case(r.get("boiler_make")),
                        title_case(r.get("pressure_type")),
                        f"Status {title_case(r.get('report_status'))}" if r.get("report_status") else "",
                    ]
                    if x
                ),
                badge="Defects" if defects else "No defects",
                tone="warn" if defects else "ok",
                extra={"defects": defects},
            )
        )
    return _sorted(items), err


def fetch_facades(c):
    rows, err = soda_try(
        "xubg-57si",
        [f"bin='{c['bin']}'"] if c["bin"] else [],
        limit=50,
    )
    items = []
    for r in rows:
        status = title_case(r.get("filing_status") or r.get("current_status") or "Filed")
        unsafe = "unsafe" in status.lower()
        swarmp = "swarmp" in status.lower()
        items.append(
            item(
                r.get("tr6_no") or r.get("control_no"),
                parse_date(r.get("submitted_on") or r.get("filing_date")),
                f"FISP cycle {r.get('cycle') or '?'} · {title_case(r.get('filing_type') or 'filing')}",
                sub=clip(r.get("comments"), 90),
                badge=status,
                tone="urgent" if unsafe else ("warn" if swarmp else "ok"),
                extra={"status": status, "cycle": r.get("cycle")},
            )
        )
    return _sorted(items), err


def fetch_bedbugs(c):
    candidates = [f"bbl='{c['bbl']}'"]
    if c["hpd_id"]:
        candidates.append(f"building_id='{c['hpd_id']}'")
        candidates.append(f"building_id={int(c['hpd_id'])}" if c["hpd_id"].isdigit() else "")
    rows, err = soda_try("wz6d-d3jb", candidates, limit=30)
    items = []
    for r in rows:
        def num(k):
            try:
                return int(float(r.get(k)))
            except (TypeError, ValueError):
                return 0

        infested = num("infested_dwelling_unit_count")
        period_end = parse_date(r.get("filling_period_end_date") or r.get("filing_period_end_date"))
        items.append(
            item(
                r.get("registration_id"),
                parse_date(r.get("filing_date")) or period_end,
                f"Annual bedbug filing · {infested} infested unit{'s' if infested != 1 else ''}",
                sub=f"Period ends {period_end}" if period_end else "",
                badge="Infestation" if infested else "Filed",
                tone="warn" if infested else "ok",
                extra={"infested": infested},
            )
        )
    return _sorted(items), err


def fetch_litigation(c):
    candidates = [f"bbl='{c['bbl']}'"]
    if c["hpd_id"]:
        candidates.append(f"buildingid='{c['hpd_id']}'")
    rows, err = soda_try("59kj-x8nc", candidates, limit=100)
    items = []
    for r in rows:
        status = title_case(r.get("casestatus"))
        is_open = "closed" not in status.lower() if status else False
        items.append(
            item(
                r.get("litigationid"),
                parse_date(r.get("caseopendate")),
                title_case(r.get("casetype") or "HPD litigation"),
                sub=" · ".join(
                    x
                    for x in [
                        clip(title_case(r.get("respondent")), 60),
                        f"Penalty {r.get('penalty')}" if r.get("penalty") else "",
                        "Open judgement" if (r.get("openjudgement") or "").lower() == "yes" else "",
                    ]
                    if x
                ),
                badge=status or "Unknown",
                tone="warn" if is_open else "neutral",
                extra={"open": is_open},
            )
        )
    return _sorted(items), err


def fetch_valuation(c):
    candidates = []
    if c["bbl"]:
        candidates.append(f"bble='{c['bbl']}'")
    if c["boro"] and c["block5"] and c["lot4"]:
        candidates.append(f"boro='{c['boro']}' AND block='{int(c['block5'])}' AND lot='{int(c['lot4'])}'")
        candidates.append(f"boro={int(c['boro'])} AND block={int(c['block5'])} AND lot={int(c['lot4'])}")
    rows, err = soda_try("yjxr-fw8i", candidates, limit=40)

    def money(r, *keys):
        for k in keys:
            try:
                v = float(r.get(k))
                if v > 0:
                    return v
            except (TypeError, ValueError):
                continue
        return None

    items = []
    for r in rows:
        year = str(r.get("year") or r.get("yr") or "")
        market = money(r, "fullval", "curmktval", "curmkttot", "pymktval")
        assessed = money(r, "avtot", "curavt_act", "curtxbtot")
        items.append(
            item(
                f"{year}-{r.get('bble') or ''}",
                f"{year[:4]}-01-01" if year[:4].isdigit() else None,
                f"Assessment roll {year}" if year else "Assessment roll",
                sub=" · ".join(
                    x
                    for x in [
                        f"Market ${market:,.0f}" if market else "",
                        f"Assessed ${assessed:,.0f}" if assessed else "",
                        f"Tax class {r.get('taxclass')}" if r.get("taxclass") else "",
                    ]
                    if x
                ),
                badge=title_case(r.get("bldgcl") or "") or "DOF",
                tone="neutral",
                extra={"year": year, "market": market, "assessed": assessed, "owner": title_case(r.get("owner"))},
            )
        )
    return _sorted(items), err


DATASETS = [
    {"key": "hpd_violations", "label": "HPD Violations", "source": "wvxf-dwi5", "fetch": fetch_hpd_violations},
    {"key": "hpd_complaints", "label": "HPD Complaints", "source": "ygpa-z7cr", "fetch": fetch_hpd_complaints},
    {"key": "dob_violations", "label": "DOB Violations", "source": "3h2n-5cm9", "fetch": fetch_dob_violations},
    {"key": "ecb_violations", "label": "OATH / ECB Violations", "source": "6bgk-3dad", "fetch": fetch_ecb_violations},
    {"key": "dob_complaints", "label": "DOB Complaints", "source": "eabe-havv", "fetch": fetch_dob_complaints},
    {"key": "c311", "label": "311 Service Requests", "source": "erm2-nwe9", "fetch": fetch_311},
    {"key": "registration", "label": "HPD Registration", "source": "tesw-yqqr", "fetch": fetch_registration},
    {"key": "boiler", "label": "Boiler Inspections", "source": "52dp-yji6", "fetch": fetch_boiler},
    {"key": "facades", "label": "Facade Filings (FISP)", "source": "xubg-57si", "fetch": fetch_facades},
    {"key": "bedbugs", "label": "Bedbug Filings", "source": "wz6d-d3jb", "fetch": fetch_bedbugs},
    {"key": "litigation", "label": "HPD Litigation", "source": "59kj-x8nc", "fetch": fetch_litigation},
    {"key": "valuation", "label": "DOF Valuation", "source": "yjxr-fw8i", "fetch": fetch_valuation},
]

DATASET_KEYS = [d["key"] for d in DATASETS]


def fetch_one(ds: dict, building: dict) -> dict:
    c = _ctx(building)
    try:
        items, err = ds["fetch"](c)
    except Exception as e:  # a single dataset must never sink the sync
        items, err = [], f"{type(e).__name__}: {str(e)[:220]}"
    return {
        "key": ds["key"],
        "label": ds["label"],
        "source": ds["source"],
        "items": items[:250],
        "count": len(items),
        "error": err,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


async def fetch_all(building: dict) -> list:
    return list(await asyncio.gather(*[asyncio.to_thread(fetch_one, ds, building) for ds in DATASETS]))


# ---------------------------------------------------------------- summary
def compute_summary(datasets: dict) -> dict:
    def items(key):
        return (datasets.get(key) or {}).get("items", [])

    hpd = items("hpd_violations")
    by_class = {"A": 0, "B": 0, "C": 0, "I": 0}
    for v in hpd:
        if v["extra"].get("open"):
            k = v["extra"].get("class")
            if k in by_class:
                by_class[k] += 1
    hpd_open = sum(by_class.values())

    today = date.today().isoformat()
    soon = (date.today() + timedelta(days=14)).isoformat()

    reg = items("registration")
    reg_current = any(r["extra"].get("current") for r in reg)
    reg_end = max((r["extra"].get("end") or "" for r in reg), default="") or None

    boiler = items("boiler")
    boiler_last = boiler[0]["date"] if boiler else None
    boiler_due = None
    if boiler_last:
        try:
            boiler_due = (date.fromisoformat(boiler_last) + timedelta(days=365)).isoformat()
        except ValueError:
            pass

    facades = items("facades")
    valuation = items("valuation")
    val = valuation[0]["extra"] if valuation else {}

    ecb_open = [v for v in items("ecb_violations") if v["extra"].get("open")]
    urgent = (
        by_class["C"]
        + by_class["I"]
        + len([v for v in ecb_open if v["extra"].get("hearing_date") and today <= v["extra"]["hearing_date"] <= soon])
        + (0 if reg_current or not reg else 1)
    )

    return {
        "hpd_open": hpd_open,
        "hpd_by_class": by_class,
        "hpd_total": (datasets.get("hpd_violations") or {}).get("count", 0),
        "hpd_complaints_open": len([x for x in items("hpd_complaints") if x["extra"].get("open")]),
        "dob_active": len([x for x in items("dob_violations") if x["extra"].get("open")]),
        "dob_complaints_active": len([x for x in items("dob_complaints") if x["extra"].get("open")]),
        "ecb_active": len(ecb_open),
        "ecb_balance": round(sum(v["extra"].get("balance") or 0 for v in ecb_open)),
        "c311_open": len([x for x in items("c311") if x["extra"].get("open")]),
        "c311_recent": len([x for x in items("c311") if (x.get("date") or "") >= (date.today() - timedelta(days=90)).isoformat()]),
        "litigation_open": len([x for x in items("litigation") if x["extra"].get("open")]),
        "registration_current": reg_current,
        "registration_end": reg_end,
        "boiler_last": boiler_last,
        "boiler_due": boiler_due,
        "facade_status": facades[0]["extra"].get("status") if facades else None,
        "facade_cycle": facades[0]["extra"].get("cycle") if facades else None,
        "bedbug_infested": items("bedbugs")[0]["extra"].get("infested") if items("bedbugs") else None,
        "market_value": val.get("market"),
        "assessed_value": val.get("assessed"),
        "urgent": urgent,
    }
