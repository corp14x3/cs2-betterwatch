import configparser
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from database.models import Base

config = configparser.ConfigParser()
config.read("config.ini")

DB = config["database"]
DATABASE_URL = (
    f"postgresql+asyncpg://{DB['user']}:{DB['password']}"
    f"@{DB['host']}:{DB['port']}/{DB['name']}"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
