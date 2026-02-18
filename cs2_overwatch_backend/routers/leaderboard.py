from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from datetime import datetime, timedelta, timezone

from database.connection import get_db
from database.models import Reported, User, UserReport, Badge, Rank
from routers.auth import get_current_user_id

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


def _period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "weekly":
        return now - timedelta(weeks=1)
    elif period == "monthly":
        return now - timedelta(days=30)
    elif period == "yearly":
        return now - timedelta(days=365)
    raise ValueError("Invalid period")


@router.get("/{period}")
async def leaderboard(period: str, limit: int = 50, db: AsyncSession = Depends(get_db)):
    """
    period: weekly | monthly | yearly
    Ranks users by how many unique reported accounts got banned,
    filtered by when the user submitted the report (reported_at).
    """
    if period not in ("weekly", "monthly", "yearly"):
        raise HTTPException(400, "period must be weekly, monthly, or yearly")

    since = _period_start(period)

    sql = text("""
        SELECT u.user_id, u.user_nick, u.user_photo, u.user_lvl,
               COUNT(DISTINCT ur.reported_acc_id) AS ban_count
        FROM users u
        JOIN user_reports ur ON u.user_id = ur.user_id
        JOIN reported r      ON ur.reported_acc_id = r.id
        WHERE r.account_bans > 0
          AND ur.reported_at >= :since
        GROUP BY u.user_id
        ORDER BY ban_count DESC
        LIMIT :limit
    """)

    result = await db.execute(sql, {"since": since, "limit": limit})
    rows   = result.fetchall()

    return [
        {
            "user_id":   row.user_id,
            "nick":      row.user_nick,
            "photo":     row.user_photo,
            "user_lvl":  row.user_lvl,
            "ban_count": row.ban_count,
        }
        for row in rows
    ]


@router.get("/profile/{user_id}")
async def public_profile(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")

    # Badges
    badges_result = await db.execute(select(Badge).where(Badge.user_id == user_id))
    badges = badges_result.scalars().all()

    # Banned from this user — accounts they reported that now have bans
    banned_result = await db.execute(
        select(Reported.reported_acc)
        .join(UserReport, UserReport.reported_acc_id == Reported.id)
        .where(UserReport.user_id == user_id)
        .where(Reported.account_bans > 0)
    )
    banned_accs = [r[0] for r in banned_result.fetchall()]

    # Current rank
    ranks_result  = await db.execute(select(Rank).order_by(Rank.required_xp.desc()))
    ranks         = ranks_result.scalars().all()
    current_rank  = next((r for r in ranks if user.user_lvl >= r.required_xp), None)

    return {
        "user_id":     user.user_id,
        "nick":        user.user_nick,
        "photo":       user.user_photo,
        "user_lvl":    user.user_lvl,
        "rank":        current_rank.rank_name  if current_rank else None,
        "rank_image":  current_rank.rank_image if current_rank else None,
        "badges":      [{"rank_name": b.rank_name, "earned_at": b.earned_at} for b in badges],
        "banned_accs": banned_accs,
    }
