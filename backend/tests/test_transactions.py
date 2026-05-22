import pytest
from datetime import date

@pytest.fixture
def category_id(auth_client):
    response = auth_client.get("/api/v1/categories")
    expense_cats = [c for c in response.json() if c["type"] == "expense"]
    return expense_cats[0]["id"]

@pytest.fixture
def created_transaction(auth_client, category_id):
    response = auth_client.post("/api/v1/transactions", json={
        "category_id": category_id,
        "amount": "50.00",
        "type": "expense",
        "description": "Test transaction",
        "date": str(date.today())
    })
    return response.json()

def test_create_transaction(auth_client, category_id):
    response = auth_client.post("/api/v1/transactions", json={
        "category_id": category_id,
        "amount": "25.50",
        "type": "expense",
        "description": "Coffee",
        "date": str(date.today())
    })
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == "25.50"
    assert data["type"] == "expense"

def test_create_transaction_negative_amount(auth_client, category_id):
    response = auth_client.post("/api/v1/transactions", json={
        "category_id": category_id,
        "amount": "-10.00",
        "type": "expense",
        "description": "Bad",
        "date": str(date.today())
    })
    assert response.status_code == 422

def test_create_transaction_invalid_type(auth_client, category_id):
    response = auth_client.post("/api/v1/transactions", json={
        "category_id": category_id,
        "amount": "10.00",
        "type": "invalid",
        "description": "Bad",
        "date": str(date.today())
    })
    assert response.status_code == 422

def test_list_transactions(auth_client, created_transaction):
    response = auth_client.get("/api/v1/transactions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) >= 1

def test_list_excludes_deleted(auth_client, created_transaction):
    tx_id = created_transaction["id"]
    auth_client.delete(f"/api/v1/transactions/{tx_id}")
    response = auth_client.get("/api/v1/transactions")
    ids = [t["id"] for t in response.json()]
    assert tx_id not in ids

def test_filter_by_type(auth_client, category_id):
    auth_client.post("/api/v1/transactions", json={
        "category_id": category_id,
        "amount": "100.00",
        "type": "income",
        "description": "Salary",
        "date": str(date.today())
    })
    response = auth_client.get("/api/v1/transactions?type=income")
    assert all(t["type"] == "income" for t in response.json())

def test_filter_by_date_range(auth_client, category_id):
    response = auth_client.get(
        f"/api/v1/transactions?from_date=2026-01-01&to_date=2026-12-31"
    )
    assert response.status_code == 200

def test_filter_by_category(auth_client, category_id, created_transaction):
    response = auth_client.get(f"/api/v1/transactions?category_id={category_id}")
    assert response.status_code == 200
    assert all(t["category_id"] == category_id for t in response.json())

def test_pagination(auth_client, category_id):
    response = auth_client.get("/api/v1/transactions?page=1&limit=2")
    assert response.status_code == 200
    assert len(response.json()) <= 2

def test_update_transaction(auth_client, created_transaction):
    tx_id = created_transaction["id"]
    response = auth_client.patch(f"/api/v1/transactions/{tx_id}", json={
        "description": "Updated description"
    })
    assert response.status_code == 200
    assert response.json()["description"] == "Updated description"

def test_delete_transaction_soft(auth_client, created_transaction):
    tx_id = created_transaction["id"]
    response = auth_client.delete(f"/api/v1/transactions/{tx_id}")
    assert response.status_code == 204
    # Verify it still exists in DB but is soft deleted
    from app.models.transaction import Transaction
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    tx = db.query(Transaction).filter(Transaction.id == tx_id).first()
    assert tx is not None
    assert tx.deleted_at is not None
    db.close()

def test_delete_already_deleted(auth_client, created_transaction):
    tx_id = created_transaction["id"]
    auth_client.delete(f"/api/v1/transactions/{tx_id}")
    response = auth_client.delete(f"/api/v1/transactions/{tx_id}")
    assert response.status_code == 404

def test_cannot_access_other_users_transaction(client, auth_client, category_id):
    # Register second user
    r = client.post("/api/v1/auth/register", json={
        "username": "txuser2",
        "email": "txuser2@test.com",
        "password": "pass123"
    })
    token2 = r.json()["access_token"]
    cats = client.get("/api/v1/categories",
        headers={"Authorization": f"Bearer {token2}"}
    ).json()
    cat_id2 = [c for c in cats if c["type"] == "expense"][0]["id"]
    tx = client.post("/api/v1/transactions",
        json={"category_id": cat_id2, "amount": "10.00",
              "type": "expense", "description": "other", "date": str(date.today())},
        headers={"Authorization": f"Bearer {token2}"}
    ).json()
    response = auth_client.delete(f"/api/v1/transactions/{tx['id']}")
    assert response.status_code == 404

def test_update_nonexistent_transaction(auth_client):
    response = auth_client.patch("/api/v1/transactions/99999", json={
        "description": "ghost"
    })
    assert response.status_code == 404
