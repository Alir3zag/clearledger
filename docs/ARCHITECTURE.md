# ClearLedger — Product Vision, Architecture & Engineering Reference

---

## Product Vision

**One-line:** See exactly where your money goes, every month, without friction.

**Problem:** Generic finance apps are either locked to US banking APIs, bloated with features that overwhelm casual users, or built on weak data models that break when you query them seriously. ClearLedger is the opposite — a deliberately scoped, well-engineered personal finance tracker where every feature earns its place and every number is provably correct.

**Target user:** A student or early-career professional who wants to build financial awareness without the complexity of full budgeting software.

**Design philosophy:**
- One source of truth — the database. The application is just a window into it
- Every number on the screen must be derivable from a single, auditable SQL query
- No magic, no black-box calculations, no numbers that can't be explained

---

## What We Explicitly Chose Not to Build

| Excluded Feature | Why |
|---|---|
| Bank sync / Plaid integration | Requires OAuth flows, per-country APIs, bank-specific parsers |
| Receipt scanning / OCR | Infrastructure problem, not a database problem |
| Shared expenses / splitting | Requires a fundamentally different schema |
| Multi-currency conversion | Requires a live exchange rate table. Clean scope cut |
| Push notifications | Infrastructure concern, not relevant to the DB course |
| `total_spent` column on Budgets | Violates 3NF — computed values must never be stored |

---

## Critical Design Decisions

### Decision 1: Single transactions table, not Expenses + Income tables

**Chosen:** Single `transactions` table with `type VARCHAR CHECK(IN('expense','income'))`

All analytical queries are single scans with CASE WHEN. Adding a new type is one migration, not a new table. The type CHECK constraint provides the same data integrity as separate tables.

---

### Decision 2: NULL user_id for system categories

**Chosen:** Single `categories` table. `user_id IS NULL` = system-owned

No duplication, one table for all category queries, single JOIN in all cases. 1000 users × 8 defaults would create 8000 redundant rows with the alternative approach. Update anomaly: renaming "Food" would require updating 1000 rows.

---

### Decision 3: Soft deletes via deleted_at

**Chosen:** Soft delete — set `deleted_at = NOW()`, never actually DELETE rows

Historical accuracy preserved. If a user logs rent (€800) and deletes the transaction, the budget history must remain intact. Every query includes `WHERE deleted_at IS NULL`. Partial index on `deleted_at IS NULL` enforces correctness and efficiency simultaneously.

---

### Decision 4: period_start DATE vs month + year integers

**Chosen:** `period_start DATE NOT NULL` (always YYYY-MM-01)

Cannot use DATE_TRUNC, BETWEEN, or date arithmetic on separate integer columns. The application enforces day=01 before insert.

---

### Decision 5: NUMERIC(12,2) for all money columns

`FLOAT` stores money values as binary fractions. `0.1 + 0.2` evaluates to `0.30000000000000004`. In a finance tracker, totals become silently wrong over time.

`NUMERIC(12,2)` means: up to 10 digits before the decimal, exactly 2 after. Exact. Always.

---

### Decision 6: UNIQUE constraint on Budgets at database level

Application-level checks are vulnerable to race conditions. Two simultaneous requests can both pass the check before either insert commits, resulting in duplicate budgets.

```sql
CONSTRAINT budgets_no_duplicates UNIQUE (user_id, category_id, period_start)
```

The database enforces this atomically. The service layer catches `IntegrityError` and returns a clean 409 Conflict.

---

### Decision 7: recurring_id foreign key on Transactions

Without this link, a user cannot tell if a transaction was manually entered or auto-generated from a recurring template. With `recurring_id`, you can filter `WHERE recurring_id IS NOT NULL` to see all auto-generated transactions, or group by `recurring_id` to see total spend per template over time.

---

## What the Lectures Directly Influenced

| Lecture Topic | Application in ClearLedger |
|---|---|
| **Lec 1** — Surrogate keys preferred | All tables use SERIAL primary keys |
| **Lec 1** — NUMERIC for money, FLOAT for science | All amount columns are NUMERIC(12,2) |
| **Lec 1** — TIMESTAMPTZ over TIMESTAMP | All timestamp columns use TIMESTAMPTZ |
| **Lec 1** — Migrations versioned in Git | Alembic in `/migrations/` |
| **Lec 3** — No computed/derived values stored | `remaining_budget` and `pct_used` computed in queries, never stored |
| **Lec 3** — CTEs for complex queries | Query 3 (category breakdown) uses a CTE for the monthly total |
| **Lec 3** — HAVING vs WHERE | Budget overview query uses LEFT JOIN + COALESCE correctly, not HAVING |
| **Lec 4** — UNIQUE constraints in DDL | `UNIQUE(user_id, category_id, period_start)` on budgets |
| **Lec 4** — CHECK constraints | `CHECK(amount > 0)`, `CHECK(type IN ('expense','income'))` |
| **Lec 5** — Parameterized queries prevent SQL injection | SQLAlchemy ORM never does string interpolation into SQL |
| **Lec 6** — Partial indexes reduce index size | `WHERE deleted_at IS NULL` partial index keeps index file small |

---

## API Design Principles

1. **Versioned from day one:** All routes under `/api/v1/`
2. **user_id never in request body:** Always extracted from the JWT token
3. **Pagination on all list endpoints:** `?page=1&limit=20`
4. **Consistent error format:** `{"detail": "message", "code": "ERROR_CODE"}`
5. **Date params as ISO strings:** `from_date=2025-05-01`
6. **Soft delete returns 204, not 200**

---

## Analytics Endpoints Summary

| Endpoint | SQL Features Used |
|---|---|
| `/analytics/overview` | LEFT JOIN, COALESCE, DATE_TRUNC, GROUP BY |
| `/analytics/trends` | CASE WHEN, DATE arithmetic, INTERVAL |
| `/analytics/breakdown` | CTE, CROSS JOIN, percentage calculation, LIMIT |
| `/analytics/breach` | HAVING clause, budget vs spent comparison |
| `/analytics/rank` | RANK() window function |
| `/analytics/mom` | LAG() window function, month-over-month delta |

---

## Known Limitations

| Limitation | Impact | Future fix |
|---|---|---|
| One currency per user | Users who travel can't track accurately | Exchange rates table |
| No budget rollover | Unused budget doesn't carry forward | `rolled_over_from` column |
| Recurring transactions require manual trigger | No background scheduler | APScheduler or Celery Beat |
| Free-tier deployment limits | Render spins down after inactivity, cold start ~30s | Upgrade tier |

---

## Live Deployment

| Service | URL |
|---|---|
| Frontend | https://clearledger-eta.vercel.app |
| Backend API | https://clearledger-api-8r35.onrender.com |
| API Docs | https://clearledger-api-8r35.onrender.com/docs |
| Health Check | https://clearledger-api-8r35.onrender.com/health |
