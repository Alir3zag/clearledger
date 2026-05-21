from pydantic import BaseModel, field_validator
from datetime import date
from decimal import Decimal
from typing import Optional

class TransactionCreate(BaseModel):
    category_id: int
    amount: Decimal
    type: str
    description: Optional[str] = None
    date: date

    @field_validator("amount")
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

    @field_validator("type")
    def type_must_be_valid(cls, v):
        if v not in ("expense", "income"):
            raise ValueError("type must be 'expense' or 'income'")
        return v

class TransactionUpdate(BaseModel):
    category_id: Optional[int]     = None
    amount:      Optional[Decimal]  = None
    description: Optional[str]     = None
    date:        Optional[date]     = None

class TransactionOut(BaseModel):
    id:          int
    category_id: int
    amount:      Decimal
    type:        str
    description: Optional[str]
    date:        date

    class Config:
        from_attributes = True
