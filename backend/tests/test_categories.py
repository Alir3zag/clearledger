def test_list_categories_returns_defaults(auth_client):
    response = auth_client.get("/api/v1/categories")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 8

def test_create_custom_category(auth_client):
    response = auth_client.post("/api/v1/categories", json={
        "name": "Gaming",
        "type": "expense",
        "color": "#FF0000",
        "icon": "gamepad"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Gaming"
    assert data["is_default"] == False

def test_create_category_invalid_type(auth_client):
    response = auth_client.post("/api/v1/categories", json={
        "name": "Invalid",
        "type": "invalid_type",
        "color": "#FF0000",
        "icon": "tag"
    })
    assert response.status_code == 422

def test_delete_custom_category(auth_client):
    # Create one first
    create = auth_client.post("/api/v1/categories", json={
        "name": "ToDelete",
        "type": "expense",
        "color": "#000000",
        "icon": "tag"
    })
    cat_id = create.json()["id"]
    response = auth_client.delete(f"/api/v1/categories/{cat_id}")
    assert response.status_code == 204

def test_delete_nonexistent_category(auth_client):
    response = auth_client.delete("/api/v1/categories/99999")
    assert response.status_code == 404

def test_cannot_delete_other_users_category(client, registered_user, auth_client):
    # Register second user
    client.post("/api/v1/auth/register", json={
        "username": "user2",
        "email": "user2@test.com",
        "password": "pass123"
    })
    login = client.post("/api/v1/auth/login", json={
        "email": "user2@test.com",
        "password": "pass123"
    })
    token2 = login.json()["access_token"]
    # user2 creates a category
    cat = client.post("/api/v1/categories",
        json={"name": "User2Cat", "type": "expense", "color": "#fff", "icon": "tag"},
        headers={"Authorization": f"Bearer {token2}"}
    )
    cat_id = cat.json()["id"]
    # user1 tries to delete it
    response = auth_client.delete(f"/api/v1/categories/{cat_id}")
    assert response.status_code == 404
