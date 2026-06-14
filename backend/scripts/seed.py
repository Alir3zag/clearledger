import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from decimal import Decimal
from datetime import date, timedelta, datetime, timezone
import random
from faker import Faker
from app.database import SessionLocal
from app.models.user import User
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.recurring import RecurringTransaction
from app.utils.hashing import hash_password

fake = Faker()

CATEGORIES = [
    {"name": "Food",          "type": "expense", "color": "#EF4444", "icon": "utensils"},
    {"name": "Transport",     "type": "expense", "color": "#F97316", "icon": "car"},
    {"name": "Health",        "type": "expense", "color": "#22C55E", "icon": "heart"},
    {"name": "Entertainment", "type": "expense", "color": "#A855F7", "icon": "music"},
    {"name": "Housing",       "type": "expense", "color": "#3B82F6", "icon": "home"},
    {"name": "Groceries",     "type": "expense", "color": "#FBBF24", "icon": "shopping-cart"},
    {"name": "Salary",        "type": "income",  "color": "#10B981", "icon": "briefcase"},
    {"name": "Freelance",     "type": "income",  "color": "#06B6D4", "icon": "laptop"},
]

def first_of_month(year: int, month: int) -> date:
    return date(year, month, 1)

def random_amount(low: float, high: float) -> Decimal:
    return Decimal(str(round(random.uniform(low, high), 2)))

def delete_user_data(db, user):
    db.query(RecurringTransaction).filter(RecurringTransaction.user_id == user.id).delete()
    db.query(Budget).filter(Budget.user_id == user.id).delete()
    db.query(Transaction).filter(Transaction.user_id == user.id).delete()
    db.query(Category).filter(Category.user_id == user.id).delete()
    db.flush()

def seed_user(db, i, today):
    username = f"user_{i+1}"
    email    = f"user{i+1}@clearledger.dev"

    user = db.query(User).filter(User.email == email).first()

    if user:
        print(f"  {email} exists — wiping old data and reseeding...")
        delete_user_data(db, user)
        user.password_hash = hash_password("password123")
        user.currency = "EUR"
        db.flush()
    else:
        print(f"  Creating {email}...")
        user = User(
            username=username,
            email=email,
            password_hash=hash_password("password123"),
            currency="EUR",
        )
        db.add(user)
        db.flush()

    # Seed categories
    cats = []
    for cat_data in CATEGORIES:
        cat = Category(user_id=user.id, is_default=True, **cat_data)
        db.add(cat)
        db.flush()
        cats.append(cat)

    expense_cats = [c for c in cats if c.type == "expense"]
    income_cats  = [c for c in cats if c.type == "income"]

    all_transactions = []

    # 6 months of transactions: 5 months ago → current month (index 0 = current month)
    for months_ago in range(5, -1, -1):
        month = today.month - months_ago
        year  = today.year
        while month <= 0:
            month += 12
            year  -= 1

        period = first_of_month(year, month)

        # Cap days so current month doesn't generate future dates
        max_day = (today - period).days if months_ago == 0 else 27
        if max_day < 0:
            max_day = 0

        # Monthly salary
        db.add(Transaction(
            user_id=user.id,
            category_id=random.choice(income_cats).id,
            amount=random_amount(1800, 3000),
            type="income",
            description="Monthly salary",
            date=period,
        ))

        # 8-12 expenses
        for _ in range(random.randint(8, 12)):
            cat = random.choice(expense_cats)
            tx  = Transaction(
                user_id=user.id,
                category_id=cat.id,
                amount=random_amount(5, 300),
                type="expense",
                description=fake.sentence(nb_words=4),
                date=period + timedelta(days=random.randint(0, max(0, max_day))),
            )
            db.add(tx)
            all_transactions.append(tx)

        # Budget for 4 expense categories
        for cat in expense_cats[:4]:
            db.add(Budget(
                user_id=user.id,
                category_id=cat.id,
                amount=random_amount(200, 600),
                period_start=period,
            ))

    db.flush()

    # Soft-delete ~10% of transactions
    for tx in random.sample(all_transactions, k=max(1, len(all_transactions) // 10)):
        tx.deleted_at = datetime.now(timezone.utc)

    # 2 recurring transactions
    for _ in range(2):
        db.add(RecurringTransaction(
            user_id=user.id,
            category_id=random.choice(expense_cats).id,
            amount=random_amount(50, 200),
            type="expense",
            description=fake.word().capitalize() + " subscription",
            frequency="monthly",
            next_due_date=today + timedelta(days=random.randint(1, 30)),
            is_active=True,
        ))

    db.commit()
    print(f"  Done: {username}")

def seed():
    db = SessionLocal()
    today = date.today()

    print("Reseeding 3 users with data through current month...")

    for i in range(3):
        seed_user(db, i, today)

    db.close()
    print("All done.")

if __name__ == "__main__":
    seed()