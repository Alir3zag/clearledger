from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import date
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.budget import Budget
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetOut
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/budgets", tags=["budgets"])

@router.get("", response_model=List[BudgetOut])
def list_budgets(
    period_start: Optional[date] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    q = db.query(Budget).filter(Budget.user_id == user.id)
    if period_start:
        q = q.filter(Budget.period_start == period_start)
    return q.all()

@router.post("", response_model=BudgetOut, status_code=201)
def create_budget(
    body: BudgetCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    # Always force first of month
    normalized = body.period_start.replace(day=1)
    budget = Budget(
        user_id=user.id,
        category_id=body.category_id,
        amount=body.amount,
        period_start=normalized,
    )
    db.add(budget)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Budget already exists for this category and period"
        )
    db.refresh(budget)
    return budget

@router.patch("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: int,
    body:      BudgetUpdate,
    db:        Session = Depends(get_db),
    user:      User    = Depends(get_current_user),
):
    budget = db.query(Budget).filter(
        Budget.id      == budget_id,
        Budget.user_id == user.id
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    budget.amount = body.amount
    db.commit()
    db.refresh(budget)
    return budget
