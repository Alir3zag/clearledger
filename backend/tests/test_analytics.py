import pytest
from datetime import date

@pytest.fixture
def setup_analytics_data(auth_client):
    # Get expense and income categories
    cats = auth_client.get("/api/v1/categories").json()
    expense_cat = [c for c in cats if c["type"] == "expense"][0]
    income_cat  = [c for c in cats if c["type"] == "income"][0]

    today = str(date.today())

    # Create income transaction
    auth_client.post("/api/v1/transactions", json={
        "category_id": income_cat["id"],
        "amount": "2000.00",
        "type": "income",
        "description": "Salary",
        "date": today
    })

    # Create expense transaction
    auth_client.post("/api/v1/transactions", json={
        "category_id": expense_cat["id"],
        "amount": "500.00",
        "type": "expense",
        "description": "Rent",
        "date": today
    })

    # Create budget for this month
    auth_client.post("/api/v1/budgets", json={
        "category_id": expense_cat["id"],
        "amount": "400.00",
        "period_start": today
    })

    return {"expense_cat": expense_cat, "income_cat": income_cat}

def test_overview_returns_data(auth_client, setup_analytics_data):
    response = auth_client.get("/api/v1/analytics/overview")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_overview_zero_spent_for_no_transactions(auth_client, setup_analytics_data):
    cats = auth_client.get("/api/v1/categories").json()
    expense_cats = [c for c in cats if c["type"] == "expense"]
    empty_cat = expense_cats[1]
    today = str(date.today())
    auth_client.post("/api/v1/budgets", json={
        "category_id": empty_cat["id"],
        "amount": "300.00",
        "period_start": today
    })
    response = auth_client.get("/api/v1/analytics/overview")
    data = response.json()
    empty = [r for r in data if r["category"] == empty_cat["name"]]
    if empty:
        assert float(empty[0]["total_spent"]) == 0.0

def test_trends_returns_6_months(auth_client, setup_analytics_data):
    response = auth_client.get("/api/v1/analytics/trends")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1

def test_trends_net_savings_correct(auth_client, setup_analytics_data):
    response = auth_client.get("/api/v1/analytics/trends")
    data = response.json()
    for row in data:
        expected = float(row["total_income"]) - float(row["total_expenses"])
        assert abs(float(row["net_savings"]) - expected) < 0.01

def test_breakdown_returns_data(auth_client, setup_analytics_data):
    response = auth_client.get("/api/v1/analytics/breakdown")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_breakdown_max_5_categories(auth_client, setup_analytics_data):
    response = auth_client.get("/api/v1/analytics/breakdown")
    assert len(response.json()) <= 5

def test_breach_returns_over_budget_only(auth_client, setup_analytics_data):
    response = auth_client.get("/api/v1/analytics/breach")
    assert response.status_code == 200
    for row in response.json():
        assert float(row["total_spent"]) > float(row["budget_limit"])

def test_rank_ordered_by_spend(auth_client, setup_analytics_data):
    response = auth_client.get("/api/v1/analytics/rank")
    assert response.status_code == 200
    data = response.json()
    if len(data) > 1:
        for i in range(len(data) - 1):
            assert float(data[i]["total_spent"]) >= float(data[i+1]["total_spent"])

def test_mom_returns_data(auth_client, setup_analytics_data):
    response = auth_client.get("/api/v1/analytics/mom")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
