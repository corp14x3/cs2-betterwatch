import configparser
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from database.connection import init_db, AsyncSessionLocal
from services.ban_checker import check_all_bans
from routers import auth, demos, leaderboard, users

# ── Config ────────────────────────────────────────────────────────────────────

config = configparser.ConfigParser()
config.read("config.ini")

SECRET_KEY      = config["session"]["secret_key"]
SESSION_EXPIRE  = int(config["session"]["session_expire_minutes"])
HOST            = config["server"]["host"]
PORT            = int(config["server"]["port"])

# ── Scheduler (ban checking every 30 min) ─────────────────────────────────────

scheduler = AsyncIOScheduler()

async def scheduled_ban_check():
    async with AsyncSessionLocal() as db:
        await check_all_bans(db)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    scheduler.add_job(scheduled_ban_check, "interval", minutes=30)

    from services.cleanup import cleanup_old_demos
    async def scheduled_cleanup():
        async with AsyncSessionLocal() as db:
            await cleanup_old_demos(db)

    scheduler.add_job(scheduled_cleanup, "interval", hours=24)
    
    scheduler.start()
    yield
    scheduler.shutdown()





# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="CS2 OverWatch", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    SessionMiddleware,
    secret_key    = SECRET_KEY,
    max_age       = SESSION_EXPIRE * 60,
    https_only    = False,   # set True in production
    same_site     = "none",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:3000","http://localhost:5173"],   # React dev server
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

app.include_router(auth.router)
app.include_router(demos.router)
app.include_router(leaderboard.router)
app.include_router(users.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
