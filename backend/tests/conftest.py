import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.config import settings

engine = create_engine(settings.TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    db = TestingSessionLocal()
    db.execute(text("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')"))
    db.execute(text("DELETE FROM budgets WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')"))
    db.execute(text("DELETE FROM recurring_transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')"))
    db.execute(text("DELETE FROM categories WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')"))
    db.execute(text("DELETE FROM users WHERE email LIKE '%@test.com'"))
    db.commit()
    db.close()
    yield
    db = TestingSessionLocal()
    db.execute(text("DELETE FROM transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')"))
    db.execute(text("DELETE FROM budgets WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')"))
    db.execute(text("DELETE FROM recurring_transactions WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')"))
    db.execute(text("DELETE FROM categories WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')"))
    db.execute(text("DELETE FROM users WHERE email LIKE '%@test.com'"))
    db.commit()
    db.close()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def registered_user(client):
    from app.models.user import User
    db = TestingSessionLocal()
    db.query(User).filter(User.email == "testuser@test.com").delete()
    db.commit()
    db.close()
    response = client.post("/api/v1/auth/register", json={
        "username": "testuser",
        "email": "testuser@test.com",
        "password": "testpass123"
    })
    return response.json()

@pytest.fixture
def auth_headers(registered_user):
    token = registered_user["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_client(client, auth_headers):
    client.headers.update(auth_headers)
    return client
