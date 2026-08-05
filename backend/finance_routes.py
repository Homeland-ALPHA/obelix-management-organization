"""Financial aggregates, chart series, rent roll and CSV reports."""
import csv
import io
from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from db import db
from security import get_current_user

router = APIRouter(tags=["financials"])

OPEX_EXCLUDED = {"mortgage_interest", "capital_improvements"}  # excluded from NOI opex


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _month(d):
    return (d or "")[:7]


async def _building_ids(user_id, building_id):
    if building_id and building_id != "portfolio":
        b = await db.buildings.find_one({"id": building_id, "user_id": user_id})
        if not b:
            raise HTTPException(status_code=404, detail="Building not found")
        return [building_id]
    rows = await db.buildings.find({"user_id": user_id}, {"id": 1}).to_list(200)
    return [r["id"] for r in rows]


async def _docs(coll, user_id, ids):
    return await db[coll].find({"user_id": user_id, "building_id": {"$in": ids}}, {"_id": 0}).to_list(5000)


AGING_BUCKETS = [
    ("current", "Current", 0),
    ("d1_30", "1 – 30 days", 30),
    ("d31_60", "31 – 60 days", 60),
    ("d61_90", "61 – 90 days", 90),
    ("d90_plus", "90+ days — housing court", None),
]


def _aging(revenue):
    """Split billed revenue into current vs. overdue balances by age.

    Anything received is current by definition; an unpaid balance ages from the
    date it was billed, so the buckets always sum back to total billed.
    """
    today = date.today()
    totals = {k: 0.0 for k, _, _ in AGING_BUCKETS}
    for r in revenue:
        expected, received = _f(r.get("expected")), _f(r.get("received"))
        totals["current"] += min(received, expected) if expected else received
        balance = max(expected - received, 0)
        if balance <= 0:
            continue
        try:
            days = (today - date.fromisoformat(str(r.get("date"))[:10])).days
        except (TypeError, ValueError):
            days = 0
        if days <= 0:
            totals["current"] += balance
        elif days <= 30:
            totals["d1_30"] += balance
        elif days <= 60:
            totals["d31_60"] += balance
        elif days <= 90:
            totals["d61_90"] += balance
        else:
            totals["d90_plus"] += balance

    grand = sum(totals.values())
    return {
        "total": round(grand, 2),
        "buckets": [
            {
                "key": key,
                "label": label,
                "amount": round(totals[key], 2),
                "pct": round(totals[key] / grand * 100, 1) if grand else 0.0,
                "overdue": key != "current",
            }
            for key, label, _cap in AGING_BUCKETS
        ],
    }


async def _noi_leader(user_id, ids):
    """Highest monthly NOI across the portfolio, for the leader callout."""
    this_month = date.today().isoformat()[:7]
    revenue = await _docs("revenue", user_id, ids)
    expenses = await _docs("expenses", user_id, ids)
    buildings = await db.buildings.find({"user_id": user_id, "id": {"$in": ids}}, {"_id": 0, "id": 1, "label": 1}).to_list(200)

    best = None
    for b in buildings:
        rev = sum(_f(r.get("received")) for r in revenue if r.get("building_id") == b["id"] and _month(r.get("date")) == this_month)
        opex = sum(
            _f(e.get("amount")) for e in expenses
            if e.get("building_id") == b["id"] and _month(e.get("invoice_date")) == this_month and e.get("category") not in OPEX_EXCLUDED
        )
        if not rev and not opex:
            continue
        noi = rev - opex
        if best is None or noi > best["noi"]:
            best = {"building_id": b["id"], "label": b.get("label"), "noi": round(noi, 2)}
    return best


@router.get("/financials/summary")
async def financial_summary(building_id: str = Query(default="portfolio"), user: dict = Depends(get_current_user)):
    ids = await _building_ids(user["id"], building_id)
    units = await _docs("units", user["id"], ids)
    tenants = await _docs("tenants", user["id"], ids)
    revenue = await _docs("revenue", user["id"], ids)
    expenses = await _docs("expenses", user["id"], ids)
    loans = await _docs("loans", user["id"], ids)

    this_month = date.today().isoformat()[:7]
    year_start = f"{date.today().year}-01"
    t12_start = (date.today() - timedelta(days=365)).isoformat()[:7]

    gpr = sum(_f(t.get("current_rent")) for t in tenants)
    collected_month = sum(_f(r.get("received")) for r in revenue if _month(r.get("date")) == this_month)
    expected_month = sum(_f(r.get("expected")) for r in revenue if _month(r.get("date")) == this_month) or gpr
    arrears = sum(max(_f(r.get("expected")) - _f(r.get("received")), 0) for r in revenue)

    opex_month = sum(
        _f(e.get("amount")) for e in expenses
        if _month(e.get("invoice_date")) == this_month and e.get("category") not in OPEX_EXCLUDED
    )
    opex_t12 = sum(
        _f(e.get("amount")) for e in expenses
        if _month(e.get("invoice_date")) >= t12_start and e.get("category") not in OPEX_EXCLUDED
    )
    rev_t12 = sum(_f(r.get("received")) for r in revenue if _month(r.get("date")) >= t12_start)
    capex_ytd = sum(
        _f(e.get("amount")) for e in expenses
        if e.get("category") == "capital_improvements" and _month(e.get("invoice_date")) >= year_start
    )

    debt_monthly = sum(_f(l.get("monthly_payment")) for l in loans)
    debt_balance = sum(_f(l.get("balance")) for l in loans)
    next_payment = min((l.get("next_payment_date") for l in loans if l.get("next_payment_date")), default=None)

    noi_month = collected_month - opex_month
    noi_t12 = rev_t12 - opex_t12
    dscr = round(noi_t12 / (debt_monthly * 12), 2) if debt_monthly else None

    occupied = len({t.get("unit_id") for t in tenants if t.get("unit_id")})
    total_units = len(units)

    ecount = len(revenue) + len(expenses)
    return {
        "has_data": bool(units or tenants or ecount),
        "aging": _aging(revenue),
        "noi_leader": await _noi_leader(user["id"], ids) if building_id == "portfolio" and len(ids) > 1 else None,
        "units": total_units,
        "occupied": occupied,
        "occupancy": round(occupied / total_units * 100, 1) if total_units else None,
        "gpr": gpr or None,
        "expected_month": expected_month or None,
        "collected_month": collected_month,
        "collection_rate": round(collected_month / expected_month * 100, 1) if expected_month else None,
        "arrears": arrears,
        "opex_month": opex_month,
        "capex_ytd": capex_ytd,
        "debt_monthly": debt_monthly or None,
        "debt_balance": debt_balance or None,
        "next_payment": next_payment,
        "noi_month": noi_month if (collected_month or opex_month) else None,
        "cash_flow_month": (noi_month - debt_monthly) if (collected_month or opex_month) and debt_monthly else None,
        "dscr": dscr,
        "cash_balance": None,  # banking not connected
    }


@router.get("/financials/series")
async def financial_series(
    building_id: str = Query(default="portfolio"),
    granularity: str = Query(default="month"),  # month | year
    months: int = Query(default=12, le=600),
    user: dict = Depends(get_current_user),
):
    ids = await _building_ids(user["id"], building_id)
    tenants = await _docs("tenants", user["id"], ids)
    revenue = await _docs("revenue", user["id"], ids)
    expenses = await _docs("expenses", user["id"], ids)
    budgets = await _docs("budgets", user["id"], ids)

    gpr = sum(_f(t.get("current_rent")) for t in tenants)
    budget_by_year = defaultdict(float)
    for b in budgets:
        for line in b.get("lines") or []:
            if line.get("kind") == "expense":
                budget_by_year[str(b.get("year"))] += _f(line.get("annual"))

    rev_by = defaultdict(lambda: {"expected": 0.0, "actual": 0.0})
    for r in revenue:
        k = _month(r.get("date"))
        if k:
            rev_by[k]["expected"] += _f(r.get("expected"))
            rev_by[k]["actual"] += _f(r.get("received"))
    exp_by = defaultdict(float)
    for e in expenses:
        k = _month(e.get("invoice_date"))
        if k:
            exp_by[k] += _f(e.get("amount"))

    out = []
    if granularity == "year":
        years = sorted({k[:4] for k in list(rev_by) + list(exp_by) if k} | set(budget_by_year))
        for y in years:
            actual_rev = sum(v["actual"] for k, v in rev_by.items() if k[:4] == y)
            expected_rev = sum(v["expected"] for k, v in rev_by.items() if k[:4] == y) or (gpr * 12 if gpr else 0)
            actual_exp = sum(v for k, v in exp_by.items() if k[:4] == y)
            out.append(
                {
                    "period": y,
                    "expected_revenue": round(expected_rev),
                    "actual_revenue": round(actual_rev),
                    "expected_expenses": round(budget_by_year.get(y, 0)),
                    "actual_expenses": round(actual_exp),
                    "noi": round(actual_rev - actual_exp),
                }
            )
    else:
        cur = date.today().replace(day=1)
        keys = []
        for _ in range(min(months, 240)):
            keys.append(cur.isoformat()[:7])
            cur = (cur - timedelta(days=1)).replace(day=1)
        keys.reverse()
        for k in keys:
            rv = rev_by.get(k, {"expected": 0.0, "actual": 0.0})
            expected_rev = rv["expected"] or gpr
            actual_exp = exp_by.get(k, 0.0)
            budget_month = budget_by_year.get(k[:4], 0) / 12
            out.append(
                {
                    "period": k,
                    "expected_revenue": round(expected_rev),
                    "actual_revenue": round(rv["actual"]),
                    "expected_expenses": round(budget_month),
                    "actual_expenses": round(actual_exp),
                    "noi": round(rv["actual"] - actual_exp),
                }
            )
    return {"series": out, "has_data": bool(revenue or expenses or tenants)}


@router.get("/rentroll")
async def rent_roll(building_id: str = Query(...), user: dict = Depends(get_current_user)):
    ids = await _building_ids(user["id"], building_id)
    units = await _docs("units", user["id"], ids)
    tenants = await _docs("tenants", user["id"], ids)
    revenue = await _docs("revenue", user["id"], ids)

    by_tenant = defaultdict(lambda: {"balance": 0.0, "last_payment": None})
    for r in revenue:
        tid = r.get("tenant_id")
        if not tid:
            continue
        by_tenant[tid]["balance"] += max(_f(r.get("expected")) - _f(r.get("received")), 0)
        if _f(r.get("received")) > 0:
            d = r.get("date")
            if d and (by_tenant[tid]["last_payment"] or "") < d:
                by_tenant[tid]["last_payment"] = d

    tenant_by_unit = {}
    for t in tenants:
        if t.get("unit_id"):
            tenant_by_unit[t["unit_id"]] = t

    rows = []
    for u in sorted(units, key=lambda x: str(x.get("number") or "")):
        t = tenant_by_unit.get(u["id"])
        bal = by_tenant.get(t["id"]) if t else None
        rows.append(
            {
                "unit_id": u["id"],
                "unit": u.get("number"),
                "status": "Occupied" if t else "Vacant",
                "tenant_id": t["id"] if t else None,
                "tenant": t.get("name") if t else None,
                "lease_start": t.get("lease_start") if t else None,
                "lease_end": t.get("lease_end") if t else None,
                "legal_rent": t.get("legal_rent") if t else None,
                "preferential_rent": t.get("preferential_rent") if t else None,
                "current_rent": t.get("current_rent") if t else None,
                "subsidy_amount": t.get("subsidy_amount") if t else None,
                "tenant_portion": t.get("tenant_portion") if t else None,
                "deposit": t.get("deposit") if t else None,
                "stabilized": t.get("stabilized") if t else None,
                "renewal_status": t.get("renewal_status") if t else None,
                "balance": round(bal["balance"], 2) if bal else 0,
                "last_payment": bal["last_payment"] if bal else None,
            }
        )
    # tenants with no unit assigned still appear
    for t in tenants:
        if not t.get("unit_id"):
            bal = by_tenant.get(t["id"])
            rows.append(
                {
                    "unit_id": None, "unit": "—", "status": "Occupied",
                    "tenant_id": t["id"], "tenant": t.get("name"),
                    "lease_start": t.get("lease_start"), "lease_end": t.get("lease_end"),
                    "legal_rent": t.get("legal_rent"), "preferential_rent": t.get("preferential_rent"),
                    "current_rent": t.get("current_rent"), "subsidy_amount": t.get("subsidy_amount"),
                    "tenant_portion": t.get("tenant_portion"), "deposit": t.get("deposit"),
                    "stabilized": t.get("stabilized"), "renewal_status": t.get("renewal_status"),
                    "balance": round(bal["balance"], 2) if bal else 0,
                    "last_payment": bal["last_payment"] if bal else None,
                }
            )
    return {"rows": rows}


# --------------------------------------------------------------- CSV reports
def _csv(headers, rows, filename):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(headers)
    w.writerows(rows)
    return Response(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/{kind}")
async def report(kind: str, building_id: str = Query(default="portfolio"), user: dict = Depends(get_current_user)):
    ids = await _building_ids(user["id"], building_id)
    buildings = {b["id"]: b for b in await db.buildings.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)}
    bname = lambda i: (buildings.get(i) or {}).get("label", "")

    if kind == "rent_roll":
        rr = await rent_roll(building_id, user) if ids else {"rows": []}
        rows = [
            [r["unit"], r["tenant"] or "", r["status"], r["lease_start"] or "", r["lease_end"] or "",
             r["legal_rent"] or "", r["current_rent"] or "", r["subsidy_amount"] or "",
             r["balance"], r["last_payment"] or ""]
            for r in rr["rows"]
        ]
        return _csv(
            ["Unit", "Tenant", "Status", "Lease start", "Lease end", "Legal rent", "Current rent", "Subsidy", "Balance", "Last payment"],
            rows, "rent_roll.csv",
        )

    if kind == "arrears":
        rr_rows = []
        for bid in ids:
            rr = await rent_roll(bid, user)
            for r in rr["rows"]:
                if _f(r["balance"]) > 0:
                    rr_rows.append([bname(bid), r["unit"], r["tenant"] or "", r["balance"], r["last_payment"] or ""])
        return _csv(["Building", "Unit", "Tenant", "Balance due", "Last payment"], rr_rows, "arrears.csv")

    if kind == "income_expense":
        revenue = await _docs("revenue", user["id"], ids)
        expenses = await _docs("expenses", user["id"], ids)
        rows = [
            [r.get("date") or "", bname(r.get("building_id")), "Revenue", r.get("category") or "", r.get("expected") or "", r.get("received") or ""]
            for r in revenue
        ] + [
            [e.get("invoice_date") or "", bname(e.get("building_id")), "Expense", e.get("category") or "", "", e.get("amount") or ""]
            for e in expenses
        ]
        rows.sort(key=lambda x: x[0], reverse=True)
        return _csv(["Date", "Building", "Type", "Category", "Expected", "Amount"], rows, "income_expense.csv")

    if kind == "work_orders":
        wos = await _docs("work_orders", user["id"], ids)
        rows = [
            [w.get("created_at", "")[:10], bname(w.get("building_id")), w.get("title") or "", w.get("priority") or "",
             w.get("status") or "", w.get("assignee") or "", w.get("est_cost") or "", w.get("final_cost") or ""]
            for w in wos
        ]
        return _csv(["Created", "Building", "Title", "Priority", "Status", "Assignee", "Est. cost", "Final cost"], rows, "work_orders.csv")

    if kind == "violations":
        data = await db.nyc_data.find(
            {"building_id": {"$in": ids}, "key": {"$in": ["hpd_violations", "dob_violations", "ecb_violations"]}},
            {"_id": 0},
        ).to_list(1000)
        rows = []
        for d in data:
            for it in d.get("items", []):
                rows.append([bname(d["building_id"]), d["label"], it.get("date") or "", it.get("title") or "",
                             it.get("badge") or "", (it.get("extra") or {}).get("class") or ""])
        rows.sort(key=lambda x: x[2], reverse=True)
        return _csv(["Building", "Source", "Date", "Description", "Status", "Class"], rows, "violations.csv")

    if kind == "mortgage":
        loans = await _docs("loans", user["id"], ids)
        rows = [
            [bname(l.get("building_id")), l.get("lender") or "", l.get("balance") or "", l.get("rate") or "",
             l.get("monthly_payment") or "", l.get("maturity_date") or "", l.get("next_payment_date") or ""]
            for l in loans
        ]
        return _csv(["Building", "Lender", "Balance", "Rate", "Monthly payment", "Maturity", "Next payment"], rows, "mortgage.csv")

    raise HTTPException(status_code=404, detail="Unknown report")
