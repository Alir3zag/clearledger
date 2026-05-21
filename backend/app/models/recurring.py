from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, DateTime, ForeignKey, func
from app.database import Base

class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id   = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount        = Column(Numeric(12, 2), nullable=False)
    type          = Column(String(10),  nullable=False)
    description   = Column(String(255), nullable=True)
    frequency     = Column(String(10),  nullable=False)
    next_due_date = Column(Date,        nullable=False)
    is_active     = Column(Boolean,     nullable=False, default=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())