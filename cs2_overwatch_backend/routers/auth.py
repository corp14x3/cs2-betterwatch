from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import bcrypt

from database.connection import get_db
from database.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    nick: str
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


# ── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def get_current_user_id(request: Request) -> int:
    uid = request.session.get("user_id")
    if not uid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.user_email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        user_email    = body.email,
        user_nick     = body.nick,
        user_password = hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"user_id": user.user_id, "nick": user.user_nick}


@router.post("/login")
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.user_email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.user_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    request.session["user_id"] = user.user_id
    if body.remember_me:
        request.session["remember_me"] = True

    return {
        "user_id":   user.user_id,
        "nick":      user.user_nick,
        "photo":     user.user_photo,
        "user_lvl":  user.user_lvl,
    }


@router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"detail": "Logged out"}


@router.get("/me")
async def me(request: Request, db: AsyncSession = Depends(get_db)):
    uid = get_current_user_id(request)
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id":  user.user_id,
        "nick":     user.user_nick,
        "email":    user.user_email,
        "photo":    user.user_photo,
        "user_lvl": user.user_lvl,
    }
