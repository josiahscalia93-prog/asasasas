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

    @staticmethod
    def _wait_for_job(session, job_id, timeout_s=240, poll_s=3):
        deadline = time.time() + timeout_s
        last = None
        while time.time() < deadline:
            r = session.get(f"{API}/generate/status/{job_id}", timeout=15)
            assert r.status_code == 200, f"status failed {r.status_code} {r.text[:200]}"
            last = r.json()
            if last.get("status") in ("done", "error"):
                return last
            time.sleep(poll_s)
        raise AssertionError(f"Job {job_id} timed out, last={last}")

    def test_generate_html_creates_project(self, admin_session, sample_image_b64):
        payload = {
            "image_base64": sample_image_b64,
            "framework": "HTML/CSS",
            "styling": "Tailwind CSS",
            "prompt": "Keep it minimal",
            "name": "TEST HTML Project",
            "model": "Claude Sonnet 4.6",
        }
        # Step 1: POST /generate should return quickly with a job id
        t0 = time.time()
        r = admin_session.post(f"{API}/generate", json=payload, timeout=20)
        elapsed = time.time() - t0
        assert r.status_code == 200, f"Generate enqueue failed: {r.status_code} {r.text[:300]}"
        enq = r.json()
        assert "job_id" in enq, f"missing job_id: {enq}"
        assert enq.get("status") == "processing"
        assert elapsed < 10, f"POST /generate should return fast, took {elapsed:.1f}s"

        # Step 2: poll status
        result = self._wait_for_job(admin_session, enq["job_id"])
        assert result["status"] == "done", f"Job failed: {result}"
        body = result["project"]
        assert "id" in body
        assert body["framework"] == "HTML/CSS"
        assert body["language"] == "html"
        assert isinstance(body["code"], str) and len(body["code"]) > 50
        assert "_id" not in body
        assert "dsl" in body and isinstance(body["dsl"], dict)
        assert ("tree" in body["dsl"]) or ("meta" in body["dsl"]) or ("raw" in body["dsl"])
        assert isinstance(body["versions"], list) and len(body["versions"]) == 1
        assert body["current_index"] == 0
        assert body["versions"][0]["code"] == body["code"]
        assert isinstance(body.get("thumbnail"), str) and len(body["thumbnail"]) > 100
        # image_base64 stripped from status response
        assert "image_base64" not in body
        pytest.html_project_id = body["id"]

    def test_generate_status_requires_auth(self, admin_session):
        # other users shouldn't see this job
        s2 = requests.Session()
        suffix = uuid.uuid4().hex[:6]
        s2.post(f"{API}/auth/register",
                json={"name": "Other", "email": f"test_other_{suffix}@example.com", "password": "TestPass123!"},
                timeout=15)
        # Unauthenticated request
        r = requests.get(f"{API}/generate/status/{uuid.uuid4()}", timeout=10)
        assert r.status_code == 401
        # 404 for non-existent job for an authenticated user
        r2 = s2.get(f"{API}/generate/status/{uuid.uuid4()}", timeout=10)
        assert r2.status_code == 404

    def test_generate_with_gpt4o(self, admin_session, sample_image_b64):
        """Verify GPT-4o model option works in /api/generate (async)."""
        payload = {
            "image_base64": sample_image_b64,
            "framework": "HTML/CSS",
            "styling": "Tailwind CSS",
            "name": "TEST GPT4o Project",
            "model": "GPT-4o",
        }
        r = admin_session.post(f"{API}/generate", json=payload, timeout=20)
        assert r.status_code == 200, f"GPT-4o enqueue failed: {r.status_code} {r.text[:300]}"
        job_id = r.json()["job_id"]
        result = self._wait_for_job(admin_session, job_id)
        assert result["status"] == "done", f"GPT-4o job failed: {result}"
        body = result["project"]
        assert isinstance(body["code"], str) and len(body["code"]) > 50
        assert body["model"] == "GPT-4o"
        pytest.gpt4o_project_id = body["id"]

    def test_refine_updates_code_and_versions(self, admin_session):
        pid = getattr(pytest, "html_project_id", None) or getattr(pytest, "gpt4o_project_id", None)
        assert pid, "No project was created (both Claude and GPT-4o failed)"
        # Capture before
        before = admin_session.get(f"{API}/projects/{pid}", timeout=15).json()
        before_code = before["code"]
        before_versions = len(before["versions"])
        before_index = before["current_index"]

        r = admin_session.post(
            f"{API}/projects/{pid}/refine",
            json={"instruction": "Change the main heading text to 'Hello World TEST'",
                  "model": "Claude Sonnet 4.6"},
            timeout=180,
        )
        assert r.status_code == 200, f"Refine failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert isinstance(body["code"], str) and len(body["code"]) > 50
        # versions length grew by 1, index incremented
        assert len(body["versions"]) == before_versions + 1
        assert body["current_index"] == before_index + 1
        # code actually changed
        assert body["code"] != before_code

        # GET to verify persistence
        fresh = admin_session.get(f"{API}/projects/{pid}", timeout=15).json()
        assert fresh["code"] == body["code"]
        assert fresh["current_index"] == body["current_index"]
        assert len(fresh["versions"]) == len(body["versions"])

    def test_restore_previous_version(self, admin_session):
        pid = getattr(pytest, "html_project_id", None) or getattr(pytest, "gpt4o_project_id", None)
        assert pid
        cur = admin_session.get(f"{API}/projects/{pid}", timeout=15).json()
        assert cur["current_index"] >= 1, "Need a prior refine for restore test"
        target_index = 0
        target_code = cur["versions"][target_index]["code"]
        r = admin_session.post(f"{API}/projects/{pid}/restore", json={"index": target_index}, timeout=15)
        assert r.status_code == 200, f"Restore failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body["current_index"] == target_index
        assert body["code"] == target_code
        # Verify persistence
        fresh = admin_session.get(f"{API}/projects/{pid}", timeout=15).json()
        assert fresh["current_index"] == target_index
        assert fresh["code"] == target_code

    def test_restore_invalid_index(self, admin_session):
        pid = getattr(pytest, "html_project_id", None) or getattr(pytest, "gpt4o_project_id", None)
        assert pid
        r = admin_session.post(f"{API}/projects/{pid}/restore", json={"index": 999}, timeout=10)
        assert r.status_code == 400

    def test_projects_list_excludes_heavy_fields(self, admin_session):
        r = admin_session.get(f"{API}/projects", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for p in items:
            assert "image_base64" not in p, "list endpoint should exclude image_base64"
            assert "code" not in p, "list endpoint should exclude full code"
        # At least one new project must have a thumbnail (newly created in this run)
        assert any("thumbnail" in p for p in items), "no projects have thumbnail field"

    def test_projects_lists_generated(self, admin_session):
        r = admin_session.get(f"{API}/projects", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [p["id"] for p in items]
        assert (getattr(pytest, "html_project_id", None) in ids) or (getattr(pytest, "gpt4o_project_id", None) in ids)

    def test_get_project_by_id(self, admin_session):
        pid = getattr(pytest, "html_project_id", None) or getattr(pytest, "gpt4o_project_id", None)
        assert pid
        r = admin_session.get(f"{API}/projects/{pid}", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == pid
        # Full doc returned, including dsl, versions, code
        assert "code" in body
        assert "dsl" in body
        assert "versions" in body

    def test_stats_increment(self, admin_session):
        r = admin_session.get(f"{API}/stats", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 1
        assert "HTML/CSS" in body["by_framework"]

    def test_delete_project(self, admin_session):
        pid = getattr(pytest, "html_project_id", None) or getattr(pytest, "gpt4o_project_id", None)
        assert pid
        r = admin_session.delete(f"{API}/projects/{pid}", timeout=15)
        assert r.status_code == 200
        # Verify removal
        r2 = admin_session.get(f"{API}/projects/{pid}", timeout=10)
        assert r2.status_code == 404
