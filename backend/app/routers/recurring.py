from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.recurring import RecurringTransaction
from app.schemas.recurring import RecurringCreate, RecurringUpdate, RecurringOut
from app.utils.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/recurring", tags=["recurring"])

@router.get("", response_model=List[RecurringOut])
def list_recurring(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(RecurringTransaction)\
        .filter(RecurringTransaction.user_id == current_user.id)\
        .order_by(RecurringTransaction.created_at.desc())\
        .all()

@router.post("", response_model=RecurringOut, status_code=status.HTTP_201_CREATED)
def create_recurring(
    body: RecurringCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = RecurringTransaction(
        user_id=current_user.id,
        **body.model_dump()
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r

@router.patch("/{id}", response_model=RecurringOut)
def update_recurring(
    id: int,
    body: RecurringUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == id,
        RecurringTransaction.user_id == current_user.id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == id,
        RecurringTransaction.user_id == current_user.id
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(r)
    db.commit()