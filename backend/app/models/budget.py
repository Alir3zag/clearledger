from sqlalchemy import Column, Integer, Numeric, Date, DateTime, ForeignKey, UniqueConstraint, func
from app.database import Base

class Budget(Base):
    __tablename__ = "budgets"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id",      ondelete="CASCADE"), nullable=False)
    category_id  = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    amount       = Column(Numeric(12, 2), nullable=False)
    period_start = Column(Date,           nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "category_id", "period_start", name="budgets_no_duplicates"),
    )