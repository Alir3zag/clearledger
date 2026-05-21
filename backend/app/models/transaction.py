from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, func
from app.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id",  ondelete="CASCADE"), nullable=False)
    category_id  = Column(Integer, ForeignKey("categories.id"), nullable=False)
    recurring_id = Column(Integer, ForeignKey("recurring_transactions.id", ondelete="SET NULL"), nullable=True)
    amount       = Column(Numeric(12, 2), nullable=False)
    type         = Column(String(10),  nullable=False)
    description  = Column(String(255), nullable=True)
    date         = Column(Date,        nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at   = Column(DateTime(timezone=True), nullable=True, default=None)