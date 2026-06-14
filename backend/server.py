from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import base64
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import jwt
import bcrypt
import requests
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=False,
                        samesite="lax", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False,
                        samesite="lax", max_age=604800, path="/")


def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "role": user.get("role", "user"),
        "plan": user.get("plan", "Free"),
        "created_at": user.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class GenerateInput(BaseModel):
    image_base64: Optional[str] = None
    image_url: Optional[str] = None
    framework: str = "React"
    styling: str = "Tailwind CSS"
    prompt: Optional[str] = ""
    name: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "role": "user",
        "plan": "Free",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    doc["_id"] = res.inserted_id
    return public_user(doc)


@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.put("/auth/profile")
async def update_profile(payload: dict, user: dict = Depends(get_current_user)):
    updates = {}
    if "name" in payload and payload["name"]:
        updates["name"] = payload["name"]
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return public_user(fresh)


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def fetch_image_as_base64(url: str) -> str:
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    return base64.b64encode(r.content).decode("utf-8")


LANG_MAP = {
    "React": "jsx",
    "Vue 3": "vue",
    "Next.js": "jsx",
    "HTML/CSS": "html",
}


def build_system_prompt(framework: str, styling: str, extra: str) -> str:
    base = (
        f"You are a senior frontend engineer specializing in pixel-perfect UI implementation. "
        f"Convert the provided UI design image into clean, production-ready {framework} code "
        f"styled with {styling}. Requirements:\n"
        f"- Match layout, spacing, colors, and typography as closely as possible.\n"
        f"- Make it fully responsive and accessible (semantic HTML, aria where relevant).\n"
        f"- Use placeholder text/links only where the image is unclear.\n"
    )
    if framework == "HTML/CSS":
        base += ("- Return a SINGLE complete, self-contained HTML document (with <!DOCTYPE html>, "
                 "<head> including any CSS, and <body>) so it can render directly in an iframe. "
                 "If using Tailwind CSS, include the Tailwind CDN script tag.\n")
    else:
        base += "- Return a single complete component file.\n"
    if extra:
        base += f"\nAdditional instructions from the user: {extra}\n"
    base += "\nOutput ONLY the code inside one fenced code block. No explanations before or after."
    return base


def strip_code_fences(text: str) -> str:
    t = text.strip()
    if "```" in t:
        parts = t.split("```")
        # take the largest fenced block
        candidates = []
        for i in range(1, len(parts), 2):
            block = parts[i]
            # remove leading language token line
            lines = block.split("\n", 1)
            if lines and lines[0].strip().isalpha():
                block = lines[1] if len(lines) > 1 else ""
            candidates.append(block.strip())
        if candidates:
            return max(candidates, key=len)
    return t


async def generate_code(image_b64: str, framework: str, styling: str, extra: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ui2code-{uuid.uuid4()}",
        system_message=build_system_prompt(framework, styling, extra),
    ).with_model("anthropic", "claude-sonnet-4-6")

    msg = UserMessage(
        text=f"Generate the {framework} ({styling}) code for this design.",
        file_contents=[ImageContent(image_base64=image_b64)],
    )
    collected = ""
    async for ev in chat.stream_message(msg):
        if isinstance(ev, TextDelta):
            collected += ev.content
        elif isinstance(ev, StreamDone):
            break
    return collected


# ---------------------------------------------------------------------------
# Converter / Projects routes
# ---------------------------------------------------------------------------
@api_router.post("/generate")
async def generate(data: GenerateInput, user: dict = Depends(get_current_user)):
    image_b64 = data.image_base64
    if not image_b64 and data.image_url:
        try:
            image_b64 = fetch_image_as_base64(data.image_url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not fetch image URL: {e}")
    if not image_b64:
        raise HTTPException(status_code=400, detail="No image provided")

    # normalize: strip data URL prefix if present
    if image_b64.startswith("data:"):
        image_b64 = image_b64.split(",", 1)[-1]

    try:
        raw = await generate_code(image_b64, data.framework, data.styling, data.prompt or "")
    except Exception as e:
        logger.exception("Generation failed")
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")

    code = strip_code_fences(raw)
    language = LANG_MAP.get(data.framework, "jsx")

    project = {
        "id": str(uuid.uuid4()),
        "user_id": str(user["_id"]),
        "name": data.name or f"Untitled • {data.framework}",
        "framework": data.framework,
        "styling": data.styling,
        "prompt": data.prompt or "",
        "image_base64": image_b64,
        "code": code,
        "language": language,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.projects.insert_one({**project})
    project.pop("_id", None)
    return project


@api_router.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    docs = await db.projects.find(
        {"user_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    doc = await db.projects.find_one(
        {"id": project_id, "user_id": str(user["_id"])}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return doc


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    res = await db.projects.delete_one({"id": project_id, "user_id": str(user["_id"])})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    total = await db.projects.count_documents({"user_id": uid})
    by_framework = {}
    async for d in db.projects.find({"user_id": uid}, {"framework": 1, "_id": 0}):
        fw = d.get("framework", "Other")
        by_framework[fw] = by_framework.get(fw, 0) + 1
    return {"total": total, "by_framework": by_framework}


@api_router.get("/")
async def root():
    return {"message": "UI2Code API"}


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@ui2code.dev")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "plan": "Pro",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.projects.create_index("user_id")
    await seed_admin()


app.include_router(api_router)

_allowed_origins = [os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.preview\.emergentagent\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
