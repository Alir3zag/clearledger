from pydantic import BaseModel, field_validator
from datetime import date
from decimal import Decimal
from typing import Optional

class BudgetCreate(BaseModel):
    category_id: int
    amount: Decimal
    period_start: date

    @field_validator("amount")
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

class BudgetUpdate(BaseModel):
    amount: Decimal

    @field_validator("amount")
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

class BudgetOut(BaseModel):
    id: int
    category_id: int
    amount: Decimal
    period_start: date

    class Config:
        from_attributes = True
