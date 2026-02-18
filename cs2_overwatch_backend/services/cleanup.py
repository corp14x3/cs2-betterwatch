"""
Demo Cleanup Service
--------------------
1 haftadan eski demo dosyalarını siler.
"""

import os
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import Demo, DemoDownload

RETENTION_DAYS = 7

async def cleanup_old_demos(db: AsyncSession):
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    
    result = await db.execute(
        select(Demo).where(Demo.upload_timestamp < cutoff)
    )
    old_demos = result.scalars().all()

    for demo in old_demos:
        # Dosyayı sil
        if os.path.exists(demo.demo_file_path):
            os.remove(demo.demo_file_path)

        # Download kayıtlarını sil
        await db.execute(
            delete(DemoDownload).where(DemoDownload.demo_id == demo.demo_id)
        )

        # Demo kaydını sil
        await db.delete(demo)

    if old_demos:
        await db.commit()
        print(f"[cleanup] {len(old_demos)} eski demo silindi.")