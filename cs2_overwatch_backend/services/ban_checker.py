"""
Ban Checker Service
-------------------
Periodically checks all reported accounts via Steam API.
If a new ban is detected (account_bans increased), awards 1 XP to every
user who reported that account via user_reports, and checks for rank-ups.
"""

from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import Reported, UserReport, User, Rank, Badge
from services.steam import get_ban_count_from_url


def get_rank_for_xp(xp: int, ranks: list) -> object | None:
    earned = [r for r in ranks if xp >= r.required_xp]
    return max(earned, key=lambda r: r.required_xp) if earned else None


async def award_xp_and_rankup(db: AsyncSession, user_id: int):
    user = await db.get(User, user_id)
    if not user:
        return

    old_lvl       = user.user_lvl
    user.user_lvl += 1
    await db.flush()

    ranks_result = await db.execute(select(Rank).order_by(Rank.required_xp))
    ranks        = ranks_result.scalars().all()

    old_rank = get_rank_for_xp(old_lvl,       ranks)
    new_rank = get_rank_for_xp(user.user_lvl, ranks)

    if new_rank and (old_rank is None or new_rank.id != old_rank.id):
        db.add(Badge(user_id=user_id, rank_name=new_rank.rank_name))


async def check_all_bans(db: AsyncSession):
    result        = await db.execute(select(Reported))
    reported_list = result.scalars().all()

    for account in reported_list:
        try:
            current_bans = await get_ban_count_from_url(account.reported_acc)
        except Exception:
            continue

        if current_bans > account.account_bans:
            account.account_bans    = current_bans
            account.ban_detected_at = datetime.now(timezone.utc)

            reporters = await db.execute(
                select(UserReport.user_id).where(UserReport.reported_acc_id == account.id)
            )
            for (uid,) in reporters.fetchall():
                await award_xp_and_rankup(db, uid)

    await db.commit()
