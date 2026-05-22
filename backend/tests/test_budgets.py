import pytest

@pytest.fixture
def all_expense_categories(auth_client):
    response = auth_client.get("/api/v1/categories")
    return [c for c in response.json() if c["type"] == "expense"]

@pytest.fixture
def created_budget(auth_client, all_expense_categories):
    # Use last expense category to avoid collision with other tests
    cat_id = all_expense_categories[-1]["id"]
    response = auth_client.post("/api/v1/budgets", json={
        "category_id": cat_id,
        "amount": "500.00",
        "period_start": "2031-01-15"
    })
    return response.json()

def test_create_budget(auth_client, all_expense_categories):
    cat_id = all_expense_categories[0]["id"]
    response = auth_client.post("/api/v1/budgets", json={
        "category_id": cat_id,
        "amount": "300.00",
        "period_start": "2031-02-15"
    })
    assert response.status_code == 201
    assert response.json()["amount"] == "300.00"
    assert response.json()["period_start"] == "2031-02-01"

def test_create_budget_normalizes_period(auth_client, all_expense_categories):
    cat_id = all_expense_categories[1]["id"]
    response = auth_client.post("/api/v1/budgets", json={
        "category_id": cat_id,
        "amount": "200.00",
        "period_start": "2031-03-20"
    })
    assert response.status_code == 201
    assert response.json()["period_start"] == "2031-03-01"

def test_create_duplicate_budget_returns_409(auth_client, all_expense_categories):
    cat_id = all_expense_categories[2]["id"]
    auth_client.post("/api/v1/budgets", json={
        "category_id": cat_id,
        "amount": "100.00",
        "period_start": "2031-04-01"
    })
    response = auth_client.post("/api/v1/budgets", json={
        "category_id": cat_id,
        "amount": "999.00",
        "period_start": "2031-04-01"
    })
    assert response.status_code == 409

def test_list_budgets(auth_client, created_budget):
    response = auth_client.get("/api/v1/budgets")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) >= 1

def test_update_budget(auth_client, created_budget):
    budget_id = created_budget["id"]
    response = auth_client.patch(f"/api/v1/budgets/{budget_id}", json={
        "amount": "750.00"
    })
    assert response.status_code == 200
    assert response.json()["amount"] == "750.00"

def test_update_other_users_budget_returns_404(client, auth_client):
    r = client.post("/api/v1/auth/register", json={
        "username": "budgetuser2",
        "email": "budgetuser2@test.com",
        "password": "pass123"
    })
    token2 = r.json()["access_token"]
    cats = client.get("/api/v1/categories",
        headers={"Authorization": f"Bearer {token2}"}
    ).json()
    cat_id2 = [c for c in cats if c["type"] == "expense"][0]["id"]
    budget = client.post("/api/v1/budgets",
        json={"category_id": cat_id2, "amount": "100.00", "period_start": "2031-05-01"},
        headers={"Authorization": f"Bearer {token2}"}
    ).json()
    response = auth_client.patch(f"/api/v1/budgets/{budget['id']}", json={
        "amount": "999.00"
    })
    assert response.status_code == 404
