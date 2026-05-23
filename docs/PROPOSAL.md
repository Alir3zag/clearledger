# ClearLedger — Database Course Final Project Proposal

**Course:** Database Management  
**Student:** Alireza  
**Deadline:** May 30  

---

## 1. Problem Statement

Most people have no idea where their money actually goes. They estimate, they guess, and they overspend — not from a lack of discipline, but from a lack of visibility. Existing tools like Mint or YNAB are either locked to US banking APIs, bloated with features, or paywalled. A personal finance tracker built from scratch, with a clean and carefully designed relational database at its core, solves the core problem: **turning messy financial data into clear, queryable, actionable insight.**

This project is also a direct database engineering challenge. Every design decision — from schema normalization to index selection to query structure — must be justified. This proposal documents all of those decisions.

---

## 2. Domain Description

ClearLedger is a multi-user personal finance web application. Users register individually and track their own financial data in isolation — there is no data sharing between accounts.

**To reconstruct the database schema from this description alone, a reader would need to know:**

- Each **user** has a profile with a preferred display currency. All amounts stored in that currency. No exchange rate conversion occurs in the database.
- **Categories** classify every transaction. Some categories are system-wide defaults (Food, Transport, Health, Salary, etc.) and visible to all users. Users may also create their own custom categories. A category belongs to either the `expense` or `income` type — this is fixed at creation time and cannot be changed (it would invalidate existing data).
- A **transaction** is a single financial event: either an expense (money out) or income (money in). It has an amount, date, description, and belongs to exactly one category and one user. Transactions support soft deletion — they are never permanently removed from the database, only marked as deleted. This preserves historical budget accuracy.
- A **budget** is a monthly spending limit a user sets for a specific category. Only expense categories can have budgets (income categories do not have limits). A user cannot set two budgets for the same category in the same month — this is enforced at the database level via a unique constraint.
- A **recurring transaction** is a template for a financial event that repeats on a schedule (daily, weekly, monthly, or yearly). When due, it generates a real transaction linked back to the template via a foreign key. This allows the system to track which transactions were auto-generated versus manually entered.

**Entities:** Users, Categories, Budgets, Transactions, RecurringTransactions  
**Relationships:** 
- User → Categories (1:N, custom categories only)
- User → Transactions (1:N)
- User → Budgets (1:N)
- User → RecurringTransactions (1:N)
- Category → Transactions (1:N)
- Category → Budgets (1:N)
- RecurringTransaction → Transactions (1:N, generated transactions)

---

## 3. Critical User Scenarios

### Scenario 1 — New User Onboarding
1. User registers with email, username, and password
2. System seeds their account with default categories (Food, Transport, Health, Entertainment, Salary, Freelance)
3. User sets monthly budgets for expense categories they care about
4. User logs their first transaction
5. Dashboard immediately reflects spending vs budget

### Scenario 2 — Monthly Budget Review
1. User opens dashboard for the current month
2. System aggregates all non-deleted expense transactions grouped by category
3. For each category with a budget, system computes spending vs limit and remaining amount
4. System highlights over-budget categories
5. User drills into a category to see individual transactions

### Scenario 3 — Income vs Expense Analysis
1. User navigates to the Trends page
2. System queries the last 6 months of transactions
3. For each month, system computes total income, total expenses, and net savings
4. User identifies months where expenses exceeded income

### Scenario 4 — Recurring Transaction Processing
1. User sets up a recurring transaction: "Rent — €800 — monthly"
2. Each month, the system creates a real transaction from the template, linked via `recurring_id`
3. User can see in transaction history which entries were auto-generated
4. User can pause or cancel the recurring template without losing historical transactions

---

## 4. Entity Descriptions

| Entity | Purpose | Key Attributes |
|---|---|---|
| **Users** | Account holder, authentication principal | id, email, username, password_hash, currency |
| **Categories** | Classification for transactions and budgets | id, user_id (nullable), name, type, color, icon |
| **Transactions** | Core financial event record | id, user_id, category_id, amount, type, date, deleted_at |
| **Budgets** | Monthly spending limit per category | id, user_id, category_id, amount, period_start |
| **RecurringTransactions** | Template for auto-generated transactions | id, user_id, category_id, frequency, next_due_date, is_active |

---

## 5. Normalization Proof

**1NF:** Every attribute holds a single atomic value. No repeating groups. Arrays are not stored in columns — for example, a transaction belongs to exactly one category (no comma-separated category lists).

**2NF:** Every non-key attribute depends on the *entire* primary key. All tables use a single surrogate primary key (SERIAL), so partial dependencies are structurally impossible.

**3NF:** No transitive dependencies. Checked per table:
- `Transactions`: description, amount, date all depend on transaction id only. Category name is NOT stored here — only `category_id`. Storing `category_name` would create a transitive dependency (name → category_id → id). ✓
- `Budgets`: amount and period_start depend on budget id. No derived fields (e.g. "remaining" is computed at query time, never stored). ✓
- `Categories`: name, type, color depend on category id only. ✓

**Key design violation avoided:** An earlier draft considered storing `total_spent` as a column on Budgets (updated whenever a transaction is added). This is a computed/derived value — storing it violates 3NF and creates update anomalies. It is computed exclusively in queries.

---

## 6. Database Schema — SQL DDL

```sql
-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    currency      CHAR(3)      NOT NULL DEFAULT 'EUR',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- NULL user_id = system default, visible to all users
-- Non-null user_id = custom category, visible only to that user
-- ============================================================
CREATE TABLE categories (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(50)  NOT NULL,
    type       VARCHAR(10)  NOT NULL CHECK (type IN ('expense', 'income')),
    color      CHAR(7)      NOT NULL DEFAULT '#6B7280',
    icon       VARCHAR(50)  NOT NULL DEFAULT 'tag',
    is_default BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RECURRING TRANSACTIONS (must be created before transactions)
-- ============================================================
CREATE TABLE recurring_transactions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id   INTEGER      NOT NULL REFERENCES categories(id),
    amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    type          VARCHAR(10)  NOT NULL CHECK (type IN ('expense', 'income')),
    description   VARCHAR(255),
    frequency     VARCHAR(10)  NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
    next_due_date DATE         NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRANSACTIONS
-- Soft delete: deleted_at IS NULL = active record
-- recurring_id: populated when auto-generated from a template
-- ============================================================
CREATE TABLE transactions (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id  INTEGER       NOT NULL REFERENCES categories(id),
    recurring_id INTEGER       REFERENCES recurring_transactions(id) ON DELETE SET NULL,
    amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    type         VARCHAR(10)   NOT NULL CHECK (type IN ('expense', 'income')),
    description  VARCHAR(255),
    date         DATE          NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ   DEFAULT NULL
);

-- ============================================================
-- BUDGETS
-- period_start: always the first day of the month (e.g. 2025-05-01)
-- UNIQUE constraint prevents duplicate budgets for same month+category
-- ============================================================
CREATE TABLE budgets (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id  INTEGER       NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    period_start DATE          NOT NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT budgets_no_duplicates UNIQUE (user_id, category_id, period_start)
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Transactions: almost every query filters by user
CREATE INDEX idx_transactions_user_id
    ON transactions(user_id);

-- Transactions: dashboard and trend queries filter by date range
CREATE INDEX idx_transactions_date
    ON transactions(date);

-- Transactions: composite index — most queries filter by BOTH user AND date
CREATE INDEX idx_transactions_user_date
    ON transactions(user_id, date);

-- Transactions: partial index — excludes soft-deleted rows from all scans
CREATE INDEX idx_transactions_active
    ON transactions(user_id, date)
    WHERE deleted_at IS NULL;

-- Budgets: budget lookup queries always filter by user + period
CREATE INDEX idx_budgets_user_period
    ON budgets(user_id, period_start);

-- RecurringTransactions: scheduler queries for due transactions
CREATE INDEX idx_recurring_due
    ON recurring_transactions(next_due_date)
    WHERE is_active = TRUE;
```

---

## 7. Database Schema — DBML

```dbml
Table users {
  id            integer     [primary key, increment]
  username      varchar(50) [unique, not null]
  email         varchar(255)[unique, not null]
  password_hash varchar(255)[not null]
  currency      char(3)     [not null, default: 'EUR']
  created_at    timestamptz [not null, default: `now()`]
  updated_at    timestamptz [not null, default: `now()`]
}

Table categories {
  id         integer    [primary key, increment]
  user_id    integer    [ref: > users.id, note: 'NULL = system default']
  name       varchar(50)[not null]
  type       varchar(10)[not null, note: 'expense | income']
  color      char(7)    [not null, default: '#6B7280']
  icon       varchar(50)[not null, default: 'tag']
  is_default boolean    [not null, default: false]
  created_at timestamptz[not null, default: `now()`]
}

Table recurring_transactions {
  id            integer      [primary key, increment]
  user_id       integer      [not null, ref: > users.id]
  category_id   integer      [not null, ref: > categories.id]
  amount        decimal(12,2)[not null]
  type          varchar(10)  [not null, note: 'expense | income']
  description   varchar(255)
  frequency     varchar(10)  [not null, note: 'daily | weekly | monthly | yearly']
  next_due_date date         [not null]
  is_active     boolean      [not null, default: true]
  created_at    timestamptz  [not null, default: `now()`]
}

Table transactions {
  id           integer      [primary key, increment]
  user_id      integer      [not null, ref: > users.id]
  category_id  integer      [not null, ref: > categories.id]
  recurring_id integer      [ref: > recurring_transactions.id, note: 'NULL if manual']
  amount       decimal(12,2)[not null]
  type         varchar(10)  [not null, note: 'expense | income']
  description  varchar(255)
  date         date         [not null]
  created_at   timestamptz  [not null, default: `now()`]
  updated_at   timestamptz  [not null, default: `now()`]
  deleted_at   timestamptz  [note: 'NULL = active, non-NULL = soft-deleted']
}

Table budgets {
  id           integer      [primary key, increment]
  user_id      integer      [not null, ref: > users.id]
  category_id  integer      [not null, ref: > categories.id]
  amount       decimal(12,2)[not null]
  period_start date         [not null, note: 'Always first of month, e.g. 2025-05-01']
  created_at   timestamptz  [not null, default: `now()`]
  updated_at   timestamptz  [not null, default: `now()`]

  indexes {
    (user_id, category_id, period_start) [unique, name: 'budgets_no_duplicates']
  }
}
```

---

## 8. Required Queries

### Query 1 — Spending vs Budget per Category (Current Month)

**Business question:** For a given user, how much have they spent in each budgeted category this month, and how much of their budget remains?

```sql
SELECT
    c.name                                         AS category,
    c.color,
    b.amount                                       AS budget_limit,
    COALESCE(SUM(t.amount), 0)                     AS total_spent,
    b.amount - COALESCE(SUM(t.amount), 0)          AS remaining,
    ROUND(
        COALESCE(SUM(t.amount), 0) / b.amount * 100, 1
    )                                              AS pct_used
FROM budgets b
JOIN categories c
    ON c.id = b.category_id
LEFT JOIN transactions t
    ON  t.category_id  = b.category_id
    AND t.user_id      = b.user_id
    AND t.type         = 'expense'
    AND t.deleted_at   IS NULL
    AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE)
WHERE b.user_id      = :user_id
  AND b.period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE
GROUP BY c.name, c.color, b.amount
ORDER BY pct_used DESC;
```

**Concepts demonstrated:** LEFT JOIN, COALESCE for NULL handling, DATE_TRUNC for month grouping, computed percentage column.

---

### Query 2 — Net Savings Trend (Last 6 Months)

**Business question:** For each of the last 6 months, what was the user's total income, total expenses, and net savings?

```sql
SELECT
    DATE_TRUNC('month', date)                                      AS month,
    SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END)         AS total_income,
    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)         AS total_expenses,
    SUM(CASE WHEN type = 'income'  THEN amount ELSE -amount END)   AS net_savings
FROM transactions
WHERE user_id    = :user_id
  AND deleted_at IS NULL
  AND date       >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
GROUP BY DATE_TRUNC('month', date)
ORDER BY month ASC;
```

**Concepts demonstrated:** Conditional aggregation with CASE WHEN, DATE arithmetic with INTERVAL, filtering on the partial index column.

---

### Query 3 — Top 5 Expense Categories by Share of Monthly Spend

**Business question:** This month, which categories took the biggest slice of the user's total spending?

```sql
WITH monthly_total AS (
    SELECT SUM(amount) AS grand_total
    FROM transactions
    WHERE user_id    = :user_id
      AND type       = 'expense'
      AND deleted_at IS NULL
      AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
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
  AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY c.name, c.color, mt.grand_total
ORDER BY spent DESC
LIMIT 5;
```

**Concepts demonstrated:** CTE (WITH clause), CROSS JOIN for sharing a scalar value across rows, LIMIT, percentage calculation.

---

## 9. Index Justification

| Index | Type | Justification |
|---|---|---|
| `idx_transactions_user_id` | B-Tree | Every query filters by user_id |
| `idx_transactions_date` | B-Tree | Trend and budget queries always filter by date range |
| `idx_transactions_user_date` | B-Tree (composite) | Covers the most frequent query pattern: WHERE user_id = X AND date >= Y |
| `idx_transactions_active` | Partial B-Tree | Partial index over WHERE deleted_at IS NULL. Small and fast since most rows are active |
| `idx_budgets_user_period` | B-Tree (composite) | Budget lookup always filters by user_id AND period_start |
| `idx_recurring_due` | Partial B-Tree | Scheduler query uses this. Excludes inactive templates |

---

## 10. Fake Data Strategy

Data is seeded using Python's `Faker` library. All seeded data respects every database constraint:

- `period_start` in budgets is always set to the first of a month
- `budget.category_id` always references a category of `type = 'expense'`
- Budget unique constraint respected — one per (user, category, month)
- `deleted_at` is NULL for ~90% of transactions, random past timestamp for ~10%
- All `amount` values use Python's `Decimal` type

Minimum seeded dataset: 3 users, 8 system categories, 180 transactions, 72 budgets, 6 recurring templates.

---

## 11. Deployment Plan

| Component | Service | Reason |
|---|---|---|
| PostgreSQL | Supabase (free tier) | Instant hosted Postgres |
| FastAPI backend | Render (free tier) | Docker-based deploy, auto-deploy from GitHub |
| React frontend | Vercel | Zero-config deploy, instant CDN, free |
| Migrations | Alembic | Runs on deploy |
| Environment secrets | Render env vars + Vercel env vars | Never committed to Git |

**Live URLs:**
- Frontend: https://clearledger-eta.vercel.app
- Backend: https://clearledger-api-8r35.onrender.com
