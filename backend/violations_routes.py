"""Remediation tracking for city-issued violations.

The violation records themselves come from NYC Open Data and are read-only, so
everything a team does about one — stage, assigned vendor, artifacts collected,
who changed what — lives here, keyed by the agency's violation id.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db import db
from entities import log_activity
from security import get_current_user

router = APIRouter(prefix="/violations", tags=["violations"])

# Ordered remediation stages. "detected" is implicit (the agency issued it) and
# "cleared" is driven by the agency closing the record, not by us.
STAGES = ["detected", "explained", "assigned", "corrected", "documented", "certified", "cleared"]

# Requirements that must be met before a violation can be certified. The first
# three are satisfied by the agency record itself; the rest are our team's work.
ARTIFACTS = ["access_confirmed", "before_photos", "treatment_report", "certification"]

TRACKED_FIELDS = {
    "stage", "unit", "vendor_id", "assignee", "target_date", "summary", "notes", *ARTIFACTS
}


def _now():
    return datetime.now(timezone.utc).isoformat()


class TrackingIn(BaseModel):
    building_id: str
    stage: str | None = None
    unit: str | None = None
    vendor_id: str | None = None
    assignee: str | None = None
    target_date: str | None = None
    summary: str | None = None
    notes: str | None = None
    access_confirmed: bool | None = None
    before_photos: bool | None = None
    treatment_report: bool | None = None
    certification: bool | None = None
    # free-text note attached to this change, shown in the record's history
    entry: str | None = Field(default=None, max_length=500)


def _public(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@router.get("/tracking")
async def list_tracking(building_id: str = Query(None), user: dict = Depends(get_current_user)):
    """Every tracking record for a building (or the whole portfolio), keyed by violation id."""
    q = {"user_id": user["id"]}
    if building_id and building_id != "portfolio":
        q["building_id"] = building_id
    docs = await db.violation_tracking.find(q, {"_id": 0, "user_id": 0}).to_list(2000)
    return {d["violation_id"]: d for d in docs}


@router.get("/{violation_id}/tracking")
async def get_tracking(violation_id: str, user: dict = Depends(get_current_user)):
    doc = await db.violation_tracking.find_one({"user_id": user["id"], "violation_id": violation_id})
    return _public(doc) if doc else None


@router.put("/{violation_id}/tracking")
async def upsert_tracking(violation_id: str, body: TrackingIn, user: dict = Depends(get_current_user)):
    """Create or update a violation's remediation record, logging what changed."""
    if body.stage is not None and body.stage not in STAGES:
        raise HTTPException(status_code=422, detail=f"Unknown stage '{body.stage}'")

    building = await db.buildings.find_one({"user_id": user["id"], "id": body.building_id}, {"_id": 0})
    if not building:
        raise HTTPException(status_code=404, detail="Building not found")

    existing = await db.violation_tracking.find_one({"user_id": user["id"], "violation_id": violation_id})
    patch = {k: v for k, v in body.model_dump().items() if k in TRACKED_FIELDS and v is not None}

    def _show(v):
        if v is None or v == "":
            return "not set"
        if isinstance(v, bool):
            return "yes" if v else "no"
        return str(v)

    changes = [
        f"{k.replace('_', ' ').capitalize()}: {_show(existing.get(k) if existing else None)} → {_show(v)}"
        for k, v in patch.items()
        if not existing or existing.get(k) != v
    ]
    if not changes and not body.entry:
        return _public(existing) if existing else None

    history = list((existing or {}).get("history") or [])
    history.append(
        {
            "at": _now(),
            "by": user.get("name") or user.get("email"),
            "stage": patch.get("stage") or (existing or {}).get("stage") or "detected",
            "note": body.entry or "; ".join(changes)[:500],
        }
    )

    doc = {
        **(existing or {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "violation_id": violation_id,
            "stage": "detected",
            "created_at": _now(),
        }),
        **patch,
        "building_id": body.building_id,
        "history": history[-60:],
        "updated_at": _now(),
    }
    doc.pop("_id", None)

    await db.violation_tracking.update_one(
        {"user_id": user["id"], "violation_id": violation_id}, {"$set": doc}, upsert=True
    )
    await log_activity(
        user,
        "updated" if existing else "started tracking",
        "violations",
        {"id": violation_id, "label": f"Violation #{violation_id}"},
        changes=changes,
        building_id=body.building_id,
    )
    return _public(doc)
