from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, BigInteger, ARRAY
)
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime, timezone

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    user_id       = Column(Integer, primary_key=True, autoincrement=True)
    user_email    = Column(String(255), unique=True, nullable=False, index=True)
    user_photo    = Column(Text, nullable=True)
    user_nick     = Column(String(64), nullable=False)
    user_password = Column(Text, nullable=False)          # bcrypt hash
    user_lvl      = Column(Integer, default=0, nullable=False)

    demos        = relationship("Demo",       back_populates="uploader")
    user_reports = relationship("UserReport", back_populates="reporter")


class Reported(Base):
    __tablename__ = "reported"

    id               = Column(Integer, primary_key=True, autoincrement=True)
    reported_acc     = Column(String(512), unique=True, nullable=False, index=True)
    account_bans     = Column(Integer, default=0, nullable=False)
    first_reported_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ban_detected_at  = Column(DateTime(timezone=True), nullable=True)   # set when ban first detected

    user_reports     = relationship("UserReport", back_populates="reported_acc_rel")


class UserReport(Base):
    """Junction table: which user reported which account, and when."""
    __tablename__ = "user_reports"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    user_id         = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    reported_acc_id = Column(Integer, ForeignKey("reported.id"), nullable=False, index=True)
    reported_at     = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    reporter            = relationship("User", back_populates="user_reports")
    reported_acc_rel    = relationship("Reported", back_populates="user_reports")


class Demo(Base):
    __tablename__ = "demos"

    demo_id          = Column(String(36), primary_key=True)     # UUID
    demo_file_path   = Column(Text, nullable=False)
    demo_accs        = Column(ARRAY(Text), default=[], nullable=False)  # steam profile links
    uploaded_from    = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    download_count   = Column(Integer, default=0, nullable=False)
    upload_timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    uploader         = relationship("User", back_populates="demos")
    downloads        = relationship("DemoDownload", back_populates="demo")


class DemoDownload(Base):
    """Tracks which user downloaded which demo — needed for 'report only after download' rule."""
    __tablename__ = "demo_downloads"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    demo_id    = Column(String(36), ForeignKey("demos.demo_id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    downloaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    demo = relationship("Demo", back_populates="downloads")


class Rank(Base):
    __tablename__ = "ranks"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    rank_name    = Column(String(64), nullable=False)
    rank_image   = Column(Text, nullable=False)
    required_xp  = Column(Integer, nullable=False)


class Badge(Base):
    """Badges earned when a user rank-ups."""
    __tablename__ = "badges"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    rank_name   = Column(String(64), nullable=False)
    earned_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
