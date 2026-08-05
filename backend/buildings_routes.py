import asyncio
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import nyc
from db import db
from security import get_current_user

router = APIRouter(tags=["buildings"])

STALE_MINUTES = 30


class BuildingIn(BaseModel):
    label: str = Field(default="", max_length=200)
    housenumber: str = Field(default="", max_length=20)
    street: str = Field(default="", max_length=120)
    borough: str = Field(default="", max_length=40)
    zip: str = Field(default="", max_length=10)
    bbl: str = Field(min_length=10, max_length=11)
    bin: str = Field(default="", max_length=10)


def _now():
    return datetime.now(timezone.utc)


@router.get("/geosearch")
async def geosearch(q: str = Query(min_length=3, max_length=120), user: dict = Depends(get_current_user)):
    try:
        return await asyncio.to_thread(nyc.geosearch, q)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"GeoSearch unavailable: {type(e).__name__}")


async def _sync_building(building: dict) -> dict:
    """Fetch all NYC datasets for a building, store them, update the summary."""
    results = await nyc.fetch_all(building)
    datasets = {r["key"]: r for r in results}
    for r in results:
        await db.nyc_data.update_one(
            {"building_id": building["id"], "key": r["key"]},
            {"$set": {**r, "building_id": building["id"]}},
            upsert=True,
        )
    summary = nyc.compute_summary(datasets)
    synced_at = _now().isoformat()
    await db.buildings.update_one(
        {"id": building["id"]},
        {"$set": {"summary": summary, "last_synced": synced_at}},
    )
    building.update({"summary": summary, "last_synced": synced_at})
    return building


async def _create_building(user_id: str, sel: BuildingIn) -> dict:
    bbl_digits = re.sub(r"\D", "", sel.bbl)
    dup = await db.buildings.find_one({"user_id": user_id, "bbl": bbl_digits}, {"_id": 0, "id": 1})
    if dup:
        raise HTTPException(status_code=409, detail="This building is already in your portfolio")

    parts = nyc.bbl_parts(bbl_digits)
    boro = parts[0] if parts else ""
    profile, hpd = await asyncio.gather(
        asyncio.to_thread(nyc.pluto_profile, bbl_digits),
        asyncio.to_thread(nyc.hpd_building_lookup, sel.bin, *(parts or ("", "", ""))),
    )

    building = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "label": sel.label or f"{sel.housenumber} {sel.street}".strip(),
        "housenumber": sel.housenumber,
        "street": sel.street,
        "borough": sel.borough or nyc.BORO_NAMES.get(boro, ""),
        "zip": sel.zip or profile.get("zipcode") or "",
        "bbl": bbl_digits,
        "bin": sel.bin,
        **hpd,
        "profile": profile,
        "summary": {},
        "created_at": _now().isoformat(),
        "last_synced": None,
    }
    await db.buildings.insert_one(dict(building))
    return await _sync_building(building)


def _public(b: dict) -> dict:
    b = dict(b)
    b.pop("_id", None)
    b.pop("user_id", None)
    return b


@router.get("/buildings")
async def list_buildings(user: dict = Depends(get_current_user)):
    rows = await db.buildings.find({"user_id": user["id"]}, {"_id": 0, "user_id": 0}).to_list(200)
    rows.sort(key=lambda b: b.get("created_at") or "")
    return rows


@router.post("/buildings")
async def add_building(body: BuildingIn, user: dict = Depends(get_current_user)):
    from entities import log_activity

    b = await _create_building(user["id"], body)
    await log_activity(user, "added building", "buildings", {"id": b["id"], "label": b["label"], "building_id": b["id"]})
    return _public(b)


PROFILE_SECTIONS = {"ownership", "utilities", "valuation_user"}
PROFILE_FIELDS = {"label", "property_type", "commercial_units", "notes"}


@router.patch("/buildings/{building_id}")
async def update_building(building_id: str, payload: dict, user: dict = Depends(get_current_user)):
    from entities import log_activity  # local import to avoid a cycle

    b = await _get_owned(building_id, user["id"])
    updates = {}
    changes = []
    for k in PROFILE_FIELDS:
        if k in payload and payload[k] != b.get(k):
            updates[k] = payload[k]
            changes.append({"field": k, "before": b.get(k), "after": payload[k]})
    for k in PROFILE_SECTIONS:
        if k in payload and isinstance(payload[k], dict):
            merged = {**(b.get(k) or {}), **payload[k]}
            if merged != b.get(k):
                updates[k] = merged
                changes.append({"field": k, "before": b.get(k), "after": merged})
    if updates:
        await db.buildings.update_one({"id": building_id}, {"$set": updates})
        b.update(updates)
        await log_activity(user, "updated", "buildings", {"id": building_id, "label": b["label"], "building_id": building_id}, changes=changes)
    return _public(b)


async def _get_owned(building_id: str, user_id: str) -> dict:
    b = await db.buildings.find_one({"id": building_id, "user_id": user_id})
    if not b:
        raise HTTPException(status_code=404, detail="Building not found")
    return b


@router.get("/buildings/{building_id}")
async def get_building(building_id: str, user: dict = Depends(get_current_user)):
    return _public(await _get_owned(building_id, user["id"]))


@router.post("/buildings/{building_id}/sync")
async def sync_building(building_id: str, user: dict = Depends(get_current_user)):
    b = await _get_owned(building_id, user["id"])
    return _public(await _sync_building(b))


@router.get("/buildings/{building_id}/data")
async def building_data(building_id: str, user: dict = Depends(get_current_user)):
    b = await _get_owned(building_id, user["id"])

    stale = True
    if b.get("last_synced"):
        try:
            last = datetime.fromisoformat(b["last_synced"])
            stale = _now() - last > timedelta(minutes=STALE_MINUTES)
        except ValueError:
            pass
    if stale:
        b = await _sync_building(b)

    rows = await db.nyc_data.find({"building_id": building_id}, {"_id": 0, "building_id": 0}).to_list(50)
    return {
        "building": _public(b),
        "datasets": {r["key"]: r for r in rows},
    }


@router.delete("/buildings/{building_id}")
async def delete_building(building_id: str, user: dict = Depends(get_current_user)):
    from entities import log_activity

    b = await _get_owned(building_id, user["id"])
    await db.nyc_data.delete_many({"building_id": building_id})
    await db.buildings.delete_one({"id": building_id, "user_id": user["id"]})
    await log_activity(user, "removed building", "buildings", {"id": building_id, "label": b["label"], "building_id": building_id})
    return {"ok": True}
