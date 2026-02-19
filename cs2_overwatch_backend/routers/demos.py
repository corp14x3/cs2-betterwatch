import uuid
import os
import configparser
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
import aiofiles

from database.connection import get_db
from database.models import Demo, DemoDownload, Reported, UserReport
from routers.auth import get_current_user_id

config = configparser.ConfigParser()
config.read("config.ini")
DEMO_DIR = Path(config["server"]["demo_upload_dir"])
MAX_SIZE  = int(config["server"]["max_demo_size_mb"]) * 1024 * 1024
DEMO_DIR.mkdir(exist_ok=True)

router = APIRouter(prefix="/demos", tags=["demos"])


class DemoOut(BaseModel):
    demo_id: str
    demo_accs: list[str]
    uploaded_from: int
    download_count: int
    upload_timestamp: str

    class Config:
        from_attributes = True


# ── List demos ────────────────────────────────────────────────────────────────

@router.get("/")
async def list_demos(
    sort_by: str = "upload_timestamp",   # "upload_timestamp" | "download_count"
    order:   str = "desc",
    limit:   int = 50,
    offset:  int = 0,
    db: AsyncSession = Depends(get_db),
):
    allowed_sorts = {"upload_timestamp", "download_count"}
    if sort_by not in allowed_sorts:
        raise HTTPException(400, "Invalid sort field")

    col = getattr(Demo, sort_by)
    q   = select(Demo).order_by(col.desc() if order == "desc" else col.asc())
    q   = q.limit(limit).offset(offset)

    result = await db.execute(q)
    demos  = result.scalars().all()
    return demos


# ── Upload demo ───────────────────────────────────────────────────────────────

@router.post("/upload", status_code=201)
async def upload_demo(
    request:   Request,
    file:      UploadFile = File(...),
    demo_accs: str        = Form(""),   # comma-separated steam links
    db:        AsyncSession = Depends(get_db),
):
    uid = get_current_user_id(request)
    
    if not file.filename.endswith('.dem'):
        raise HTTPException(400, "Sadece .dem dosyaları kabul edilir")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, f"Demo too large (max {config['server']['max_demo_size_mb']} MB)")

    demo_id   = str(uuid.uuid4())
    file_ext  = Path(file.filename).suffix if file.filename else ".dem"
    file_path = DEMO_DIR / f"{demo_id}{file_ext}"

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    accs = [a.strip() for a in demo_accs.split(",") if a.strip()]

    # Add unique accounts to Reported table
    for acc_url in accs:
        existing = await db.execute(select(Reported).where(Reported.reported_acc == acc_url))
        if not existing.scalar_one_or_none():
            from services.steam import get_ban_count_from_url
            ban_count = await get_ban_count_from_url(acc_url)
            db.add(Reported(reported_acc=acc_url, account_bans=ban_count))

    demo = Demo(
        demo_id        = demo_id,
        demo_file_path = str(file_path),
        demo_accs      = accs,
        uploaded_from  = uid,
    )
    db.add(demo)
    await db.commit()
    return {"demo_id": demo_id}


# ── Download demo ─────────────────────────────────────────────────────────────

@router.get("/{demo_id}/download")
async def download_demo(demo_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    uid  = get_current_user_id(request)
    demo = await db.get(Demo, demo_id)
    if not demo:
        raise HTTPException(404, "Demo not found")

    # Track download (idempotent per user)
    existing = await db.execute(
        select(DemoDownload).where(
            DemoDownload.demo_id == demo_id,
            DemoDownload.user_id == uid,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(DemoDownload(demo_id=demo_id, user_id=uid))
        demo.download_count += 1
        await db.commit()

    return FileResponse(demo.demo_file_path, filename=Path(demo.demo_file_path).name)


# ── Get downloaded demos for current user ─────────────────────────────────────

@router.get("/my/downloaded")
async def my_downloaded_demos(request: Request, db: AsyncSession = Depends(get_db)):
    uid = get_current_user_id(request)
    result = await db.execute(
        select(Demo)
        .join(DemoDownload, Demo.demo_id == DemoDownload.demo_id)
        .where(DemoDownload.user_id == uid)
    )
    return result.scalars().all()


# ── Report a single suspect from a downloaded demo ────────────────────────────

class ReportRequest(BaseModel):
    steam_url: str

@router.post("/{demo_id}/report")
async def report_account(
    demo_id: str,
    body:    ReportRequest,
    request: Request,
    db:      AsyncSession = Depends(get_db),
):
    uid = get_current_user_id(request)

    # Must have downloaded the demo first
    dl = await db.execute(
        select(DemoDownload).where(
            DemoDownload.demo_id == demo_id,
            DemoDownload.user_id == uid,
        )
    )
    if not dl.scalar_one_or_none():
        raise HTTPException(403, "Download the demo first before reporting")

    # Get or create Reported entry
    result = await db.execute(select(Reported).where(Reported.reported_acc == body.steam_url))
    acc    = result.scalar_one_or_none()

    if not acc:
        from services.steam import get_ban_count_from_url
        ban_count = await get_ban_count_from_url(body.steam_url)
        acc = Reported(reported_acc=body.steam_url, account_bans=ban_count)
        db.add(acc)
        await db.flush()   # get acc.id

    # Add UserReport if not already reported by this user
    existing_report = await db.execute(
        select(UserReport).where(
            UserReport.user_id         == uid,
            UserReport.reported_acc_id == acc.id,
        )
    )
    if not existing_report.scalar_one_or_none():
        db.add(UserReport(user_id=uid, reported_acc_id=acc.id))

    await db.commit()
    return {"detail": "Reported successfully"}
