from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import json
import uuid
import base64
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import jwt
import bcrypt
import requests
from io import BytesIO
from PIL import Image
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
    model: str = "Claude Sonnet 4.6"


class RefineInput(BaseModel):
    instruction: str
    model: Optional[str] = None


class RestoreInput(BaseModel):
    index: int


class ProfileUpdate(BaseModel):
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
async def update_profile(payload: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {}
    if payload.name:
        updates["name"] = payload.name
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return public_user(fresh)


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def fetch_image_bytes(url: str) -> bytes:
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    return r.content


def _decode_image(b64: str) -> Image.Image:
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[-1]
    raw = base64.b64decode(b64)
    img = Image.open(BytesIO(raw))
    # Use first frame for animated formats (gif/webp)
    try:
        img.seek(0)
    except Exception:
        pass
    if img.mode not in ("RGB",):
        img = img.convert("RGB")
    return img


def normalize_image(b64: str, max_side: int = 1568) -> str:
    """Re-encode to a clean PNG (resized) so the model reliably accepts it."""
    img = _decode_image(b64)
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def make_thumbnail(b64: str, max_side: int = 480) -> str:
    img = _decode_image(b64)
    img.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=72)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


MODEL_MAP = {
    "Claude Sonnet 4.6": ("anthropic", "claude-sonnet-4-6"),
    "Gemini 3.1 Pro": ("gemini", "gemini-3.1-pro-preview"),
    "GPT-4o": ("openai", "gpt-4o"),
}


LANG_MAP = {
    "React": "jsx",
    "Vue 3": "vue",
    "Next.js": "jsx",
    "HTML/CSS": "html",
}


def build_system_prompt(framework: str, styling: str, extra: str, dsl: Optional[dict] = None) -> str:
    base = (
        f"You are a senior frontend engineer specializing in pixel-perfect UI implementation. "
        f"Convert the UI design into clean, production-ready {framework} code "
        f"styled with {styling}. Requirements:\n"
        f"- Match layout, spacing, colors, and typography as closely as possible.\n"
        f"- Make it fully responsive and accessible (semantic HTML, aria where relevant).\n"
        f"- Use placeholder images from https://placehold.co for any image regions.\n"
    )
    if framework == "HTML/CSS":
        base += ("- Return a SINGLE complete, self-contained HTML document (with <!DOCTYPE html>, "
                 "<head> including any CSS, and <body>) so it can render directly in an iframe. "
                 "If using Tailwind CSS, include the Tailwind CDN script tag.\n")
    elif framework in ("React", "Next.js"):
        base += ("- Return a SINGLE self-contained React component file. Default-export a component named `App`. "
                 "Do not include import statements for CSS. If using Tailwind, assume Tailwind is available. "
                 "Inline any helper components in the same file.\n")
    elif framework == "Vue 3":
        base += "- Return a SINGLE Vue 3 Single File Component (<template>, <script setup>, <style>).\n"
    if dsl:
        base += ("\nUse this structured component specification (DSL) as the source of truth for layout, "
                 "text content, and styles:\n" + json.dumps(dsl)[:6000] + "\n")
    if extra:
        base += f"\nAdditional instructions from the user: {extra}\n"
    base += "\nOutput ONLY the code inside one fenced code block. No explanations before or after."
    return base


def strip_code_fences(text: str) -> str:
    t = text.strip()
    if "```" in t:
        parts = t.split("```")
        candidates = []
        for i in range(1, len(parts), 2):
            block = parts[i]
            lines = block.split("\n", 1)
            if lines and lines[0].strip().isalpha():
                block = lines[1] if len(lines) > 1 else ""
            candidates.append(block.strip())
        if candidates:
            return max(candidates, key=len)
    return t


def extract_json(text: str) -> dict:
    t = text.strip()
    if "```" in t:
        for part in t.split("```"):
            p = part.strip()
            if p.startswith("json"):
                p = p[4:].strip()
            if p.startswith("{"):
                t = p
                break
    start, end = t.find("{"), t.rfind("}")
    if start != -1 and end != -1:
        t = t[start:end + 1]
    try:
        return json.loads(t)
    except Exception:
        return {"raw": text[:4000]}


async def _run_chat(system_message: str, user_msg: UserMessage, provider: str, model: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ui2code-{uuid.uuid4()}",
        system_message=system_message,
    ).with_model(provider, model)
    collected = ""
    async for ev in chat.stream_message(user_msg):
        if isinstance(ev, TextDelta):
            collected += ev.content
        elif isinstance(ev, StreamDone):
            break
    return collected


DSL_SYSTEM = (
    "You are a UI vision analyst. Analyze the provided UI design image and produce a structured JSON "
    "component tree describing the layout. Extract: detected elements (navbar, hero, button, input, card, "
    "grid, image, text, footer, etc.), their text content (OCR), nesting/hierarchy, and inferred styles "
    "(colors as hex, font sizes, font weights, spacing, border radius, shadows, alignment). "
    "Return ONLY valid JSON of the form: "
    '{"meta":{"name":"...","theme":"light|dark","primaryColor":"#hex","fontFamily":"..."},'
    '"tree":[{"type":"...","text":"...","styles":{...},"children":[...]}]}. No prose.'
)


async def analyze_to_dsl(image_b64: str, provider: str, model: str) -> dict:
    msg = UserMessage(
        text="Analyze this UI design and return the JSON component tree.",
        file_contents=[ImageContent(image_base64=image_b64)],
    )
    raw = await _run_chat(DSL_SYSTEM, msg, provider, model)
    return extract_json(raw)


async def synthesize_code(dsl: dict, framework: str, styling: str, extra: str,
                          image_b64: str, provider: str, model: str) -> str:
    system = build_system_prompt(framework, styling, extra, dsl)
    msg = UserMessage(
        text=f"Generate the {framework} ({styling}) code for this design, matching the spec and image.",
        file_contents=[ImageContent(image_base64=image_b64)],
    )
    raw = await _run_chat(system, msg, provider, model)
    return strip_code_fences(raw)


async def refine_code(current_code: str, dsl: dict, instruction: str, framework: str,
                      styling: str, provider: str, model: str) -> str:
    system = (
        f"You are an expert {framework} engineer making a surgical edit to existing code. "
        f"Apply ONLY the requested change while preserving everything else. Keep the same framework "
        f"({framework}) and styling approach ({styling}). "
        f"Return ONLY the complete updated code inside one fenced code block, no explanations.\n\n"
        f"Component spec (DSL) for context:\n{json.dumps(dsl)[:4000]}"
    )
    msg = UserMessage(
        text=f"Current code:\n```\n{current_code}\n```\n\nRequested change: {instruction}",
    )
    raw = await _run_chat(system, msg, provider, model)
    return strip_code_fences(raw)


# ---------------------------------------------------------------------------
# Converter / Projects routes
# ---------------------------------------------------------------------------
@api_router.post("/generate")
async def generate(data: GenerateInput, user: dict = Depends(get_current_user)):
    raw_b64 = data.image_base64
    if not raw_b64 and data.image_url:
        try:
            raw_b64 = base64.b64encode(fetch_image_bytes(data.image_url)).decode("utf-8")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not fetch image URL: {e}")
    if not raw_b64:
        raise HTTPException(status_code=400, detail="No image provided")

    try:
        clean_b64 = normalize_image(raw_b64)
        thumb_b64 = make_thumbnail(raw_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid or unsupported image: {e}")

    provider, model = MODEL_MAP.get(data.model, MODEL_MAP["Claude Sonnet 4.6"])

    try:
        # Step 1: vision -> DSL component tree
        dsl = await analyze_to_dsl(clean_b64, provider, model)
        # Step 2: DSL + image -> framework code
        code = await synthesize_code(dsl, data.framework, data.styling,
                                     data.prompt or "", clean_b64, provider, model)
    except Exception as e:
        logger.exception("Generation failed")
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")

    language = LANG_MAP.get(data.framework, "jsx")
    now = datetime.now(timezone.utc).isoformat()
    version0 = {"code": code, "label": "Initial generation", "created_at": now}

    project = {
        "id": str(uuid.uuid4()),
        "user_id": str(user["_id"]),
        "name": data.name or f"Untitled • {data.framework}",
        "framework": data.framework,
        "styling": data.styling,
        "model": data.model,
        "prompt": data.prompt or "",
        "image_base64": clean_b64,
        "thumbnail": thumb_b64,
        "dsl": dsl,
        "code": code,
        "language": language,
        "versions": [version0],
        "current_index": 0,
        "created_at": now,
    }
    await db.projects.insert_one({**project})
    project.pop("_id", None)
    project.pop("image_base64", None)
    return project


@api_router.post("/projects/{project_id}/refine")
async def refine_project(project_id: str, data: RefineInput, user: dict = Depends(get_current_user)):
    doc = await db.projects.find_one({"id": project_id, "user_id": str(user["_id"])})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    model_name = data.model or doc.get("model", "Claude Sonnet 4.6")
    provider, model = MODEL_MAP.get(model_name, MODEL_MAP["Claude Sonnet 4.6"])
    try:
        new_code = await refine_code(
            doc["code"], doc.get("dsl", {}), data.instruction,
            doc["framework"], doc["styling"], provider, model,
        )
    except Exception as e:
        logger.exception("Refine failed")
        raise HTTPException(status_code=500, detail=f"Refine failed: {e}")

    now = datetime.now(timezone.utc).isoformat()
    versions = doc.get("versions", [{"code": doc["code"], "label": "Initial generation", "created_at": doc["created_at"]}])
    # truncate any redo-forward history, then append
    cur = doc.get("current_index", len(versions) - 1)
    versions = versions[: cur + 1]
    versions.append({"code": new_code, "label": data.instruction, "created_at": now})
    new_index = len(versions) - 1
    await db.projects.update_one(
        {"id": project_id, "user_id": str(user["_id"])},
        {"$set": {"code": new_code, "versions": versions, "current_index": new_index}},
    )
    return {"code": new_code, "versions": versions, "current_index": new_index}


@api_router.post("/projects/{project_id}/restore")
async def restore_version(project_id: str, data: RestoreInput, user: dict = Depends(get_current_user)):
    doc = await db.projects.find_one({"id": project_id, "user_id": str(user["_id"])})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    versions = doc.get("versions", [])
    if not (0 <= data.index < len(versions)):
        raise HTTPException(status_code=400, detail="Invalid version index")
    code = versions[data.index]["code"]
    await db.projects.update_one(
        {"id": project_id, "user_id": str(user["_id"])},
        {"$set": {"code": code, "current_index": data.index}},
    )
    return {"code": code, "current_index": data.index}


@api_router.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    # Exclude heavy fields (full image + code) for a fast list view.
    docs = await db.projects.find(
        {"user_id": str(user["_id"])},
        {"_id": 0, "image_base64": 0, "code": 0},
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
