from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.category import Category
from app.schemas.user import UserRegister, UserLogin, UserOut, TokenOut
from app.utils.hashing import hash_password, verify_password
from app.utils.auth import create_access_token, get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

DEFAULT_CATEGORIES = [
    {"name": "Food",          "type": "expense", "color": "#EF4444", "icon": "utensils"},
    {"name": "Transport",     "type": "expense", "color": "#F97316", "icon": "car"},
    {"name": "Health",        "type": "expense", "color": "#22C55E", "icon": "heart"},
    {"name": "Entertainment", "type": "expense", "color": "#A855F7", "icon": "music"},
    {"name": "Housing",       "type": "expense", "color": "#3B82F6", "icon": "home"},
    {"name": "Groceries",     "type": "expense", "color": "#FBBF24", "icon": "shopping-cart"},
    {"name": "Salary",        "type": "income",  "color": "#10B981", "icon": "briefcase"},
    {"name": "Freelance",     "type": "income",  "color": "#06B6D4", "icon": "laptop"},
]

@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()

    for cat in DEFAULT_CATEGORIES:
        db.add(Category(user_id=user.id, is_default=True, **cat))

    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))

@router.post("/login", response_model=TokenOut)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id)})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))

@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user