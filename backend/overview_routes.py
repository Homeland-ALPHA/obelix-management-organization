"""Building command center, computed notification center, global search."""
import re
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from pymongo import UpdateOne

from db import db
from finance_routes import financial_summary
from security import get_current_user

router = APIRouter(tags=["overview"])

WO_DONE = {"Completed", "Inspected", "Closed"}


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


async def _attention(user, ids, buildings, tenants, wos, expenses, loans, vendors, nyc, rentroll_balances):
    """Build the prioritized attention/notification list. Returns list of dicts."""
    today = date.today().isoformat()
    soon14 = (date.today() + timedelta(days=14)).isoformat()
    soon30 = (date.today() + timedelta(days=30)).isoformat()
    soon90 = (date.today() + timedelta(days=90)).isoformat()
    bname = lambda i: (buildings.get(i) or {}).get("label", "")
    items = []

    def add(key, priority, title, sub, building_id, due, status, tab, action):
        items.append(
            {
                "key": key,
                "priority": priority,  # 1 emergency, 2 overdue/urgent, 3 waiting, 4 upcoming
                "title": title,
                "sub": sub,
                "building_id": building_id,
                "building": bname(building_id),
                "due": due,
                "status": status,
                "tab": tab,
                "action": action,
            }
        )

    for w in wos:
        if w.get("status") in WO_DONE:
            continue
        if w.get("emergency") or w.get("priority") == "emergency":
            add(f"wo-em-{w['id']}", 1, f"Emergency · {w.get('title')}", f"Assigned to {w.get('assignee') or '—'}",
                w.get("building_id"), w.get("target_date"), w.get("status"), "work-orders", "Dispatch and resolve now")
        elif w.get("target_date") and w["target_date"] < today:
            add(f"wo-over-{w['id']}", 2, f"Overdue work order · {w.get('title')}", f"Assigned to {w.get('assignee') or '—'}",
                w.get("building_id"), w["target_date"], w.get("status"), "work-orders", "Reschedule or reassign")
        elif w.get("status") == "Approval Required":
            add(f"wo-appr-{w['id']}", 3, f"Approval waiting · {w.get('title')}",
                f"Estimated ${_f(w.get('est_cost')):,.0f} · {w.get('assignee') or 'unassigned'}",
                w.get("building_id"), (w.get("approval") or {}).get("deadline"), "Awaiting Approval", "work-orders", "Approve or decline")

    for e in expenses:
        if e.get("approval_status") == "pending":
            add(f"exp-appr-{e['id']}", 3, f"Invoice awaiting approval · {(e.get('category') or '').replace('_', ' ')}",
                f"${_f(e.get('amount')):,.0f}", e.get("building_id"), e.get("due_date"), "Awaiting Approval",
                "financials", "Approve or decline")
        elif e.get("status") == "unpaid" and e.get("due_date") and e["due_date"] < today:
            add(f"exp-over-{e['id']}", 2, f"Unpaid vendor invoice · {(e.get('category') or '').replace('_', ' ')}",
                f"${_f(e.get('amount')):,.0f}", e.get("building_id"), e["due_date"], "Overdue", "financials", "Pay or dispute")

    for t in tenants:
        bal = rentroll_balances.get(t["id"], 0)
        if bal > 0:
            add(f"arrears-{t['id']}", 2, f"Unpaid rent · {t.get('name')}", f"Balance ${bal:,.0f}",
                t.get("building_id"), None, "Overdue", "rent-roll", "Send arrears notice")
        le = t.get("lease_end")
        if le and today <= le <= soon90:
            add(f"lease-{t['id']}", 4, f"Lease expiring · {t.get('name')}", f"Ends {le}",
                t.get("building_id"), le, "Scheduled", "tenants", "Start renewal")

    for l in loans:
        np = l.get("next_payment_date")
        if np and np <= soon14:
            status = "Overdue" if np < today else "Scheduled"
            add(f"loan-{l['id']}", 2 if np < today else 4, f"Mortgage payment · {l.get('lender')}",
                f"${_f(l.get('monthly_payment')):,.0f} due {np}", l.get("building_id"), np, status,
                "financials", "Record payment")

    for v in vendors:
        for fld, label in (("insurance_exp", "Insurance"), ("license_exp", "License")):
            d = v.get(fld)
            if d and d <= soon30:
                add(f"vendor-{fld}-{v['id']}", 2 if d < today else 4, f"{label} expiring · {v.get('name')}",
                    f"{'Expired' if d < today else 'Expires'} {d}", None, d,
                    "Overdue" if d < today else "Scheduled", "vendors", "Request updated certificate")

    for row in nyc:
        bid = row["building_id"]
        if row["key"] == "hpd_violations":
            for it in row.get("items", []):
                e = it.get("extra") or {}
                if e.get("open") and e.get("class") in ("C", "I"):
                    overdue = bool(e.get("correct_by") and e["correct_by"] < today)
                    add(f"viol-{it['id']}", 2, f"Class {e.get('class')} violation · {it['title'][:90]}",
                        f"Correct by {e.get('correct_by') or '—'}", bid, e.get("correct_by"),
                        "Overdue" if overdue else "Urgent", "compliance", "Create work order and certify")
        if row["key"] == "ecb_violations":
            for it in row.get("items", []):
                e = it.get("extra") or {}
                if e.get("open") and e.get("hearing_date") and today <= e["hearing_date"] <= soon30:
                    add(f"hearing-{it['id']}", 4, f"OATH hearing · {it['title'][:90]}", f"Hearing {e['hearing_date']}",
                        bid, e["hearing_date"], "Scheduled", "compliance", "Prepare hearing response")
        if row.get("error"):
            add(f"sync-{bid}-{row['key']}", 3, f"Data sync issue · {row['label']}", str(row["error"])[:120],
                bid, None, "Awaiting Review", "compliance", "Refresh the source")

    for b in buildings.values():
        s = b.get("summary") or {}
        if b.get("hpd_building_id") and not s.get("registration_current"):
            add(f"reg-{b['id']}", 2, "HPD registration lapsed", f"Expired {s.get('registration_end') or '—'}",
                b["id"], None, "Overdue", "compliance", "Refile registration")
        if s.get("boiler_due") and s["boiler_due"] < today:
            add(f"boiler-{b['id']}", 2, "Annual boiler inspection overdue", f"Was due {s['boiler_due']}",
                b["id"], s["boiler_due"], "Overdue", "compliance", "Schedule inspection")

    items.sort(key=lambda x: (x["priority"], x["due"] or "9999"))
    return items


async def _load_all(user, ids):
    q = {"user_id": user["id"], "building_id": {"$in": ids}}
    tenants = await db.tenants.find(q, {"_id": 0}).to_list(5000)
    wos = await db.work_orders.find(q, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find(q, {"_id": 0}).to_list(5000)
    loans = await db.loans.find(q, {"_id": 0}).to_list(500)
    revenue = await db.revenue.find(q, {"_id": 0}).to_list(5000)
    vendors = await db.vendors.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    nyc = await db.nyc_data.find({"building_id": {"$in": ids}}, {"_id": 0}).to_list(5000)
    balances = defaultdict(float)
    for r in revenue:
        if r.get("tenant_id"):
            balances[r["tenant_id"]] += max(_f(r.get("expected")) - _f(r.get("received")), 0)
    return tenants, wos, expenses, loans, vendors, nyc, balances


@router.get("/overview")
async def overview(building_id: str = Query(default="portfolio"), user: dict = Depends(get_current_user)):
    blist = await db.buildings.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(200)
    buildings = {b["id"]: b for b in blist}
    ids = [building_id] if building_id != "portfolio" and building_id in buildings else list(buildings)

    tenants, wos, expenses, loans, vendors, nyc, balances = await _load_all(user, ids)
    fin = await financial_summary(building_id, user)
    attention = await _attention(user, ids, buildings, tenants, wos, expenses, loans, vendors, nyc, balances)
    if building_id != "portfolio":
        attention = [a for a in attention if a["building_id"] in (building_id, None)]

    activity = await db.activity.find(
        {"user_id": user["id"], **({"building_id": building_id} if building_id != "portfolio" else {})},
        {"_id": 0, "user_id": 0},
    ).sort("at", -1).to_list(20)

    hpd_open = sum((b.get("summary") or {}).get("hpd_open") or 0 for i, b in buildings.items() if i in ids)
    hpd_total = sum((b.get("summary") or {}).get("hpd_total") or 0 for i, b in buildings.items() if i in ids)
    emergencies = len([w for w in wos if (w.get("emergency") or w.get("priority") == "emergency") and w.get("status") not in WO_DONE])
    approvals = len([w for w in wos if w.get("status") == "Approval Required"]) + len(
        [e for e in expenses if e.get("approval_status") == "pending"]
    )

    dof = None
    if building_id != "portfolio":
        b = buildings.get(building_id) or {}
        s = b.get("summary") or {}
        val_rows = next((r for r in nyc if r["building_id"] == building_id and r["key"] == "valuation"), None)
        year = None
        if val_rows and val_rows.get("items"):
            year = (val_rows["items"][0].get("extra") or {}).get("year")
        dof = {
            "value": s.get("market_value"),
            "assessed": s.get("assessed_value"),
            "tax_year": year,
            "synced_at": b.get("last_synced"),
            "source": "NYC DOF assessment roll",
        }
    else:
        total = sum((b.get("summary") or {}).get("market_value") or 0 for b in buildings.values())
        dof = {"value": total or None, "assessed": None, "tax_year": None,
               "synced_at": max((b.get("last_synced") or "" for b in buildings.values()), default=None) or None,
               "source": "NYC DOF assessment roll"}

    return {
        "mode": "portfolio" if building_id == "portfolio" else "building",
        "buildings_count": len(ids),
        "financial": fin,
        "hpd_open": hpd_open,
        "hpd_cleared": max(hpd_total - hpd_open, 0),
        "emergencies": emergencies,
        "approvals_waiting": approvals,
        "dof": dof,
        "attention": attention[:25],
        "attention_total": len(attention),
        "activity": activity,
    }


@router.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    blist = await db.buildings.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(200)
    buildings = {b["id"]: b for b in blist}
    ids = list(buildings)
    tenants, wos, expenses, loans, vendors, nyc, balances = await _load_all(user, ids)
    items = await _attention(user, ids, buildings, tenants, wos, expenses, loans, vendors, nyc, balances)
    dismissed = {d["key"] async for d in db.dismissed.find({"user_id": user["id"]})}
    for it in items:
        it["read"] = it["key"] in dismissed
    unread = len([i for i in items if not i["read"]])
    return {"items": items[:50], "unread": unread}


@router.post("/notifications/dismiss")
async def dismiss_notification(payload: dict, user: dict = Depends(get_current_user)):
    key = payload.get("key")
    if key:
        await db.dismissed.update_one(
            {"user_id": user["id"], "key": key}, {"$set": {"user_id": user["id"], "key": key}}, upsert=True
        )
    return {"ok": True}


@router.post("/notifications/dismiss-all")
async def dismiss_all_notifications(user: dict = Depends(get_current_user)):
    """Mark every current notification read by dismissing all attention keys."""
    blist = await db.buildings.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(200)
    buildings = {b["id"]: b for b in blist}
    ids = list(buildings)
    tenants, wos, expenses, loans, vendors, nyc, balances = await _load_all(user, ids)
    items = await _attention(user, ids, buildings, tenants, wos, expenses, loans, vendors, nyc, balances)
    if items:
        await db.dismissed.bulk_write(
            [
                UpdateOne(
                    {"user_id": user["id"], "key": it["key"]},
                    {"$set": {"user_id": user["id"], "key": it["key"]}},
                    upsert=True,
                )
                for it in items
            ]
        )
    return {"ok": True, "dismissed": len(items)}


@router.get("/search")
async def global_search(q: str = Query(min_length=2, max_length=80), user: dict = Depends(get_current_user)):
    rx = {"$regex": re.escape(q), "$options": "i"}
    uid = user["id"]
    buildings = {b["id"]: b for b in await db.buildings.find({"user_id": uid}, {"_id": 0}).to_list(200)}
    bname = lambda i: (buildings.get(i) or {}).get("label", "")
    out = []

    for b in buildings.values():
        if re.search(re.escape(q), f"{b.get('label', '')} {b.get('street', '')} {b.get('bbl', '')}", re.I):
            out.append({"type": "building", "id": b["id"], "label": b["label"], "sub": b.get("borough", ""), "building_id": b["id"]})

    for t in await db.tenants.find({"user_id": uid, "name": rx}, {"_id": 0}).to_list(8):
        out.append({"type": "tenant", "id": t["id"], "label": t["name"], "sub": bname(t.get("building_id")), "building_id": t.get("building_id")})

    for u in await db.units.find({"user_id": uid, "number": rx}, {"_id": 0}).to_list(8):
        out.append({"type": "unit", "id": u["id"], "label": f"Unit {u.get('number')}", "sub": bname(u.get("building_id")), "building_id": u.get("building_id")})

    for w in await db.work_orders.find({"user_id": uid, "title": rx}, {"_id": 0}).to_list(8):
        out.append({"type": "work_order", "id": w["id"], "label": w.get("title"), "sub": f"{w.get('status')} · {bname(w.get('building_id'))}", "building_id": w.get("building_id")})

    for v in await db.vendors.find({"user_id": uid, "name": rx}, {"_id": 0}).to_list(8):
        out.append({"type": "vendor", "id": v["id"], "label": v.get("name"), "sub": v.get("category", ""), "building_id": None})

    for d in await db.documents.find({"user_id": uid, "name": rx}, {"_id": 0, "path": 0}).to_list(8):
        out.append({"type": "document", "id": d["id"], "label": d.get("name"), "sub": bname(d.get("building_id")), "building_id": d.get("building_id")})

    return {"results": out[:24]}
