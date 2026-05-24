from pydantic import BaseModel, Field
from typing import Optional
from datetime import date
from decimal import Decimal

class RecurringCreate(BaseModel):
    category_id: int
    amount: Decimal = Field(gt=0)
    type: str = Field(pattern="^(expense|income)$")
    description: Optional[str] = None
    frequency: str = Field(pattern="^(daily|weekly|monthly|yearly)$")
    next_due_date: date

class RecurringUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0)
    description: Optional[str] = None
    frequency: Optional[str] = Field(default=None, pattern="^(daily|weekly|monthly|yearly)$")
    next_due_date: Optional[date] = None
    is_active: Optional[bool] = None

class RecurringOut(BaseModel):
    id: int
    category_id: int
    amount: Decimal
    type: str
    description: Optional[str]
    frequency: str
    next_due_date: date
    is_active: bool

    class Config:
        from_attributes = True