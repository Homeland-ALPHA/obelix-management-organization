import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from db import db
from security import get_current_user, hash_password, make_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    company: str = Field(default="", max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _public(user: dict) -> dict:
    return {k: user[k] for k in ("id", "name", "company", "email", "created_at") if k in user}


@router.post("/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "company": body.company.strip(),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(dict(user))
    return {"token": make_token(user["id"]), "user": _public(user)}


@router.post("/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": make_token(user["id"]), "user": _public(user)}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _public(user)
