from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, datetime, timezone
from typing import Optional, List
from app.database import get_db
from app.models.user import User
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionOut
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])

def get_user_transaction(tx_id: int, user: User, db: Session) -> Transaction:
    tx = db.query(Transaction).filter(
        Transaction.id         == tx_id,
        Transaction.user_id    == user.id,
        Transaction.deleted_at == None,
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx

@router.get("", response_model=List[TransactionOut])
def list_transactions(
    page:        int            = Query(1, ge=1),
    limit:       int            = Query(20, ge=1, le=100),
    from_date:   Optional[date] = Query(None),
    to_date:     Optional[date] = Query(None),
    type:        Optional[str]  = Query(None),
    category_id: Optional[int]  = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    q = db.query(Transaction).filter(
        Transaction.user_id    == user.id,
        Transaction.deleted_at == None,
    )
    if from_date:    q = q.filter(Transaction.date >= from_date)
    if to_date:      q = q.filter(Transaction.date <= to_date)
    if type:         q = q.filter(Transaction.type == type)
    if category_id:  q = q.filter(Transaction.category_id == category_id)

    return q.order_by(Transaction.date.desc())\
             .offset((page - 1) * limit).limit(limit).all()

@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    body: TransactionCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    tx = Transaction(user_id=user.id, **body.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx

@router.patch("/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: int,
    body:  TransactionUpdate,
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    tx = get_user_transaction(tx_id, user, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    db.commit()
    db.refresh(tx)
    return tx

@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    tx_id: int,
    db:    Session = Depends(get_db),
    user:  User    = Depends(get_current_user),
):
    tx = get_user_transaction(tx_id, user, db)
    tx.deleted_at = datetime.now(timezone.utc)
    db.commit()