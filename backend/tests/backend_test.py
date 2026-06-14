"""Backend API tests for UI2Code SaaS app.

Covers: auth (register/login/me/logout/profile), generate (Claude vision),
projects CRUD, stats, route protection.
"""
import os
import io
import time
import base64
import uuid
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://multi-page-portal-8.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ui2code.dev"
ADMIN_PASSWORD = "admin123"


# ---------------------- Fixtures ----------------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def new_user_session():
    s = requests.Session()
    suffix = uuid.uuid4().hex[:8]
    email = f"test_user_{suffix}@example.com"
    pw = "TestPass123!"
    r = s.post(f"{API}/auth/register", json={"name": "TEST User", "email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    s.email = email
    s.password = pw
    return s


@pytest.fixture(scope="session")
def sample_image_b64():
    """A small but visually rich PNG (UI-like)."""
    img = Image.new("RGB", (320, 200), (24, 24, 27))
    d = ImageDraw.Draw(img)
    d.rectangle([10, 10, 310, 50], fill=(63, 63, 70))
    d.text((20, 22), "UI2Code Demo", fill=(255, 255, 255))
    d.rectangle([10, 70, 150, 180], fill=(99, 102, 241))
    d.text((20, 90), "Login", fill=(255, 255, 255))
    d.rectangle([160, 70, 310, 180], outline=(255, 255, 255), width=2)
    d.text((170, 90), "Sign up", fill=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


# ---------------------- Health ----------------------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("message") == "UI2Code API"


# ---------------------- Auth ----------------------
class TestAuth:
    def test_admin_login_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert body["role"] == "admin"
        assert "id" in body
        # cookies set
        cookie_names = {c.name for c in s.cookies}
        assert "access_token" in cookie_names
        assert "refresh_token" in cookie_names

    def test_login_invalid_credentials(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"}, timeout=15)
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_authenticated(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_register_and_me(self, new_user_session):
        r = new_user_session.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == new_user_session.email
        assert r.json()["plan"] == "Free"

    def test_register_duplicate(self, new_user_session):
        r = requests.post(f"{API}/auth/register", json={
            "name": "dup", "email": new_user_session.email, "password": "anotherpw"}, timeout=15)
        assert r.status_code == 400

    def test_update_profile_persists(self, new_user_session):
        new_name = f"TEST Updated {uuid.uuid4().hex[:4]}"
        r = new_user_session.put(f"{API}/auth/profile", json={"name": new_name}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == new_name
        # Verify persistence via /me
        r2 = new_user_session.get(f"{API}/auth/me", timeout=10)
        assert r2.json()["name"] == new_name

    def test_logout_clears_cookies(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert s.get(f"{API}/auth/me", timeout=10).status_code == 200
        s.post(f"{API}/auth/logout", timeout=10)
        # After logout, cookies should be cleared; /me should be 401
        r = s.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401


# ---------------------- Protected routes ----------------------
class TestProtected:
    def test_projects_requires_auth(self):
        assert requests.get(f"{API}/projects", timeout=10).status_code == 401

    def test_stats_requires_auth(self):
        assert requests.get(f"{API}/stats", timeout=10).status_code == 401

    def test_generate_requires_auth(self):
        assert requests.post(f"{API}/generate", json={"framework": "HTML/CSS"}, timeout=10).status_code == 401


# ---------------------- Generate + Projects ----------------------
class TestGenerate:
    def test_generate_no_image(self, admin_session):
        r = admin_session.post(f"{API}/generate", json={"framework": "HTML/CSS"}, timeout=20)
        assert r.status_code == 400

    def test_generate_html_creates_project(self, admin_session, sample_image_b64):
        payload = {
            "image_base64": sample_image_b64,
            "framework": "HTML/CSS",
            "styling": "Tailwind CSS",
            "prompt": "Keep it minimal",
            "name": "TEST HTML Project",
        }
        r = admin_session.post(f"{API}/generate", json=payload, timeout=120)
        assert r.status_code == 200, f"Generate failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert "id" in body
        assert body["framework"] == "HTML/CSS"
        assert body["language"] == "html"
        assert isinstance(body["code"], str) and len(body["code"]) > 50
        # ensure no _id leaked
        assert "_id" not in body
        # Persist project id for downstream tests
        pytest.html_project_id = body["id"]

    def test_projects_lists_generated(self, admin_session):
        r = admin_session.get(f"{API}/projects", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [p["id"] for p in items]
        assert getattr(pytest, "html_project_id", None) in ids

    def test_get_project_by_id(self, admin_session):
        pid = getattr(pytest, "html_project_id", None)
        assert pid
        r = admin_session.get(f"{API}/projects/{pid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_stats_increment(self, admin_session):
        r = admin_session.get(f"{API}/stats", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 1
        assert "HTML/CSS" in body["by_framework"]

    def test_delete_project(self, admin_session):
        pid = getattr(pytest, "html_project_id", None)
        assert pid
        r = admin_session.delete(f"{API}/projects/{pid}", timeout=15)
        assert r.status_code == 200
        # Verify removal
        r2 = admin_session.get(f"{API}/projects/{pid}", timeout=10)
        assert r2.status_code == 404
