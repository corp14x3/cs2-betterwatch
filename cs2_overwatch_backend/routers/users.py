from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from database.connection import get_db
from database.models import User, Reported, UserReport, Rank, Badge
from routers.auth import get_current_user_id

router = APIRouter(prefix="/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    nick:  Optional[str] = None
    photo: Optional[str] = None   # URL veya base64


# ── Profil güncelle ───────────────────────────────────────────────────────────

@router.patch("/me")
async def update_profile(
    body:    UpdateProfileRequest,
    request: Request,
    db:      AsyncSession = Depends(get_db),
):
    uid  = get_current_user_id(request)
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(404, "User not found")

    if body.nick is not None:
        user.user_nick  = body.nick
    if body.photo is not None:
        user.user_photo = body.photo

    await db.commit()
    return {"detail": "Profile updated"}


# ── Kendi profilim (banned from you dahil) ────────────────────────────────────

@router.get("/me/profile")
async def my_profile(request: Request, db: AsyncSession = Depends(get_db)):
    uid  = get_current_user_id(request)
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(404, "User not found")

    # Rank bilgisi
    ranks_result = await db.execute(select(Rank).order_by(Rank.required_xp.desc()))
    ranks        = ranks_result.scalars().all()
    current_rank = next((r for r in ranks if user.user_lvl >= r.required_xp), None)

    next_rank = None
    if current_rank:
        higher = [r for r in ranks if r.required_xp > current_rank.required_xp]
        if higher:
            next_rank = min(higher, key=lambda r: r.required_xp)

    # Rozetler
    badges_result = await db.execute(select(Badge).where(Badge.user_id == uid))
    badges        = badges_result.scalars().all()

    # Banned from you — raporladığın ve ban yiyen hesaplar
    banned_result = await db.execute(
        select(Reported.reported_acc, Reported.account_bans, Reported.ban_detected_at)
        .join(UserReport, UserReport.reported_acc_id == Reported.id)
        .where(UserReport.user_id == uid)
        .where(Reported.account_bans > 0)
        .order_by(Reported.ban_detected_at.desc())
    )
    banned_accs = [
        {
            "steam_url":       row.reported_acc,
            "bans":            row.account_bans,
            "ban_detected_at": row.ban_detected_at,
        }
        for row in banned_result.fetchall()
    ]

    return {
        "user_id":     user.user_id,
        "nick":        user.user_nick,
        "email":       user.user_email,
        "photo":       user.user_photo,
        "user_lvl":    user.user_lvl,
        "rank":        current_rank.rank_name  if current_rank else None,
        "rank_image":  current_rank.rank_image if current_rank else None,
        "next_rank":   next_rank.rank_name     if next_rank   else None,
        "xp_needed":   (next_rank.required_xp - user.user_lvl) if next_rank else 0,
        "badges":      [{"rank_name": b.rank_name, "earned_at": b.earned_at} for b in badges],
        "banned_accs": banned_accs,
    }
