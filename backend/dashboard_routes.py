from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends

from db import db
from security import get_current_user

router = APIRouter(tags=["dashboard"])


async def _portfolio(user_id: str):
    buildings = await db.buildings.find({"user_id": user_id}, {"_id": 0, "user_id": 0}).to_list(200)
    ids = [b["id"] for b in buildings]
    data = await db.nyc_data.find({"building_id": {"$in": ids}}, {"_id": 0}).to_list(5000)
    by_building = defaultdict(dict)
    for row in data:
        by_building[row["building_id"]][row["key"]] = row
    return buildings, by_building


def _month_key(iso):
    return iso[:7] if iso else None


@router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    buildings, by_building = await _portfolio(user["id"])
    today = date.today().isoformat()
    soon = (date.today() + timedelta(days=30)).isoformat()

    units = 0
    market_value = 0.0
    open_by_class = {"A": 0, "B": 0, "C": 0, "I": 0}
    totals = {"hpd_open": 0, "dob_active": 0, "ecb_active": 0, "complaints_open": 0, "urgent": 0}
    priorities = []
    trend_opened = defaultdict(int)
    trend_cleared = defaultdict(int)
    last_synced = None

    for b in buildings:
        s = b.get("summary") or {}
        p = b.get("profile") or {}
        units += p.get("units_res") or b.get("legal_units") or 0
        market_value += s.get("market_value") or 0
        for k in open_by_class:
            open_by_class[k] += (s.get("hpd_by_class") or {}).get(k, 0)
        totals["hpd_open"] += s.get("hpd_open") or 0
        totals["dob_active"] += s.get("dob_active") or 0
        totals["ecb_active"] += s.get("ecb_active") or 0
        totals["complaints_open"] += (s.get("hpd_complaints_open") or 0) + (s.get("c311_open") or 0)
        totals["urgent"] += s.get("urgent") or 0
        if b.get("last_synced") and (last_synced is None or b["last_synced"] > last_synced):
            last_synced = b["last_synced"]

        ds = by_building.get(b["id"], {})

        # --- trend: HPD violations opened / cleared by month (last 12 months)
        for v in (ds.get("hpd_violations") or {}).get("items", []):
            mk = _month_key(v.get("date"))
            if mk:
                trend_opened[mk] += 1
            if not v["extra"].get("open"):
                ck = _month_key(v["extra"].get("status_date"))
                if ck:
                    trend_cleared[ck] += 1

        # --- priorities
        for v in (ds.get("hpd_violations") or {}).get("items", []):
            e = v["extra"]
            if e.get("open") and e.get("class") in ("C", "I"):
                due = e.get("correct_by")
                overdue = bool(due and due < today)
                priorities.append(
                    {
                        "sort": due or "9999",
                        "title": f"Class {e['class']} · {v['title']}",
                        "building": b["label"],
                        "building_id": b["id"],
                        "when": f"Correct by {due}" if due else "No correction date",
                        "status": "Overdue" if overdue else "Urgent",
                    }
                )
        for v in (ds.get("ecb_violations") or {}).get("items", []):
            e = v["extra"]
            hd = e.get("hearing_date")
            if e.get("open") and hd and today <= hd <= soon:
                priorities.append(
                    {
                        "sort": hd,
                        "title": f"OATH hearing · {v['title']}",
                        "building": b["label"],
                        "building_id": b["id"],
                        "when": f"Hearing {hd}",
                        "status": "Scheduled",
                    }
                )
        if not s.get("registration_current") and b.get("hpd_building_id"):
            priorities.append(
                {
                    "sort": "0000",
                    "title": "HPD registration not current",
                    "building": b["label"],
                    "building_id": b["id"],
                    "when": f"Expired {s.get('registration_end')}" if s.get("registration_end") else "No active registration",
                    "status": "Overdue",
                }
            )
        bd = s.get("boiler_due")
        if bd and bd < today:
            priorities.append(
                {
                    "sort": bd,
                    "title": "Annual boiler inspection overdue",
                    "building": b["label"],
                    "building_id": b["id"],
                    "when": f"Was due {bd}",
                    "status": "Overdue",
                }
            )

    rank = {"Overdue": 0, "Urgent": 1, "Scheduled": 2}
    priorities.sort(key=lambda x: (rank.get(x["status"], 3), x["sort"]))

    months = []
    cur = date.today().replace(day=1)
    for _ in range(12):
        months.append(cur.isoformat()[:7])
        cur = (cur - timedelta(days=1)).replace(day=1)
    months.reverse()

    return {
        "tiles": {
            "buildings": len(buildings),
            "units": units,
            "open_violations": totals["hpd_open"],
            "urgent": totals["urgent"],
            "market_value": round(market_value),
        },
        "open_by_class": open_by_class,
        "totals": totals,
        "priorities": priorities[:12],
        "priorities_total": len(priorities),
        "trend": [
            {"month": m, "opened": trend_opened.get(m, 0), "cleared": trend_cleared.get(m, 0)}
            for m in months
        ],
        "buildings": [
            {
                "id": b["id"],
                "label": b["label"],
                "borough": b.get("borough"),
                "units": (b.get("profile") or {}).get("units_res") or b.get("legal_units"),
                "summary": b.get("summary") or {},
                "last_synced": b.get("last_synced"),
            }
            for b in buildings
        ],
        "last_synced": last_synced,
    }


@router.get("/compliance")
async def compliance(building_id: str = None, user: dict = Depends(get_current_user)):
    buildings, by_building = await _portfolio(user["id"])
    if building_id and building_id != "portfolio":
        buildings = [b for b in buildings if b["id"] == building_id]
    today = date.today()
    items = []

    def add(when, title, building, status, kind):
        items.append(
            {
                "date": when,
                "title": title,
                "building": building["label"],
                "building_id": building["id"],
                "status": status,
                "kind": kind,
            }
        )

    year = today.year
    bedbug_due = date(year, 12, 31).isoformat()
    benchmarking_due = (date(year, 5, 1) if today <= date(year, 5, 1) else date(year + 1, 5, 1)).isoformat()

    for b in buildings:
        s = b.get("summary") or {}
        p = b.get("profile") or {}
        ds = by_building.get(b["id"], {})

        # HPD annual registration
        if b.get("hpd_building_id"):
            end = s.get("registration_end")
            if s.get("registration_current"):
                add(end, "HPD annual registration renewal", b, "Scheduled", "Registration")
            else:
                add(today.isoformat(), "HPD registration lapsed — refile now", b, "Overdue", "Registration")

        # Boiler
        if s.get("boiler_due"):
            status = "Overdue" if s["boiler_due"] < today.isoformat() else "Scheduled"
            add(s["boiler_due"], "Annual boiler inspection (DOB NOW filing)", b, status, "Boiler")
        elif p.get("units_res") and (p.get("units_res") or 0) >= 6:
            add(None, "No boiler filing on record — confirm exemption", b, "Awaiting Review", "Boiler")

        # Facade (FISP) — buildings over 6 stories
        if (p.get("floors") or 0) > 6:
            fs = s.get("facade_status") or "No filing found"
            tone = "Overdue" if "unsafe" in fs.lower() else ("In Progress" if "swarmp" in fs.lower() else "Scheduled")
            add(None, f"FISP facade status: {fs} (cycle {s.get('facade_cycle') or '—'})", b, tone, "Facade")

        # Bedbug annual filing
        if b.get("hpd_building_id"):
            add(bedbug_due, "HPD annual bedbug report (Dec 1 – Dec 31)", b, "Scheduled", "Bedbug")

        # Benchmarking LL84/LL97
        if (p.get("bldg_area") or 0) > 25000:
            add(benchmarking_due, "LL84 energy benchmarking submission", b, "Scheduled", "Energy")

        # Open class C correction deadlines
        for v in (ds.get("hpd_violations") or {}).get("items", []):
            e = v["extra"]
            if e.get("open") and e.get("class") in ("C", "I") and e.get("correct_by"):
                status = "Overdue" if e["correct_by"] < today.isoformat() else "Urgent"
                add(e["correct_by"], f"Correct class {e['class']} violation · {v['title']}", b, status, "Violation")

        # Upcoming OATH hearings
        for v in (ds.get("ecb_violations") or {}).get("items", []):
            e = v["extra"]
            if e.get("open") and e.get("hearing_date") and e["hearing_date"] >= today.isoformat():
                add(e["hearing_date"], f"OATH hearing · {v['title']}", b, "Scheduled", "Hearing")

    dated = sorted([i for i in items if i["date"]], key=lambda x: x["date"])
    undated = [i for i in items if not i["date"]]
    return {"items": dated + undated}
