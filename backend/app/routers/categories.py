from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryOut
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/categories", tags=["categories"])

@router.get("", response_model=List[CategoryOut])
def list_categories(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return db.query(Category).filter(
        or_(Category.user_id == user.id, Category.user_id == None)
    ).all()

@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if body.type not in ("expense", "income"):
        raise HTTPException(status_code=422, detail="type must be 'expense' or 'income'")
    cat = Category(user_id=user.id, **body.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    cat = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == user.id
    ).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.commit()
