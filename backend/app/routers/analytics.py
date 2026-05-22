from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

@router.get("/overview")
def budget_overview(
    period_start: Optional[date] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    if not period_start:
        today = date.today()
        period_start = today.replace(day=1)
    rows = db.execute(text("""
        SELECT
            c.name                                          AS category,
            c.color,
            b.amount                                        AS budget_limit,
            COALESCE(SUM(t.amount), 0)                      AS total_spent,
            b.amount - COALESCE(SUM(t.amount), 0)           AS remaining,
            ROUND(COALESCE(SUM(t.amount), 0) / b.amount * 100, 1) AS pct_used
        FROM budgets b
        JOIN categories c ON c.id = b.category_id
        LEFT JOIN transactions t
            ON  t.category_id  = b.category_id
            AND t.user_id      = b.user_id
            AND t.type         = 'expense'
            AND t.deleted_at   IS NULL
            AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CAST(:period AS DATE))
        WHERE b.user_id      = :user_id
          AND b.period_start = :period
        GROUP BY c.name, c.color, b.amount
        ORDER BY pct_used DESC
    """), {"user_id": user.id, "period": period_start}).mappings().all()
    return [dict(r) for r in rows]

@router.get("/trends")
def savings_trends(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT
            DATE_TRUNC('month', date)                                     AS month,
            SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END)        AS total_income,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)        AS total_expenses,
            SUM(CASE WHEN type = 'income'  THEN amount ELSE -amount END)  AS net_savings
        FROM transactions
        WHERE user_id    = :user_id
          AND deleted_at IS NULL
          AND date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
        GROUP BY DATE_TRUNC('month', date)
        ORDER BY month ASC
    """), {"user_id": user.id}).mappings().all()
    return [dict(r) for r in rows]

@router.get("/breakdown")
def category_breakdown(
    period_start: Optional[date] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    if not period_start:
        today = date.today()
        period_start = today.replace(day=1)
    rows = db.execute(text("""
        WITH monthly_total AS (
            SELECT SUM(amount) AS grand_total
            FROM transactions
            WHERE user_id    = :user_id
              AND type       = 'expense'
              AND deleted_at IS NULL
              AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CAST(:period AS DATE))
        )
        SELECT
            c.name                                               AS category,
            c.color,
            SUM(t.amount)                                        AS spent,
            ROUND(SUM(t.amount) / mt.grand_total * 100, 2)      AS pct_of_total
        FROM transactions t
        JOIN categories c     ON c.id = t.category_id
        CROSS JOIN monthly_total mt
        WHERE t.user_id    = :user_id
          AND t.type       = 'expense'
          AND t.deleted_at IS NULL
          AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CAST(:period AS DATE))
        GROUP BY c.name, c.color, mt.grand_total
        ORDER BY spent DESC
        LIMIT 5
    """), {"user_id": user.id, "period": period_start}).mappings().all()
    return [dict(r) for r in rows]

@router.get("/breach")
def budget_breach(
    period_start: Optional[date] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    if not period_start:
        today = date.today()
        period_start = today.replace(day=1)
    rows = db.execute(text("""
        SELECT
            c.name                                      AS category,
            c.color,
            b.amount                                    AS budget_limit,
            COALESCE(SUM(t.amount), 0)                  AS total_spent,
            COALESCE(SUM(t.amount), 0) - b.amount       AS overspent_by
        FROM budgets b
        JOIN categories c ON c.id = b.category_id
        LEFT JOIN transactions t
            ON  t.category_id  = b.category_id
            AND t.user_id      = b.user_id
            AND t.type         = 'expense'
            AND t.deleted_at   IS NULL
            AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CAST(:period AS DATE))
        WHERE b.user_id      = :user_id
          AND b.period_start = :period
        GROUP BY c.name, c.color, b.amount
        HAVING COALESCE(SUM(t.amount), 0) > b.amount
        ORDER BY overspent_by DESC
    """), {"user_id": user.id, "period": period_start}).mappings().all()
    return [dict(r) for r in rows]

@router.get("/rank")
def category_rank(
    period_start: Optional[date] = Query(None),
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    if not period_start:
        today = date.today()
        period_start = today.replace(day=1)
    rows = db.execute(text("""
        SELECT
            c.name                                          AS category,
            c.color,
            SUM(t.amount)                                   AS total_spent,
            RANK() OVER (ORDER BY SUM(t.amount) DESC)       AS rank
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        WHERE t.user_id    = :user_id
          AND t.type       = 'expense'
          AND t.deleted_at IS NULL
          AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CAST(:period AS DATE))
        GROUP BY c.name, c.color
        ORDER BY rank
    """), {"user_id": user.id, "period": period_start}).mappings().all()
    return [dict(r) for r in rows]

@router.get("/mom")
def month_over_month(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    rows = db.execute(text("""
        WITH monthly AS (
            SELECT
                DATE_TRUNC('month', date)                               AS month,
                c.name                                                  AS category,
                SUM(t.amount)                                           AS total_spent
            FROM transactions t
            JOIN categories c ON c.id = t.category_id
            WHERE t.user_id    = :user_id
              AND t.type       = 'expense'
              AND t.deleted_at IS NULL
              AND date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
            GROUP BY DATE_TRUNC('month', date), c.name
        )
        SELECT
            month,
            category,
            total_spent,
            LAG(total_spent) OVER (PARTITION BY category ORDER BY month) AS prev_month_spent,
            total_spent - LAG(total_spent) OVER (PARTITION BY category ORDER BY month) AS change
        FROM monthly
        ORDER BY category, month
    """), {"user_id": user.id}).mappings().all()
    return [dict(r) for r in rows]
