"""Generic entity CRUD with an audit trail.

One registry drives create/list/update/delete for every operational record
type (units, tenants, revenue, expenses, budgets, loans, work orders,
vendors, documents). Every mutation writes an activity entry.
"""
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from db import db
from security import get_current_user

router = APIRouter(tags=["entities"])

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def now():
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------- registry
# fields: whitelisted top-level keys the client may set.
ENTITIES = {
    "units": {
        "collection": "units",
        "building_scoped": True,
        "label": lambda d: f"Unit {d.get('number', '?')}",
        "fields": {
            "number", "floor", "beds", "baths", "sqft", "status", "appliances",
            "access_notes", "keys", "notes",
        },
    },
    "tenants": {
        "collection": "tenants",
        "building_scoped": True,
        "label": lambda d: d.get("name", "Tenant"),
        "fields": {
            "name", "unit_id", "phone", "email", "emergency_contact",
            "lease_start", "lease_end", "legal_rent", "preferential_rent",
            "current_rent", "subsidy_program", "subsidy_amount", "tenant_portion",
            "deposit", "stabilized", "renewal_status", "notes",
        },
    },
    "revenue": {
        "collection": "revenue",
        "building_scoped": True,
        "label": lambda d: f"{(d.get('category') or 'revenue').replace('_', ' ').title()} · ${d.get('received') or 0}",
        "fields": {
            "date", "unit_id", "tenant_id", "category", "expected", "received",
            "method", "status", "notes",
        },
    },
    "expenses": {
        "collection": "expenses",
        "building_scoped": True,
        "label": lambda d: f"{(d.get('category') or 'expense').replace('_', ' ').title()} · ${d.get('amount') or 0}",
        "fields": {
            "vendor_id", "category", "unit_id", "invoice_date", "due_date",
            "amount", "status", "paid_date", "method", "approval_status", "notes",
        },
    },
    "budgets": {
        "collection": "budgets",
        "building_scoped": True,
        "label": lambda d: f"Budget {d.get('year', '')}",
        "fields": {"year", "lines", "notes"},
    },
    "loans": {
        "collection": "loans",
        "building_scoped": True,
        "label": lambda d: f"Loan · {d.get('lender', '?')}",
        "fields": {
            "lender", "original_principal", "balance", "rate", "loan_type",
            "fixed", "monthly_payment", "escrow", "maturity_date",
            "amortization_years", "next_payment_date", "notes",
        },
    },
    "work_orders": {
        "collection": "work_orders",
        "building_scoped": True,
        "label": lambda d: d.get("title") or "Work order",
        "fields": {
            "title", "category", "description", "unit_id", "area", "priority",
            "emergency", "status", "reported_by", "tenant_contact",
            "entry_permission", "access_time", "assignee", "vendor_id",
            "est_cost", "final_cost", "approval_required", "approval",
            "target_date", "completed", "related_violation", "notes",
        },
    },
    "vendors": {
        "collection": "vendors",
        "building_scoped": False,
        "label": lambda d: d.get("name", "Vendor"),
        "fields": {
            "name", "category", "phone", "email", "contact", "address",
            "insurance_exp", "license_exp", "contract_terms", "rating", "notes",
        },
    },
}

WO_STATUSES = [
    "Submitted", "Under Review", "Approval Required", "Approved", "Assigned",
    "Scheduled", "In Progress", "Waiting for Parts", "Waiting for Access",
    "Completed", "Inspected", "Closed",
]


# --------------------------------------------------------------- activity log
async def log_activity(user, action, entity, record, changes=None, building_id=None, source="user"):
    await db.activity.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "actor": user.get("name") or user.get("email"),
            "at": now(),
            "action": action,
            "entity": entity,
            "entity_id": record.get("id"),
            "label": ENTITIES[entity]["label"](record) if entity in ENTITIES else record.get("label", entity),
            "building_id": building_id or record.get("building_id"),
            "changes": changes or [],
            "source": source,
        }
    )


def _clean(entity_key, payload: dict) -> dict:
    allowed = ENTITIES[entity_key]["fields"]
    return {k: v for k, v in payload.items() if k in allowed}


async def _owned(entity_key, record_id, user_id):
    doc = await db[ENTITIES[entity_key]["collection"]].find_one({"id": record_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Record not found")
    return doc


def _pub(doc):
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("user_id", None)
    return doc


# --------------------------------------------------------------- generic CRUD
@router.get("/e/{entity_key}")
async def list_entities(
    entity_key: str,
    building_id: str = Query(default=None),
    user: dict = Depends(get_current_user),
):
    if entity_key not in ENTITIES:
        raise HTTPException(status_code=404, detail="Unknown entity")
    q = {"user_id": user["id"]}
    if building_id and ENTITIES[entity_key]["building_scoped"]:
        q["building_id"] = building_id
    rows = await db[ENTITIES[entity_key]["collection"]].find(q, {"_id": 0, "user_id": 0}).to_list(2000)
    rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
    return rows


@router.post("/e/{entity_key}")
async def create_entity(entity_key: str, payload: dict, user: dict = Depends(get_current_user)):
    if entity_key not in ENTITIES:
        raise HTTPException(status_code=404, detail="Unknown entity")
    spec = ENTITIES[entity_key]
    doc = _clean(entity_key, payload)
    if spec["building_scoped"]:
        building_id = payload.get("building_id")
        if not building_id:
            raise HTTPException(status_code=422, detail="building_id is required")
        b = await db.buildings.find_one({"id": building_id, "user_id": user["id"]})
        if not b:
            raise HTTPException(status_code=404, detail="Building not found")
        doc["building_id"] = building_id
    if entity_key == "work_orders":
        doc.setdefault("status", "Submitted")
        doc.setdefault("priority", "medium")
    if entity_key == "loans":
        doc.setdefault("payments", [])
    doc.update({"id": str(uuid.uuid4()), "user_id": user["id"], "created_at": now(), "updated_at": now()})
    await db[spec["collection"]].insert_one(dict(doc))
    await log_activity(user, "created", entity_key, doc)
    return _pub(doc)


@router.patch("/e/{entity_key}/{record_id}")
async def update_entity(entity_key: str, record_id: str, payload: dict, user: dict = Depends(get_current_user)):
    if entity_key not in ENTITIES:
        raise HTTPException(status_code=404, detail="Unknown entity")
    doc = await _owned(entity_key, record_id, user["id"])
    updates = _clean(entity_key, payload)
    if entity_key == "work_orders" and "status" in updates and updates["status"] not in WO_STATUSES:
        raise HTTPException(status_code=422, detail="Invalid work order status")
    changes = [
        {"field": k, "before": doc.get(k), "after": v}
        for k, v in updates.items()
        if doc.get(k) != v
    ]
    if changes:
        updates["updated_at"] = now()
        await db[ENTITIES[entity_key]["collection"]].update_one({"id": record_id}, {"$set": updates})
        doc.update(updates)
        await log_activity(user, "updated", entity_key, doc, changes=changes)
    return _pub(doc)


@router.delete("/e/{entity_key}/{record_id}")
async def delete_entity(entity_key: str, record_id: str, user: dict = Depends(get_current_user)):
    if entity_key not in ENTITIES:
        raise HTTPException(status_code=404, detail="Unknown entity")
    doc = await _owned(entity_key, record_id, user["id"])
    await db[ENTITIES[entity_key]["collection"]].delete_one({"id": record_id})
    await log_activity(user, "deleted", entity_key, doc)
    return {"ok": True}


# --------------------------------------------------------------- loan payments
@router.post("/e/loans/{loan_id}/payments")
async def add_loan_payment(loan_id: str, payload: dict, user: dict = Depends(get_current_user)):
    loan = await _owned("loans", loan_id, user["id"])
    payment = {
        "id": str(uuid.uuid4()),
        "date": payload.get("date"),
        "amount": payload.get("amount"),
        "principal": payload.get("principal"),
        "interest": payload.get("interest"),
        "escrow": payload.get("escrow"),
        "method": payload.get("method"),
        "notes": payload.get("notes"),
    }
    new_balance = loan.get("balance")
    try:
        if new_balance is not None and payment["principal"]:
            new_balance = round(float(new_balance) - float(payment["principal"]), 2)
    except (TypeError, ValueError):
        pass
    await db.loans.update_one(
        {"id": loan_id},
        {"$push": {"payments": payment}, "$set": {"balance": new_balance, "updated_at": now()}},
    )
    loan["payments"] = (loan.get("payments") or []) + [payment]
    loan["balance"] = new_balance
    await log_activity(user, "recorded payment on", "loans", loan,
                       changes=[{"field": "payment", "before": None, "after": payment["amount"]}])
    return _pub(loan)


@router.delete("/e/loans/{loan_id}/payments/{payment_id}")
async def delete_loan_payment(loan_id: str, payment_id: str, user: dict = Depends(get_current_user)):
    loan = await _owned("loans", loan_id, user["id"])
    await db.loans.update_one({"id": loan_id}, {"$pull": {"payments": {"id": payment_id}}})
    await log_activity(user, "removed payment on", "loans", loan)
    return {"ok": True}


# --------------------------------------------------------------- documents
DOC_LINKS = {"building_id", "unit_id", "tenant_id", "vendor_id", "work_order_id", "loan_id"}


@router.get("/documents")
async def list_documents(
    building_id: str = Query(default=None),
    link: str = Query(default=None),
    link_id: str = Query(default=None),
    user: dict = Depends(get_current_user),
):
    q = {"user_id": user["id"]}
    if building_id:
        q["building_id"] = building_id
    if link and link_id and link in DOC_LINKS:
        q[link] = link_id
    rows = await db.documents.find(q, {"_id": 0, "user_id": 0, "path": 0}).to_list(1000)
    rows.sort(key=lambda r: r.get("uploaded_at") or "", reverse=True)
    return rows


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    building_id: str = Form(default=""),
    unit_id: str = Form(default=""),
    tenant_id: str = Form(default=""),
    vendor_id: str = Form(default=""),
    work_order_id: str = Form(default=""),
    loan_id: str = Form(default=""),
    category: str = Form(default="other"),
    tags: str = Form(default=""),
    user: dict = Depends(get_current_user),
):
    safe_name = re.sub(r"[^\w.\- ]", "_", file.filename or "document")
    doc_id = str(uuid.uuid4())
    user_dir = UPLOAD_DIR / user["id"]
    user_dir.mkdir(exist_ok=True)
    path = user_dir / f"{doc_id}_{safe_name}"
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (25 MB max)")
    path.write_bytes(content)
    doc = {
        "id": doc_id,
        "user_id": user["id"],
        "name": safe_name,
        "size": len(content),
        "content_type": file.content_type,
        "category": category,
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "building_id": building_id or None,
        "unit_id": unit_id or None,
        "tenant_id": tenant_id or None,
        "vendor_id": vendor_id or None,
        "work_order_id": work_order_id or None,
        "loan_id": loan_id or None,
        "path": str(path),
        "uploaded_at": now(),
    }
    await db.documents.insert_one(dict(doc))
    await log_activity(user, "uploaded", "documents", {"id": doc_id, "label": safe_name, "building_id": building_id or None})
    doc.pop("path")
    doc.pop("user_id")
    return doc


@router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id, "user_id": user["id"]})
    if not doc or not Path(doc["path"]).exists():
        raise HTTPException(status_code=404, detail="Document not found")
    return FileResponse(doc["path"], filename=doc["name"], media_type=doc.get("content_type") or "application/octet-stream")


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(get_current_user)):
    doc = await db.documents.find_one({"id": doc_id, "user_id": user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        Path(doc["path"]).unlink(missing_ok=True)
    except OSError:
        pass
    await db.documents.delete_one({"id": doc_id})
    await log_activity(user, "deleted", "documents", {"id": doc_id, "label": doc["name"], "building_id": doc.get("building_id")})
    return {"ok": True}


# --------------------------------------------------------------- activity feed
@router.get("/activity")
async def list_activity(
    building_id: str = Query(default=None),
    limit: int = Query(default=100, le=500),
    user: dict = Depends(get_current_user),
):
    q = {"user_id": user["id"]}
    if building_id:
        q["building_id"] = building_id
    rows = await db.activity.find(q, {"_id": 0, "user_id": 0}).sort("at", -1).to_list(limit)
    return rows


# --------------------------------------------------------------- settings
DEFAULT_SETTINGS = {"company_name": "", "approval_threshold": 1000, "default_cap_rate": 6.0}


@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0})
    return {**DEFAULT_SETTINGS, **(doc or {})}


@router.put("/settings")
async def put_settings(payload: dict, user: dict = Depends(get_current_user)):
    updates = {k: payload[k] for k in DEFAULT_SETTINGS if k in payload}
    await db.settings.update_one({"user_id": user["id"]}, {"$set": updates}, upsert=True)
    return await get_settings(user)
