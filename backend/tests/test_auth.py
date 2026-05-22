def test_register_success(client):
    response = client.post("/api/v1/auth/register", json={
        "username": "newuser",
        "email": "newuser@test.com",
        "password": "password123"
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "newuser@test.com"

def test_register_duplicate_email(client, registered_user):
    response = client.post("/api/v1/auth/register", json={
        "username": "different",
        "email": "testuser@test.com",
        "password": "password123"
    })
    assert response.status_code == 409

def test_register_duplicate_username(client, registered_user):
    response = client.post("/api/v1/auth/register", json={
        "username": "testuser",
        "email": "different@test.com",
        "password": "password123"
    })
    assert response.status_code == 409

def test_login_success(client, registered_user):
    response = client.post("/api/v1/auth/login", json={
        "email": "testuser@test.com",
        "password": "testpass123"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_wrong_password(client, registered_user):
    response = client.post("/api/v1/auth/login", json={
        "email": "testuser@test.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401

def test_login_nonexistent_email(client):
    response = client.post("/api/v1/auth/login", json={
        "email": "nobody@test.com",
        "password": "password123"
    })
    assert response.status_code == 401

def test_me_success(auth_client):
    response = auth_client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "testuser@test.com"

def test_me_no_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401

def test_me_invalid_token(client):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalidtoken"}
    )
    assert response.status_code == 401
