from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from app.database import Base

class Category(Base):
    __tablename__ = "categories"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    name       = Column(String(50),  nullable=False)
    type       = Column(String(10),  nullable=False)
    color      = Column(String(7),   nullable=False, default="#6B7280")
    icon       = Column(String(50),  nullable=False, default="tag")
    is_default = Column(Boolean,     nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())