from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import collections
import pathlib
import bcrypt
import jwt
import urllib.request
import urllib.error

# google-auth is only actually exercised once GOOGLE_CLIENT_ID is configured (see
# /api/auth/google below) -- imported defensively so local/dev environments that haven't run
# `pip install -r requirements.txt` yet don't crash on import.
try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_auth_requests
except ImportError:
    google_id_token = None
    google_auth_requests = None

# psycopg2 is only actually required in production once DATABASE_URL points at a real Postgres
# instance (see get_db() below). Importing it defensively means local sqlite-only dev still works
# even before `pip install -r requirements.txt` has picked up the new dependency.
try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None

app = FastAPI(title="mrreadyprep API", version="2026")

# CORS ayarları -- CORS_ALLOWED_ORIGINS can be a comma-separated list of extra origins (e.g. the
# production frontend domain once deployed). localhost:5173 is always allowed for local dev.
_extra_origins = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"] + _extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# AUTH CONFIG
# ============================================================
# In production (Render, etc.) set JWT_SECRET_KEY as a real environment variable -- this
# fallback is only for local development so the app still works out of the box.
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or "dev-only-insecure-secret-change-me"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30

# Set once Google Cloud OAuth credentials exist (see /api/auth/google).
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# Public base URL this backend is reachable at -- used to build absolute audio_url fields sent to
# the frontend. Defaults to localhost for local dev; in production (Render, etc.) set this to the
# backend service's real public URL, e.g. https://mrreadyprep-api.onrender.com
BACKEND_PUBLIC_URL = os.environ.get("BACKEND_PUBLIC_URL", "http://localhost:8000")

# Where the frontend is reachable -- used to build the "reset your password" link sent by email.
# Defaults to the local Vite dev server; in production set this to the deployed frontend's real
# domain, e.g. https://mrreadyprep.com
FRONTEND_PUBLIC_URL = os.environ.get("FRONTEND_PUBLIC_URL", "http://localhost:5173")

# From resend.com (free tier). Leave blank to run without real email delivery -- the reset link
# is then only written to the server logs, which is fine for local dev/testing but means real
# students won't receive an actual email until this is set.
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "mrreadyprep <onboarding@resend.dev>")

# ============================================================
# İYZİCO (abonelik / ödeme) CONFIG
# ============================================================
# From the iyzico Merchant Panel (Ayarlar > API Anahtarları -- sandbox keys are issued immediately
# on signup, before the real vergi levhası/merchant approval finishes, so integration can be built
# and tested with IYZICO_BASE_URL pointed at the sandbox host before going live). IYZICO_MERCHANT_ID
# is shown in the same Settings page and is only needed to verify webhook signatures.
# IYZICO_PRICING_PLAN_REFERENCE_CODE is created once (via the merchant panel's Subscription >
# Products screen, or the Create Product/Create Pricing Plan API) and then reused for every
# checkout -- see IYZICO_SUBSCRIPTION_SETUP.md for the one-time setup steps.
# All blank-safe: if unset, the subscription endpoints raise a clear 500 instead of silently
# misbehaving, so local dev without iyzico configured doesn't crash the whole app at import time.
IYZICO_API_KEY = os.environ.get("IYZICO_API_KEY", "")
IYZICO_SECRET_KEY = os.environ.get("IYZICO_SECRET_KEY", "")
IYZICO_MERCHANT_ID = os.environ.get("IYZICO_MERCHANT_ID", "")
IYZICO_PRICING_PLAN_REFERENCE_CODE = os.environ.get("IYZICO_PRICING_PLAN_REFERENCE_CODE", "")
# https://api.iyzipay.com in production, https://sandbox-api.iyzipay.com while testing with
# sandbox keys (set IYZICO_BASE_URL=https://sandbox-api.iyzipay.com in Render for the test phase).
IYZICO_BASE_URL = os.environ.get("IYZICO_BASE_URL", "https://api.iyzipay.com")

IYZICO_RANDOM_HEADER = "x-iyzi-rnd"
IYZICO_AUTH_SCHEME = "IYZWSv2"


def _iyzico_random_string() -> str:
    return f"{int(datetime.now(timezone.utc).timestamp())}{secrets.randbelow(10**8):08d}"


def _iyzico_auth_header(uri_path: str, body_str: str, random_string: str) -> str:
    """Reproduces iyzico's IYZWSv2 signing scheme exactly as implemented in their official SDKs:
    signature = HMAC-SHA256(secretKey, randomString + uriPath + rawJsonBody) as lowercase hex,
    then Authorization = 'IYZWSv2 ' + base64('apiKey:<key>&randomKey:<rnd>&signature:<sig>').
    `body_str` MUST be byte-for-byte the exact string sent as the request body (an empty body is
    the literal string '{}'), since the signature covers those exact bytes."""
    to_sign = f"{random_string}{uri_path}{body_str}"
    signature = hmac.new(IYZICO_SECRET_KEY.encode("utf-8"), to_sign.encode("utf-8"), hashlib.sha256).hexdigest()
    auth_params = f"apiKey:{IYZICO_API_KEY}&randomKey:{random_string}&signature:{signature}"
    return IYZICO_AUTH_SCHEME + " " + base64.b64encode(auth_params.encode("utf-8")).decode("utf-8")


def _iyzico_request(method: str, path: str, body: dict = None):
    """Low-level signed call to the iyzico REST API (used instead of a heavier SDK dependency --
    mirrors the urllib.request style already used elsewhere in this file for Resend). `path` is
    the URL path only (e.g. '/v2/subscription/checkoutform/initialize'), no query string -- query
    strings are never part of the IYZWSv2 signature. Raises HTTPException(502) on any transport
    failure, and returns the parsed JSON body (which may itself have status: 'failure' -- callers
    check that) on any HTTP response, so iyzico's own error payloads reach the caller intact."""
    body_str = json.dumps(body if body is not None else {}, separators=(",", ":"), ensure_ascii=False)
    random_string = _iyzico_random_string()
    auth_header = _iyzico_auth_header(path, body_str, random_string)
    req = urllib.request.Request(
        IYZICO_BASE_URL + path,
        data=body_str.encode("utf-8"),
        method=method,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json",
            IYZICO_RANDOM_HEADER: random_string,
            "x-iyzi-client-version": "mrreadyprep-backend-1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=502, detail=f"iyzico request failed: HTTP {e.code}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach iyzico: {e}")


def _require_iyzico():
    if not IYZICO_API_KEY or not IYZICO_SECRET_KEY:
        raise HTTPException(status_code=500, detail="iyzico is not configured yet (IYZICO_API_KEY/IYZICO_SECRET_KEY missing)")
    if not IYZICO_PRICING_PLAN_REFERENCE_CODE:
        raise HTTPException(status_code=500, detail="iyzico is not configured yet (IYZICO_PRICING_PLAN_REFERENCE_CODE missing)")


# Which subscription_status values count as "has active premium access". iyzico subscription
# statuses (GetSubscriptionDetail / our own DB mirror of them): ACTIVE, PENDING, UNPAID, UPGRADED,
# CANCELED, EXPIRED -- only ACTIVE counts as paid access; PENDING means the card hasn't been
# charged/verified yet (e.g. a trial not yet started or a checkout not yet completed).
ACTIVE_SUBSCRIPTION_STATUSES = {"ACTIVE"}

def has_active_subscription(user) -> bool:
    return (user["subscription_status"] or "") in ACTIVE_SUBSCRIPTION_STATUSES

# Item id (as it appears in each pool's "id" field) that stays free for every student regardless
# of subscription status -- lets a non-subscriber try exactly one full exercise per category (plus
# Fixed Test 1, see FREE_FIXED_TEST_ID below) before hitting the paywall.
FREE_ITEM_ID = 1
FREE_FIXED_TEST_ID = 1

# Read in Daily Life groups its list screen by passage type (see RIDL_TYPE_ORDER in App.jsx),
# short 2-question types first -- so the item actually shown to the student as "Practice 1" is
# the first "sign"-type item in the pool, NOT the item whose id is FREE_ITEM_ID (1). Mirrors the
# frontend's computeRIDLDisplayNums grouping so the unlocked free item always matches what's
# visibly labeled "Practice 1" on screen, regardless of which id happens to be first in the pool.
RIDL_TYPE_ORDER = ["sign", "schedule", "receipt", "email", "message", "article", "poster", "advertisement"]

def _ridl_free_id(data) -> int:
    by_type = {}
    for item in data:
        if isinstance(item, dict):
            by_type.setdefault(item.get("type"), item)
    for t in RIDL_TYPE_ORDER:
        if t in by_type:
            return by_type[t].get("id", FREE_ITEM_ID)
    return FREE_ITEM_ID

# Fields worth keeping on a locked list item so the browsing/list screen can still show a
# meaningful title/topic under the lock icon, without leaking the actual exercise content
# (blanks, questions, sentences, answer keys, audio, etc.). Only fields that actually exist on
# a given item are kept -- this list is a superset covering every pool's differently-named
# "title-ish" field.
_LOCK_PREVIEW_FIELDS = (
    "id", "topic", "title", "location", "speaker", "scenario", "level", "difficulty", "category", "type",
)

def _lock_item(item: dict) -> dict:
    preview = {k: item[k] for k in _LOCK_PREVIEW_FIELDS if k in item}
    preview["locked"] = True
    return preview

def gate_pool(data, user, free_ids=frozenset({FREE_ITEM_ID})):
    """Applied to the standalone PRACTICE pool endpoints (/api/reading/*, /api/listening/*,
    /api/writing/*, /api/speaking/*), where each raw pool item is a fully standalone, independently
    startable exercise. Subscribers (has_active_subscription) get the full list unchanged.
    Non-subscribers get every item whose id is in free_ids in full, and every other item replaced
    with a lightweight {id, title-ish fields, locked: True} stub -- enough for the list screen to
    render a locked row, but with zero actual exercise content leaked to the network tab.

    free_ids defaults to just FREE_ITEM_ID (the first item), but callers whose frontend groups N
    raw items into a single practice session (e.g. Build a Sentence, which batches
    BUILD_SENTENCE_SET_SIZE items into one "set") must pass the full id range of that first set --
    otherwise the free sample would be a broken mix of 1 real item + N-1 locked stubs.

    Do NOT use this on the /api/mock/* pools -- those feed the dynamic "Full Mock Test" /
    "practice one section" flow, which draws a variable, unpredictable number of items from each
    pool per attempt. Partially stubbing those pools would silently corrupt an in-progress mock
    attempt instead of cleanly blocking it; see require_premium_pool below for how those are
    gated instead."""
    if user is not None and has_active_subscription(user):
        return data
    if not isinstance(data, list):
        return data
    out = []
    for item in data:
        if isinstance(item, dict) and item.get("id") in free_ids:
            out.append(item)
        elif isinstance(item, dict):
            out.append(_lock_item(item))
        else:
            out.append(item)
    return out

def require_premium_pool(user):
    """Applied to the /api/mock/* pool endpoints (NOT the 20 pre-built Fixed Tests, which are
    separate self-contained JSON files gated by FREE_FIXED_TEST_ID instead). These pools feed the
    dynamic "Full Mock Test" / "practice one section only" flow, which draws a variable number of
    items from each pool to assemble one attempt -- there's no single "free item" that can be
    carved out without silently corrupting that assembly (e.g. Writing needs a full 10-item Build
    a Sentence set every time). So for a non-subscriber this pool is entirely premium: Fixed Test 1
    remains the one complete free mock-test experience instead."""
    if user is None or not has_active_subscription(user):
        raise HTTPException(
            status_code=402,
            detail="The Full Mock Test (random practice) requires an active mrreadyprep subscription. Try Fixed Mock Test 1 for free, or subscribe for unlimited access.",
        )

# The audio/ folder is deployed separately from git (see AUDIO_DEPLOYMENT.md -- it's ~364MB of
# generated mp3s, too large for a normal git push). Create it if missing so a fresh deploy that
# hasn't had its persistent disk populated yet still boots instead of crashing at startup; audio
# playback simply 404s until the files are uploaded.
os.makedirs("audio", exist_ok=True)
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

# Base URL prefix for audio files (used to build every audio_url/audio_url_intro field sent to the
# frontend). Defaults to this backend's own /audio static mount (fine for local dev, and for
# production IF a persistent disk has actually been populated with the audio/ folder). Once audio
# is uploaded to an object storage bucket (Cloudflare R2, S3, etc. -- see AUDIO_DEPLOYMENT.md), set
# this env var to that bucket's public base URL instead, e.g.:
#   AUDIO_BASE_URL=https://pub-xxxxxxxx.r2.dev
AUDIO_BASE_URL = os.environ.get("AUDIO_BASE_URL", f"{BACKEND_PUBLIC_URL}/audio")

# Several Listening JSON pools (listening_part1-4.json, mock_listening_*.json, and the "listening"
# section embedded in every fixed_test_N.json) were authored with audio_url values hardcoded to
# "http://localhost:8000/audio/..." instead of being built dynamically like the Speaking pools are.
# That means in production these URLs point at the developer's own machine and never resolve --
# the audio silently fails to play. Rather than rewrite every JSON file by hand, this walks any
# JSON-shaped value (dict/list/str) returned by an endpoint and rewrites the old localhost prefix
# to today's real AUDIO_BASE_URL (R2 in production, the local /audio mount in dev), recursively, so
# it's safe to apply to an entire response object regardless of nesting depth.
_LEGACY_AUDIO_PREFIXES = ("http://localhost:8000/audio/", "http://127.0.0.1:8000/audio/")

def _fix_audio_urls(obj):
    if isinstance(obj, str):
        for prefix in _LEGACY_AUDIO_PREFIXES:
            if obj.startswith(prefix):
                return f"{AUDIO_BASE_URL}/{obj[len(prefix):]}"
        return obj
    if isinstance(obj, list):
        return [_fix_audio_urls(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _fix_audio_urls(v) for k, v in obj.items()}
    return obj

# ============================================================
# VERİ MODELLERİ
# ============================================================

class DashboardData(BaseModel):
    username: str
    target_score: float
    # Per-section goals the student sets for themselves on the Dashboard (Reading/Listening use
    # the 1.0-6.0 scale, Writing/Speaking use 1.0-5.0 -- see SECTION_BAND_MAX). Optional so older
    # frontend builds that don't send them yet don't break profile saves.
    reading_target: Optional[float] = None
    listening_target: Optional[float] = None
    writing_target: Optional[float] = None
    speaking_target: Optional[float] = None

# ============================================================
# AUTH VERİ MODELLERİ
# ============================================================

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    id_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ExamDateUpdate(BaseModel):
    exam_date: str  # ISO yyyy-mm-dd, or "" to clear the saved date

class RIDLResult(BaseModel):
    passage_id: int
    score: int
    total: int

class EmailSubmission(BaseModel):
    question_id: str
    response: str
    word_count: int
    time_spent: int

# Generic "a student finished some exercise, here's the score" record. Used across every
# exercise type (practice pools AND mock tests) so the student's overall progress can be
# reconstructed from a single table instead of needing per-category storage everywhere.
class AttemptResult(BaseModel):
    category: str       # e.g. 'ctw', 'ridl', 'ap', 'listening_p1'..'p4', 'bas', 'email', 'disc',
                         # 'speaking_lr', 'speaking_interview', 'mock_reading', 'mock_listening',
                         # 'mock_writing', 'mock_speaking', 'mock_overall'
    item_id: str         # exercise/passage/test id (as string) the attempt belongs to
    label: str = ""      # human-readable label shown in the progress UI, e.g. "Mock Test 3 · Reading"
    score: float
    total: float

# ============================================================
# VERİTABANI BAĞLANTISI
# ============================================================

DB_FILE = pathlib.Path(__file__).parent / "results.db"

# If DATABASE_URL is set (a real Postgres instance, e.g. Render's managed Postgres), use that so
# student accounts/progress survive redeploys -- Render's free web services have an EPHEMERAL
# filesystem, meaning a sqlite file living next to the code gets wiped every time we ship a new
# commit. Falls back to local sqlite (results.db) when DATABASE_URL is unset, which is fine for
# local development where losing the file on a restart doesn't matter.
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Prints once per process start (every deploy/restart) so Render's logs make it obvious which
# storage backend is actually active -- if this ever says "sqlite" in production, something is
# wrong with the DATABASE_URL env var (unset, cleared, or not picked up by this deploy).
if DATABASE_URL:
    _host_part = DATABASE_URL.split("@")[-1].split("/")[0] if "@" in DATABASE_URL else "?"
    print(f"[db] Startup: using Postgres (DATABASE_URL set, host={_host_part!r})", flush=True)
else:
    print("[db] Startup: using local sqlite (DATABASE_URL not set) -- data will NOT survive a redeploy", flush=True)


def _pg_translate(query: str) -> str:
    """Our SQL strings are written with sqlite-style '?' placeholders throughout the codebase --
    none of them contain literal '?' characters inside string content, so a plain replace is safe
    and lets every existing call site work unchanged against psycopg2, which expects '%s'."""
    return query.replace("?", "%s")


class _PGCursor:
    """Wraps a raw psycopg2 cursor so cursor.execute(query, params) also gets the '?' -> '%s'
    placeholder translation -- used by the handful of call sites that do conn.cursor() then
    cursor.execute(...)/cursor.fetchone() across multiple lines instead of chaining off
    conn.execute() directly."""
    def __init__(self, cur):
        self._cur = cur

    def execute(self, query, params=()):
        self._cur.execute(_pg_translate(query), tuple(params))
        return self

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()


class _PGConnection:
    """Thin wrapper so the rest of this file can keep calling conn.execute(...).fetchone()/
    fetchall() and conn.cursor() exactly like it does for sqlite3.Connection, without every one
    of the ~40 call sites needing to know which database engine is actually in use."""
    def __init__(self, conn):
        self._conn = conn

    def execute(self, query, params=()):
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(_pg_translate(query), tuple(params))
        return cur

    def cursor(self):
        return _PGCursor(self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_db():
    if DATABASE_URL:
        if psycopg2 is None:
            raise RuntimeError(
                "DATABASE_URL is set but psycopg2 isn't installed -- run "
                "'pip install -r requirements.txt' to pick up the new dependency."
            )
        return _PGConnection(psycopg2.connect(DATABASE_URL))
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn

def _has_column(conn, table, column):
    if DATABASE_URL:
        row = conn.execute(
            "SELECT 1 FROM information_schema.columns WHERE table_name = ? AND column_name = ?",
            (table, column),
        ).fetchone()
        return row is not None
    cols = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    return column in cols

def init_db():
    conn = get_db()

    # Postgres has no AUTOINCREMENT keyword (SERIAL does the equivalent job) -- everything else in
    # these schemas (TEXT/REAL/INTEGER/TIMESTAMP, composite PRIMARY KEY, DEFAULT CURRENT_TIMESTAMP)
    # is valid in both engines, so only the primary-key id columns need a different definition.
    pk = "SERIAL PRIMARY KEY" if DATABASE_URL else "INTEGER PRIMARY KEY AUTOINCREMENT"

    # Öğrenci hesapları -- her öğrencinin kendi email/kullanıcı adı ile açtığı hesap. Profil
    # alanları (exam_date, target_score, section skorları, vocab_level) artık ayrı bir kv-store
    # yerine doğrudan bu tabloda tutuluyor, her satır bir öğrencinin tüm profilini kapsıyor.
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS users (
            id {pk},
            email TEXT NOT NULL UNIQUE,
            username TEXT NOT NULL,
            password_hash TEXT,
            google_id TEXT UNIQUE,
            email_verified INTEGER NOT NULL DEFAULT 0,
            verification_token TEXT,
            verification_token_expires TIMESTAMP,
            password_reset_token TEXT,
            password_reset_token_expires TIMESTAMP,
            target_score REAL NOT NULL DEFAULT 5.5,
            reading_target REAL NOT NULL DEFAULT 5.5,
            listening_target REAL NOT NULL DEFAULT 5.0,
            writing_target REAL NOT NULL DEFAULT 4.5,
            speaking_target REAL NOT NULL DEFAULT 4.5,
            exam_date TEXT NOT NULL DEFAULT '',
            current_streak INTEGER NOT NULL DEFAULT 0,
            reading_score REAL NOT NULL DEFAULT 5.0,
            listening_score REAL NOT NULL DEFAULT 4.5,
            writing_score REAL NOT NULL DEFAULT 4.5,
            speaking_score REAL NOT NULL DEFAULT 4.0,
            vocab_level INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Guards for columns added after the users table already existed in production (e.g. the
    # password reset flow) -- CREATE TABLE IF NOT EXISTS above is a no-op once the table exists,
    # so older deployed databases need these added explicitly instead of silently missing them.
    if not _has_column(conn, "users", "password_reset_token"):
        conn.execute("ALTER TABLE users ADD COLUMN password_reset_token TEXT")
    if not _has_column(conn, "users", "password_reset_token_expires"):
        conn.execute("ALTER TABLE users ADD COLUMN password_reset_token_expires TIMESTAMP")
    if not _has_column(conn, "users", "reading_target"):
        conn.execute("ALTER TABLE users ADD COLUMN reading_target REAL NOT NULL DEFAULT 5.5")
    if not _has_column(conn, "users", "listening_target"):
        conn.execute("ALTER TABLE users ADD COLUMN listening_target REAL NOT NULL DEFAULT 5.0")
    if not _has_column(conn, "users", "writing_target"):
        conn.execute("ALTER TABLE users ADD COLUMN writing_target REAL NOT NULL DEFAULT 4.5")
    if not _has_column(conn, "users", "speaking_target"):
        conn.execute("ALTER TABLE users ADD COLUMN speaking_target REAL NOT NULL DEFAULT 4.5")
    # iyzico abonelik alanları -- subscription_status 'ACTIVE' olan kullanıcılar premium içeriğe
    # tam erişime sahip olur (bkz. has_active_subscription()). Diğer her şey (None, 'CANCELED',
    # 'EXPIRED', 'UNPAID', 'PENDING' vb.) erişimsiz sayılır.
    if not _has_column(conn, "users", "iyzico_customer_reference_code"):
        conn.execute("ALTER TABLE users ADD COLUMN iyzico_customer_reference_code TEXT")
    if not _has_column(conn, "users", "iyzico_subscription_reference_code"):
        conn.execute("ALTER TABLE users ADD COLUMN iyzico_subscription_reference_code TEXT")
    if not _has_column(conn, "users", "subscription_status"):
        conn.execute("ALTER TABLE users ADD COLUMN subscription_status TEXT")
    if not _has_column(conn, "users", "subscription_current_period_end"):
        conn.execute("ALTER TABLE users ADD COLUMN subscription_current_period_end TIMESTAMP")

    # Which vocab words each student has personally marked as learned.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS vocab_learned (
            user_id INTEGER NOT NULL,
            word_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, word_id)
        )
    """)

    # RIDL sonuçları tablosu
    conn.execute("""
        CREATE TABLE IF NOT EXISTS ridl_results (
            user_id INTEGER NOT NULL DEFAULT 0,
            passage_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            total INTEGER NOT NULL,
            pct INTEGER NOT NULL,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, passage_id)
        )
    """)
    if not _has_column(conn, "ridl_results", "user_id"):
        conn.execute("ALTER TABLE ridl_results ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0")

    # Email soruları tablosu
    conn.execute("""
        CREATE TABLE IF NOT EXISTS email_questions (
            id TEXT PRIMARY KEY,
            scenario TEXT NOT NULL,
            recipient TEXT,
            subject TEXT,
            task_intro TEXT,
            tasks TEXT,
            example_response TEXT,
            time_limit INTEGER,
            min_words INTEGER
        )
    """)

    # Email sonuçları tablosu
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS email_results (
            id {pk},
            question_id TEXT NOT NULL,
            response TEXT NOT NULL,
            word_count INTEGER NOT NULL,
            time_spent INTEGER NOT NULL,
            score REAL NOT NULL,
            feedback TEXT NOT NULL,
            submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Unified progress-tracking table -- every exercise type (practice pools + mock tests)
    # writes here so a student's full history/progress can be queried from one place.
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS attempt_results (
            id {pk},
            user_id INTEGER NOT NULL DEFAULT 0,
            category TEXT NOT NULL,
            item_id TEXT NOT NULL,
            label TEXT DEFAULT '',
            score REAL NOT NULL,
            total REAL NOT NULL,
            pct INTEGER NOT NULL,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    if not _has_column(conn, "attempt_results", "user_id"):
        conn.execute("ALTER TABLE attempt_results ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attempt_results_category ON attempt_results(category)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attempt_results_user ON attempt_results(user_id)")

    # Tracks which items from each random-draw mock pool (ctw/ridl/ap/car/conv/announce/at/bas/
    # email/disc/lr/interview) a given student has already been shown by a dynamic (non-fixed)
    # Full Mock Test or a "practice one section" random drill -- see /api/mock/seen-ids and
    # /api/mock/mark-seen below. Once every item in a pool has been seen, the pool "wraps around"
    # (old seen rows for it are cleared) instead of the student getting stuck with an
    # ever-shrinking draw. Not used by the 20 fixed mock tests, which always show identical
    # content on purpose.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS seen_pool_items (
            user_id INTEGER NOT NULL,
            pool TEXT NOT NULL,
            item_id TEXT NOT NULL,
            seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, pool, item_id)
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_seen_pool_items_user_pool ON seen_pool_items(user_id, pool)")

    # Legacy key/value store, kept only so old data (from before per-user accounts existed) can
    # still be read once during the very first registration to carry it over to that new account.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS profile_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    conn.commit()
    conn.close()

init_db()

def load_legacy_profile_settings():
    """Reads the old pre-accounts profile_settings kv-store, if any values were ever saved there.
    Used once, only when the very first user account is created, to carry the developer's own
    pre-login testing data (exam date, target score, username) forward instead of losing it."""
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM profile_settings").fetchall()
    conn.close()
    return {row["key"]: row["value"] for row in rows}

def migrate_legacy_data_to_user(user_id: int):
    """One-time bootstrap: the very first account ever created on this server inherits any
    attempt_results/ridl_results rows that were recorded before per-user accounts existed
    (user_id = 0), so pre-launch testing progress isn't silently orphaned."""
    conn = get_db()
    conn.execute("UPDATE attempt_results SET user_id = ? WHERE user_id = 0", (user_id,))
    conn.execute("UPDATE ridl_results SET user_id = ? WHERE user_id = 0", (user_id,))
    conn.commit()
    conn.close()

# ============================================================
# AUTH: password hashing, JWT issuing/verification, current-user dependency
# ============================================================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))

def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def _parse_db_datetime(value):
    """Reads a timestamp back out of either sqlite (always returned as the ISO string we wrote)
    or Postgres (returned as a native, timezone-naive datetime.datetime, since our schema uses
    plain TIMESTAMP columns rather than TIMESTAMPTZ) into a timezone-aware UTC datetime so it can
    be compared against datetime.now(timezone.utc). Every timestamp this app writes is UTC to
    begin with, so a naive value read back can safely be assumed to already be UTC."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(value)

def get_user_by_id(conn, user_id: int):
    return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

def get_current_user(authorization: Optional[str] = Header(None)):
    """FastAPI dependency: reads 'Authorization: Bearer <token>', validates the JWT, and returns
    the logged-in user's row from the users table. Raises 401 if missing/invalid/expired."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    user_id = int(payload["sub"])
    conn = get_db()
    user = get_user_by_id(conn, user_id)
    conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="Account no longer exists")
    return user

def get_current_user_optional(authorization: Optional[str] = Header(None)):
    """Like get_current_user, but returns None instead of raising when there's no/invalid token --
    used on content endpoints that must stay reachable by logged-out visitors (so the free sample
    item is still visible pre-signup) while still being able to check has_active_subscription()
    for whoever IS logged in."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None

def send_password_reset_email(to_email: str, reset_link: str):
    """Sends the 'reset your password' email via Resend (resend.com), if RESEND_API_KEY is
    configured. If it isn't set yet, or the send fails for any reason, this just logs the link to
    the server console instead of raising -- forgot-password should never itself error out just
    because email delivery isn't wired up or hiccups, since the reset token has already been saved
    either way and the generic response to the student must stay the same regardless."""
    if not RESEND_API_KEY:
        print(f"[password reset] RESEND_API_KEY not set -- reset link for {to_email}: {reset_link}", flush=True)
        return
    print(f"[password reset] RESEND_API_KEY is set ({len(RESEND_API_KEY)} chars) -- attempting to send to {to_email}", flush=True)
    payload = json.dumps({
        "from": RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": "Reset your mrreadyprep password",
        "html": (
            f"<p>We received a request to reset your mrreadyprep password.</p>"
            f"<p><a href=\"{reset_link}\">Click here to choose a new password</a></p>"
            f"<p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>"
        ),
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
            # Cloudflare (which fronts api.resend.com) blocks requests with no/suspicious
            # User-Agent as bot traffic (HTTP 403, Cloudflare error code 1010) -- Python's
            # urllib default "Python-urllib/3.x" User-Agent triggers exactly that. A normal
            # browser-style User-Agent gets past it.
            "User-Agent": "Mozilla/5.0 (compatible; mrreadyprep-backend/1.0)",
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        print(f"[password reset] Resend accepted the email for {to_email} (status {resp.status})", flush=True)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[password reset] Resend rejected the email for {to_email}: HTTP {e.code} -- {body}", flush=True)
    except urllib.error.URLError as e:
        print(f"[password reset] Failed to send email to {to_email}: {e}", flush=True)

def compute_streak_and_week_activity(conn, user_id: int):
    """Looks at every attempt_results/ridl_results row's saved_at date for this user to compute
    (a) week_activity: which of the current week's days (Monday-first) have at least one completed
    exercise, used to render the Dashboard's weekly dot row, and (b) current_streak: the number of
    consecutive days with activity counting backwards from today (today itself doesn't break an
    otherwise-unbroken streak if nothing has been done yet today)."""
    rows = conn.execute(
        "SELECT DISTINCT date(saved_at) AS d FROM attempt_results WHERE user_id = ? "
        "UNION SELECT DISTINCT date(saved_at) AS d FROM ridl_results WHERE user_id = ?",
        (user_id, user_id)
    ).fetchall()
    # sqlite's date() returns a plain 'YYYY-MM-DD' string; Postgres's date() returns a native
    # datetime.date object instead, which psycopg2 hands back as-is -- normalize both to strings
    # so the isoformat() comparisons below work the same regardless of which engine answered.
    active_dates = {str(row["d"]) for row in rows if row["d"]}

    today = datetime.now().date()
    monday = today - timedelta(days=today.weekday())
    week_activity = [
        (monday + timedelta(days=i)).isoformat() in active_dates
        if (monday + timedelta(days=i)) <= today else False
        for i in range(7)
    ]

    streak = 0
    cursor_day = today
    if cursor_day.isoformat() not in active_dates:
        cursor_day -= timedelta(days=1)
    while cursor_day.isoformat() in active_dates:
        streak += 1
        cursor_day -= timedelta(days=1)

    return streak, week_activity

def user_profile_dict(user) -> dict:
    """Shapes a users-table row into the same profile dict shape the frontend has always
    consumed (dashboard, profile screen, etc.)."""
    return {
        "username": user["username"],
        "email": user["email"],
        "target_score": user["target_score"],
        "reading_target": user["reading_target"],
        "listening_target": user["listening_target"],
        "writing_target": user["writing_target"],
        "speaking_target": user["speaking_target"],
        "current_streak": user["current_streak"],
        "vocab_level": user["vocab_level"],
        "reading_score": user["reading_score"],
        "listening_score": user["listening_score"],
        "writing_score": user["writing_score"],
        "speaking_score": user["speaking_score"],
        "exam_date": user["exam_date"],
        "email_verified": bool(user["email_verified"]),
        "subscription_status": user["subscription_status"],
        "has_premium": has_active_subscription(user),
        "subscription_current_period_end": (
            user["subscription_current_period_end"].isoformat()
            if isinstance(user["subscription_current_period_end"], datetime)
            else user["subscription_current_period_end"]
        ),
    }

# ============================================================
# ÖRNEK VERİLER
# ============================================================

# Vocabulary verisi
VOCAB_FILE = os.path.join(os.path.dirname(__file__), "toefl_vocab_list.json")
with open(VOCAB_FILE, "r", encoding="utf-8") as f:
    vocab_words = json.load(f)

# Complete the Words verisi
# NOTE: these are file-path constants only — every endpoint below opens and json.load()s the
# file fresh on each request (instead of caching the parsed content at import time), so editing
# any of these JSON files takes effect immediately without needing to restart the backend.
CTW_FILE = pathlib.Path(__file__).parent / "complete_the_words_1.json"

# Read in Daily Life verisi
RIDL_FILE = pathlib.Path(__file__).parent / "read_in_daily_life_1.json"

# Full Mock Test icin ayri, practice havuzlariyla hic cakismayan Reading icerigi
MOCK_CTW_FILE = pathlib.Path(__file__).parent / "mock_complete_the_words.json"
MOCK_RIDL_FILE = pathlib.Path(__file__).parent / "mock_read_in_daily_life.json"
MOCK_AP_FILE = pathlib.Path(__file__).parent / "mock_academic_passage.json"

# Full Mock Test icin ayri, practice havuzlariyla hic cakismayan Listening/Writing/Speaking icerigi
MOCK_LISTENING_CAR_FILE = pathlib.Path(__file__).parent / "mock_listening_choose_response.json"
MOCK_LISTENING_CONV_FILE = pathlib.Path(__file__).parent / "mock_listening_conversation.json"
MOCK_LISTENING_ANNOUNCE_FILE = pathlib.Path(__file__).parent / "mock_listening_announcement.json"
MOCK_LISTENING_AT_FILE = pathlib.Path(__file__).parent / "mock_listening_academic_talk.json"
MOCK_BAS_FILE = pathlib.Path(__file__).parent / "mock_build_a_sentence.json"
MOCK_EMAIL_FILE = pathlib.Path(__file__).parent / "mock_write_email.json"
MOCK_DISC_FILE = pathlib.Path(__file__).parent / "mock_write_academic_discussion.json"
MOCK_SPEAKING_LR_FILE = pathlib.Path(__file__).parent / "mock_speaking_listen_repeat.json"
MOCK_SPEAKING_INTERVIEW_FILE = pathlib.Path(__file__).parent / "mock_speaking_interview.json"

# Fixed (non-randomized) full mock tests — each file is one complete, self-contained test
# bundle (Reading module1/module2Easy/module2Hard, Listening module1/module2Easy/module2Hard,
# one fixed Writing set, one fixed Speaking set). Unlike the pool endpoints above, which
# FullMockTest samples from randomly on every attempt, a fixed test always shows the exact same
# content — the adaptive branch (which module2 the student sees) is still decided live from
# their module1 performance, but which items make up each branch is pre-authored, not sampled.
FIXED_TEST_FILES = {
    1: pathlib.Path(__file__).parent / "fixed_test_1.json",
    2: pathlib.Path(__file__).parent / "fixed_test_2.json",
    3: pathlib.Path(__file__).parent / "fixed_test_3.json",
    4: pathlib.Path(__file__).parent / "fixed_test_4.json",
    5: pathlib.Path(__file__).parent / "fixed_test_5.json",
    6: pathlib.Path(__file__).parent / "fixed_test_6.json",
    7: pathlib.Path(__file__).parent / "fixed_test_7.json",
    8: pathlib.Path(__file__).parent / "fixed_test_8.json",
    9: pathlib.Path(__file__).parent / "fixed_test_9.json",
    10: pathlib.Path(__file__).parent / "fixed_test_10.json",
    11: pathlib.Path(__file__).parent / "fixed_test_11.json",
    12: pathlib.Path(__file__).parent / "fixed_test_12.json",
    13: pathlib.Path(__file__).parent / "fixed_test_13.json",
    14: pathlib.Path(__file__).parent / "fixed_test_14.json",
    15: pathlib.Path(__file__).parent / "fixed_test_15.json",
    16: pathlib.Path(__file__).parent / "fixed_test_16.json",
    17: pathlib.Path(__file__).parent / "fixed_test_17.json",
    18: pathlib.Path(__file__).parent / "fixed_test_18.json",
    19: pathlib.Path(__file__).parent / "fixed_test_19.json",
    20: pathlib.Path(__file__).parent / "fixed_test_20.json",
}

# Listening Part 1 verisi
LISTENING_P1_FILE = pathlib.Path(__file__).parent / "listening_part1.json"

# Listening Part 2 verisi
LISTENING_P2_FILE = pathlib.Path(__file__).parent / "listening_part2.json"

# Listening Part 3 verisi
LISTENING_P3_FILE = pathlib.Path(__file__).parent / "listening_part3.json"

# Listening Part 4 verisi
LISTENING_P4_FILE = pathlib.Path(__file__).parent / "listening_part4.json"

# Writing Part 1: Build a Sentence verisi
BUILD_A_SENTENCE_FILE = pathlib.Path(__file__).parent / "build_a_sentence_1.json"

# Writing Part 2: Write an Email verisi (JSON tabanlı, DB'ye alternatif)
WRITE_EMAIL_FILE = pathlib.Path(__file__).parent / "write_email_1.json"

# Writing Part 3: Write for an Academic Discussion verisi
WRITE_DISCUSSION_FILE = pathlib.Path(__file__).parent / "write_academic_discussion_1.json"

# Speaking Part 1: Listen and Repeat verisi
SPEAKING_LR_FILE = pathlib.Path(__file__).parent / "speaking_listen_repeat_1.json"

# Speaking Part 2: Take an Interview verisi
SPEAKING_INTERVIEW_FILE = pathlib.Path(__file__).parent / "speaking_interview_1.json"

# Email örnek sorusu ekle (eğer yoksa)
def seed_email_questions():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS cnt FROM email_questions")
    count = cursor.fetchone()["cnt"]

    if count == 0:
        cursor.execute("""
            INSERT INTO email_questions (id, scenario, recipient, subject, task_intro, tasks, example_response, time_limit, min_words)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "email_001",
            "You are a student at a university. You received an email from the university library about overdue books.",
            "University Librarian",
            "Overdue Books - Action Required",
            "Write an email to the university librarian explaining your situation.",
            json.dumps([
                {"description": "Apologize for the late return", "keywords": ["sorry", "apologize", "late"]},
                {"description": "Explain why the books are late", "keywords": ["exam", "sick", "busy", "forgot"]},
                {"description": "Promise to return them soon", "keywords": ["return", "tomorrow", "soon", "next week"]}
            ]),
            "Dear Librarian,\n\nI am writing to apologize for the overdue books. I have been very busy with my final exams and completely forgot to return them. I am sorry for any inconvenience this may have caused.\n\nI will return the books tomorrow morning. Thank you for your understanding.\n\nSincerely,\n[Your Name]",
            10,
            80
        ))
        conn.commit()
    conn.close()

seed_email_questions()

# ============================================================
# API ENDPOINT'LERİ
# ============================================================

# --- Auth ---
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

@app.post("/api/auth/register")
def register(data: RegisterRequest, request: Request):
    _check_and_consume_rate_limit(_register_attempts, _client_ip(request), REGISTER_ATTEMPT_WINDOW_SECONDS, REGISTER_ATTEMPT_MAX, "registration")
    email = data.email.strip().lower()
    username = data.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    is_first_user = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0

    verification_token = secrets.token_urlsafe(32)
    verification_expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    # Legacy pre-account testing data (if this is literally the first account ever created on
    # this server) gets carried over as this user's starting profile values instead of defaults.
    legacy = load_legacy_profile_settings() if is_first_user else {}
    exam_date = legacy.get("exam_date", "")
    target_score = float(legacy.get("target_score", 5.5))

    insert_sql = """
        INSERT INTO users (email, username, password_hash, email_verified, verification_token,
                            verification_token_expires, exam_date, target_score)
        VALUES (?, ?, ?, 0, ?, ?, ?, ?)
    """
    params = (email, username, hash_password(data.password), verification_token,
              verification_expires, exam_date, target_score)
    if DATABASE_URL:
        # Postgres has no cursor.lastrowid -- RETURNING id gets the new row's id instead.
        cursor = conn.execute(insert_sql.rstrip() + " RETURNING id", params)
        user_id = cursor.fetchone()["id"]
    else:
        cursor = conn.execute(insert_sql, params)
        user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    if is_first_user:
        migrate_legacy_data_to_user(user_id)

    # TODO(email verification): once an email-sending service is configured, send
    # verification_token to the user's email here instead of just issuing it silently.

    token = create_access_token(user_id)
    conn = get_db()
    user = get_user_by_id(conn, user_id)
    conn.close()
    return {"status": "success", "access_token": token, "user": user_profile_dict(user)}

## --- Login brute-force protection ---
# In-memory only (fine for a single Render instance; would need a shared store like Redis if this
# ever runs multiple worker processes/instances) -- tracks failed-attempt timestamps per key
# (IP + email combined, so one bad actor can't lock out a real student by spamming their email
# from elsewhere, and a shared IP like a school computer lab can't lock everyone out from one
# person's typos). Old timestamps are pruned lazily on each check so this never grows unbounded.
LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60
LOGIN_ATTEMPT_MAX = 5
_login_attempts: dict = collections.defaultdict(list)

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def _check_login_rate_limit(key: str):
    now = time.time()
    attempts = [t for t in _login_attempts[key] if now - t < LOGIN_ATTEMPT_WINDOW_SECONDS]
    _login_attempts[key] = attempts
    if len(attempts) >= LOGIN_ATTEMPT_MAX:
        retry_after_sec = int(LOGIN_ATTEMPT_WINDOW_SECONDS - (now - attempts[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed login attempts. Please try again in {max(1, retry_after_sec // 60)} minute(s).",
        )

def _record_failed_login(key: str):
    _login_attempts[key].append(time.time())

# --- Register / forgot-password brute-force protection ---
# Unlike login (which only counts *failed* attempts, so a legitimate student who mistypes their
# password a couple times is never blocked), these two endpoints have no "success" outcome worth
# distinguishing -- every call is either a new account being created or a password-reset email
# being sent, so every call consumes a slot regardless of outcome. Register is keyed by IP alone
# (stops one source from mass-creating accounts); forgot-password is keyed by IP+email (stops both
# spamming one student's inbox and one IP hammering many different emails).
REGISTER_ATTEMPT_WINDOW_SECONDS = 60 * 60
REGISTER_ATTEMPT_MAX = 8
_register_attempts: dict = collections.defaultdict(list)

FORGOT_PASSWORD_ATTEMPT_WINDOW_SECONDS = 15 * 60
FORGOT_PASSWORD_ATTEMPT_MAX = 5
_forgot_password_attempts: dict = collections.defaultdict(list)

def _check_and_consume_rate_limit(store: dict, key: str, window_seconds: int, max_attempts: int, what: str):
    now = time.time()
    attempts = [t for t in store[key] if now - t < window_seconds]
    if len(attempts) >= max_attempts:
        store[key] = attempts
        retry_after_sec = int(window_seconds - (now - attempts[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Too many {what} attempts from this connection. Please try again in {max(1, retry_after_sec // 60)} minute(s).",
        )
    attempts.append(now)
    store[key] = attempts

@app.post("/api/auth/login")
def login(data: LoginRequest, request: Request):
    email = data.email.strip().lower()
    rate_limit_key = f"{_client_ip(request)}:{email}"
    _check_login_rate_limit(rate_limit_key)
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    if not user or not verify_password(data.password, user["password_hash"]):
        _record_failed_login(rate_limit_key)
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    _login_attempts.pop(rate_limit_key, None)
    token = create_access_token(user["id"])
    return {"status": "success", "access_token": token, "user": user_profile_dict(user)}

@app.post("/api/auth/google")
def google_login(data: GoogleLoginRequest):
    """Verifies the ID token Google Identity Services hands back to the frontend after the
    student picks their Google account, then either logs them into their existing account
    (matched by google_id first, then by email so someone who registered with a password can
    still link their Google account by signing in with the same address) or creates a brand new
    one. Google has already verified the student's email for us, so accounts created this way
    start out email_verified = 1 -- no separate verification email is needed."""
    if not GOOGLE_CLIENT_ID or not google_id_token:
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured on this server yet")

    try:
        payload = google_id_token.verify_oauth2_token(
            data.id_token, google_auth_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    google_id = payload.get("sub")
    email = (payload.get("email") or "").strip().lower()
    email_verified_by_google = bool(payload.get("email_verified"))
    name = payload.get("name") or (email.split("@")[0] if email else "Student")
    if not google_id or not email or not email_verified_by_google:
        raise HTTPException(status_code=401, detail="Google account is missing a verified email")

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE google_id = ?", (google_id,)).fetchone()
    if not user:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if user:
            # Existing password-based account with the same email -- link this Google identity to
            # it instead of creating a duplicate account.
            conn.execute("UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?", (google_id, user["id"]))
            conn.commit()
            user = get_user_by_id(conn, user["id"])
        else:
            is_first_user = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"] == 0
            legacy = load_legacy_profile_settings() if is_first_user else {}
            exam_date = legacy.get("exam_date", "")
            target_score = float(legacy.get("target_score", 5.5))
            insert_sql = """
                INSERT INTO users (email, username, google_id, email_verified, exam_date, target_score)
                VALUES (?, ?, ?, 1, ?, ?)
            """
            params = (email, name, google_id, exam_date, target_score)
            if DATABASE_URL:
                cursor = conn.execute(insert_sql.rstrip() + " RETURNING id", params)
                user_id = cursor.fetchone()["id"]
            else:
                cursor = conn.execute(insert_sql, params)
                user_id = cursor.lastrowid
            conn.commit()
            if is_first_user:
                migrate_legacy_data_to_user(user_id)
            user = get_user_by_id(conn, user_id)
    conn.close()

    token = create_access_token(user["id"])
    return {"status": "success", "access_token": token, "user": user_profile_dict(user)}

@app.post("/api/auth/forgot-password")
def forgot_password(data: ForgotPasswordRequest, request: Request):
    """Always returns the same generic success message whether or not the email is registered --
    this stops someone from using this endpoint to check which emails have an account here."""
    email = data.email.strip().lower()
    _check_and_consume_rate_limit(_forgot_password_attempts, f"{_client_ip(request)}:{email}", FORGOT_PASSWORD_ATTEMPT_WINDOW_SECONDS, FORGOT_PASSWORD_ATTEMPT_MAX, "password-reset")
    print(f"[password reset] forgot-password called for email={email!r}", flush=True)
    conn = get_db()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    print(f"[password reset] user lookup result: {'FOUND id=' + str(user['id']) if user else 'NOT FOUND'}", flush=True)
    if user:
        reset_token = secrets.token_urlsafe(32)
        reset_expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        conn.execute(
            "UPDATE users SET password_reset_token = ?, password_reset_token_expires = ? WHERE id = ?",
            (reset_token, reset_expires, user["id"]),
        )
        conn.commit()
        reset_link = f"{FRONTEND_PUBLIC_URL}/?reset_token={reset_token}"
        send_password_reset_email(email, reset_link)
    conn.close()
    return {"status": "success", "message": "If an account exists for that email, a reset link has been sent."}

@app.post("/api/auth/reset-password")
def reset_password(data: ResetPasswordRequest):
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE password_reset_token = ?", (data.token,)
    ).fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=400, detail="This reset link is invalid or has already been used")
    expires = user["password_reset_token_expires"]
    if not expires or _parse_db_datetime(expires) < datetime.now(timezone.utc):
        conn.close()
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one")
    conn.execute(
        "UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_token_expires = NULL WHERE id = ?",
        (hash_password(data.new_password), user["id"]),
    )
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Password updated. You can now log in with your new password."}

@app.get("/api/auth/me")
def get_me(user=Depends(get_current_user)):
    return user_profile_dict(user)

# ============================================================
# SUBSCRIPTION (iyzico) -- see İYZİCO CONFIG block near the top of this file for env vars,
# _iyzico_request()/_iyzico_auth_header() for the signed HTTP call helper, and
# has_active_subscription()/gate_pool() for how this gates the actual content endpoints below.
# ============================================================

class IyzicoCheckoutRequest(BaseModel):
    # iyzico's subscription API requires this buyer info up front (unlike Stripe, which only
    # needs an email) -- collected via a short form on the Subscribe screen before the embedded
    # payment widget renders. identity_number is the Turkish TC Kimlik No field; for a foreign
    # student without one, a placeholder (e.g. 11111111111) is the common workaround other iyzico
    # merchants use for non-Turkish cardholders -- confirm this is accepted once real/sandbox
    # keys are in and this flow can actually be tested end to end.
    name: str
    surname: str
    gsm_number: str
    identity_number: str
    address: str
    city: str
    country: str = "Turkey"

@app.get("/api/subscription/status")
def get_subscription_status(user=Depends(get_current_user)):
    return {
        "has_premium": has_active_subscription(user),
        "status": user["subscription_status"],
        "current_period_end": (
            user["subscription_current_period_end"].isoformat()
            if isinstance(user["subscription_current_period_end"], datetime)
            else user["subscription_current_period_end"]
        ),
    }

@app.post("/api/subscription/create-checkout-session")
def create_checkout_session(data: IyzicoCheckoutRequest, user=Depends(get_current_user)):
    """Starts an iyzico Subscription Checkout Form flow. Unlike Stripe (which returns a URL to
    redirect to), iyzico returns an HTML/JS snippet (checkoutFormContent) meant to be embedded
    directly on THIS site -- the frontend injects it into the Subscribe screen and iyzico's own
    script renders the card-entry widget in place. The student never leaves mrreadyprep.com."""
    _require_iyzico()
    body = {
        "locale": "tr",
        # iyzico's embedded widget POSTs the result to this URL when the student finishes paying
        # -- it must be a URL that accepts POST (our own backend), not the static frontend site,
        # which can only serve GET requests. The handler below re-redirects the browser (a GET)
        # to the frontend with the token attached as a query param so the SPA can pick it up.
        "callbackUrl": f"{BACKEND_PUBLIC_URL}/api/subscription/checkout-callback",
        "pricingPlanReferenceCode": IYZICO_PRICING_PLAN_REFERENCE_CODE,
        "subscriptionInitialStatus": "ACTIVE",
        "conversationId": str(user["id"]),
        "customer": {
            "name": data.name,
            "surname": data.surname,
            "email": user["email"],
            "gsmNumber": data.gsm_number,
            "identityNumber": data.identity_number,
            "billingAddress": {
                "address": data.address,
                "contactName": f"{data.name} {data.surname}",
                "city": data.city,
                "country": data.country,
            },
        },
    }
    result = _iyzico_request("POST", "/v2/subscription/checkoutform/initialize", body)
    if result.get("status") != "success":
        raise HTTPException(status_code=400, detail=result.get("errorMessage", "iyzico checkout could not be started"))
    return {
        "token": result.get("token"),
        "checkoutFormContent": result.get("checkoutFormContent"),
        "tokenExpireTime": result.get("tokenExpireTime"),
    }

@app.post("/api/subscription/checkout-callback")
async def checkout_callback(request: Request):
    """iyzico's embedded widget POSTs here (form-encoded, with a `token` field) once the student
    finishes the payment step in the iframe. This endpoint has no auth of its own -- it just
    bounces the browser on to the frontend with the token in the URL, and the frontend calls the
    authenticated /api/subscription/checkout-result/{token} endpoint (above) to actually confirm
    and persist the result. Also accept a query-string token as a fallback in case the widget
    ever redirects via GET instead of POST."""
    token = request.query_params.get("token")
    if not token:
        try:
            form = await request.form()
            token = form.get("token")
        except Exception:
            token = None
    dest = f"{FRONTEND_PUBLIC_URL}/?subscription_token={token}" if token else f"{FRONTEND_PUBLIC_URL}/?subscription=cancel"
    return RedirectResponse(url=dest, status_code=303)

@app.get("/api/subscription/checkout-result/{token}")
def get_checkout_result(token: str, user=Depends(get_current_user)):
    """Polled by the frontend once iyzico's embedded widget reports the payment step finished --
    confirms server-side what actually happened and persists the subscription onto this user's
    account. This (plus the webhook below, for later renewals) is what actually flips
    subscription_status to ACTIVE; the embedded widget finishing is not itself trusted."""
    _require_iyzico()
    result = _iyzico_request("GET", f"/v2/subscription/checkoutform/{token}")
    if result.get("status") != "success":
        raise HTTPException(status_code=400, detail=result.get("errorMessage", "Could not retrieve checkout result"))
    data = result.get("data") or {}
    status = data.get("subscriptionStatus")
    period_end_ms = data.get("endDate")
    period_end = (
        datetime.fromtimestamp(period_end_ms / 1000, tz=timezone.utc).isoformat() if period_end_ms else None
    )
    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET iyzico_customer_reference_code = ?, iyzico_subscription_reference_code = ?, "
            "subscription_status = ?, subscription_current_period_end = ? WHERE id = ?",
            (data.get("customerReferenceCode"), data.get("referenceCode"), status, period_end, user["id"]),
        )
        conn.commit()
    finally:
        conn.close()
    return {"subscription_status": status, "has_premium": status in ACTIVE_SUBSCRIPTION_STATUSES}

@app.post("/api/subscription/cancel")
def cancel_subscription(user=Depends(get_current_user)):
    """iyzico has no hosted billing-management page like Stripe's Customer Portal -- cancellation
    is a direct API call we make on the student's behalf from a confirm button in Settings."""
    _require_iyzico()
    if not user["iyzico_subscription_reference_code"]:
        raise HTTPException(status_code=400, detail="No active subscription on file")
    result = _iyzico_request(
        "POST",
        f"/v2/subscription/subscriptions/{user['iyzico_subscription_reference_code']}/cancel",
        {},
    )
    if result.get("status") != "success":
        raise HTTPException(status_code=400, detail=result.get("errorMessage", "Could not cancel subscription"))
    conn = get_db()
    try:
        conn.execute("UPDATE users SET subscription_status = 'CANCELED' WHERE id = ?", (user["id"],))
        conn.commit()
    finally:
        conn.close()
    return {"status": "success"}

@app.post("/api/subscription/webhook")
async def iyzico_webhook(request: Request):
    """iyzico POSTs here (no Authorization header -- verified via X-IYZ-SIGNATURE-V3 instead)
    after every subscription payment attempt, including renewals, not just the first one -- this
    is what keeps subscription_status in sync automatically on renewal/failure without anyone
    needing to poll iyzico. Must be registered as the Merchant Subscription Notifications URL in
    the iyzico panel (Settings > Merchant Settings > Merchant Subscription Notifications)."""
    if not IYZICO_MERCHANT_ID or not IYZICO_SECRET_KEY:
        raise HTTPException(status_code=500, detail="iyzico webhook not configured (IYZICO_MERCHANT_ID missing)")
    payload = await request.body()
    try:
        event = json.loads(payload.decode("utf-8"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    event_type = event.get("iyziEventType", "")
    subscription_ref = event.get("subscriptionReferenceCode", "")
    order_ref = event.get("orderReferenceCode", "")
    customer_ref = event.get("customerReferenceCode", "")

    sig_header = request.headers.get("x-iyz-signature-v3", "") or request.headers.get("X-IYZ-SIGNATURE-V3", "")
    message = IYZICO_MERCHANT_ID + IYZICO_SECRET_KEY + event_type + subscription_ref + order_ref + customer_ref
    expected_sig = hmac.new(IYZICO_SECRET_KEY.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
    if not sig_header or not hmac.compare_digest(sig_header, expected_sig):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    conn = get_db()
    try:
        if event_type == "subscription.order.success":
            conn.execute(
                "UPDATE users SET subscription_status = 'ACTIVE' WHERE iyzico_subscription_reference_code = ?",
                (subscription_ref,),
            )
            conn.commit()
        elif event_type == "subscription.order.failure":
            # A failed renewal charge -- iyzico retries automatically; mark UNPAID so access is
            # revoked immediately rather than waiting for the retry outcome. If a later retry
            # succeeds, the next "subscription.order.success" event flips it back to ACTIVE.
            conn.execute(
                "UPDATE users SET subscription_status = 'UNPAID' WHERE iyzico_subscription_reference_code = ?",
                (subscription_ref,),
            )
            conn.commit()
    finally:
        conn.close()
    return {"status": "ok"}

# --- Dashboard ---
@app.get("/api/dashboard")
def get_dashboard(user=Depends(get_current_user)):
    # Section scores are always the live average of that section's attempted parts (see
    # compute_section_band) -- a section with zero attempts shows band 1.0, the scale's floor,
    # rather than a placeholder that makes an untouched section look already-practiced.
    conn = get_db()
    updates = {}
    for section in ("reading", "listening", "writing", "speaking"):
        updates[f"{section}_score"] = compute_section_band(conn, user["id"], section)
    streak, week_activity = compute_streak_and_week_activity(conn, user["id"])
    updates["current_streak"] = streak
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", (*updates.values(), user["id"]))
    conn.commit()
    fresh_user = get_user_by_id(conn, user["id"])
    # "mock_overall" is only ever saved once per completed Full Mock Test (all 4 sections) -- see
    # saveResult('mock_overall', ...) on the frontend -- so its most recent saved_at is exactly
    # "when did this student last finish a full test", which the Dashboard's mock-test card shows.
    last_mock_row = conn.execute(
        "SELECT saved_at FROM attempt_results WHERE user_id = ? AND category = 'mock_overall' "
        "ORDER BY saved_at DESC LIMIT 1",
        (user["id"],),
    ).fetchone()
    conn.close()
    result = user_profile_dict(fresh_user)
    result["week_activity"] = week_activity
    result["last_mock_test_at"] = (
        last_mock_row["saved_at"].isoformat() if isinstance(last_mock_row["saved_at"], datetime)
        else last_mock_row["saved_at"]
    ) if last_mock_row else None
    return result

@app.post("/api/profile/update")
def update_profile(data: DashboardData, user=Depends(get_current_user)):
    conn = get_db()
    fields = {"username": data.username, "target_score": data.target_score}
    if data.reading_target is not None:
        fields["reading_target"] = data.reading_target
    if data.listening_target is not None:
        fields["listening_target"] = data.listening_target
    if data.writing_target is not None:
        fields["writing_target"] = data.writing_target
    if data.speaking_target is not None:
        fields["speaking_target"] = data.speaking_target
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", (*fields.values(), user["id"]))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Profile updated successfully"}

@app.post("/api/profile/exam-date")
def update_exam_date(data: ExamDateUpdate, user=Depends(get_current_user)):
    conn = get_db()
    conn.execute("UPDATE users SET exam_date = ? WHERE id = ?", (data.exam_date, user["id"]))
    conn.commit()
    conn.close()
    return {"status": "success", "exam_date": data.exam_date}

# --- Vocabulary ---
@app.get("/api/vocab")
def get_vocab(user=Depends(get_current_user)):
    conn = get_db()
    learned_ids = {row["word_id"] for row in conn.execute(
        "SELECT word_id FROM vocab_learned WHERE user_id = ?", (user["id"],)
    ).fetchall()}
    conn.close()
    return [{**w, "learned": w["id"] in learned_ids} for w in vocab_words]

@app.post("/api/vocab/toggle/{word_id}")
def toggle_vocab(word_id: int, user=Depends(get_current_user)):
    if not any(w["id"] == word_id for w in vocab_words):
        return {"status": "error", "message": "Word not found"}
    conn = get_db()
    already = conn.execute(
        "SELECT 1 FROM vocab_learned WHERE user_id = ? AND word_id = ?", (user["id"], word_id)
    ).fetchone()
    if already:
        conn.execute("DELETE FROM vocab_learned WHERE user_id = ? AND word_id = ?", (user["id"], word_id))
        now_learned = False
    else:
        conn.execute("INSERT INTO vocab_learned (user_id, word_id) VALUES (?, ?)", (user["id"], word_id))
        now_learned = True
    learned_count = conn.execute(
        "SELECT COUNT(*) AS n FROM vocab_learned WHERE user_id = ?", (user["id"],)
    ).fetchone()["n"]
    conn.execute("UPDATE users SET vocab_level = ? WHERE id = ?", (1 + learned_count // 5, user["id"]))
    conn.commit()
    conn.close()
    return {"status": "success", "learned": now_learned}

# --- Reading: Complete the Words ---
@app.get("/api/reading/complete-the-words")
def get_ctw_exercises(user=Depends(get_current_user_optional)):
    with open(CTW_FILE, "r", encoding="utf-8") as f:
        return gate_pool(json.load(f), user)

# --- Reading: Read in Daily Life ---
@app.get("/api/reading/read-in-daily-life")
def get_ridl_passages(user=Depends(get_current_user_optional)):
    with open(RIDL_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return gate_pool(data, user, free_ids=frozenset({_ridl_free_id(data)}))

@app.post("/api/reading/save-result")
def save_ridl_result(data: RIDLResult, user=Depends(get_current_user)):
    pct = round((data.score / data.total) * 100) if data.total > 0 else 0
    conn = get_db()
    conn.execute("""
        INSERT INTO ridl_results (user_id, passage_id, score, total, pct)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, passage_id) DO UPDATE SET
            score=excluded.score,
            total=excluded.total,
            pct=excluded.pct,
            saved_at=CURRENT_TIMESTAMP
    """, (user["id"], data.passage_id, data.score, data.total, pct))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/reading/results")
def get_ridl_results(user=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT passage_id, score, total, pct FROM ridl_results WHERE user_id = ?", (user["id"],)
    ).fetchall()
    conn.close()
    return {str(row["passage_id"]): {"score": row["score"], "total": row["total"], "pct": row["pct"]} for row in rows}

# --- Unified progress tracking (every exercise type + mock tests) ---
CATEGORY_LABELS = {
    "ctw": "Complete the Words",
    "ridl": "Read in Daily Life",
    "ap": "Academic Passage",
    "listening_p1": "Choose a Response",
    "listening_p2": "Listen to a Conversation",
    "listening_p3": "Listen to an Announcement",
    "listening_p4": "Listen to an Academic Talk",
    "bas": "Build a Sentence",
    "email": "Write an Email",
    "disc": "Academic Discussion",
    "speaking_lr": "Listen and Repeat",
    "speaking_interview": "Take an Interview",
    "mock_reading": "Mock Test · Reading",
    "mock_listening": "Mock Test · Listening",
    "mock_writing": "Mock Test · Writing",
    "mock_speaking": "Mock Test · Speaking",
    "mock_overall": "Mock Test · Overall",
}

# Maps each TOEFL section to the practice categories that feed it, plus its dedicated mock-test
# category. Used to turn raw attempt_results rows into the dashboard's reading/listening/writing/
# speaking_score fields, so those numbers move as the student actually practices instead of
# staying frozen at their initial placeholder values.
SECTION_PRACTICE_CATEGORIES = {
    "reading": ["ctw", "ridl", "ap"],
    "listening": ["listening_p1", "listening_p2", "listening_p3", "listening_p4"],
    "writing": ["bas", "email", "disc"],
    "speaking": ["speaking_lr", "speaking_interview"],
}
SECTION_MOCK_CATEGORY = {
    "reading": "mock_reading",
    "listening": "mock_listening",
    "writing": "mock_writing",
    "speaking": "mock_speaking",
}
# TOEFL 2026 format: Reading and Listening are reported on a 1.0-6.0 scale, Writing and Speaking
# on a narrower 1.0-5.0 scale. Mirrors SECTION_BAND_MAX in the frontend (App.jsx).
SECTION_BAND_MAX = {
    "reading": 6.0,
    "listening": 6.0,
    "writing": 5.0,
    "speaking": 5.0,
}

def compute_section_band(conn, user_id, section):
    """Computes this section's TOEFL-style band (nearest 0.5, on that section's own 1.0-6.0 or
    1.0-5.0 scale) as the average of that section's PARTS -- Reading, for example, is Complete
    the Words, Read in Daily Life, Academic Passage, and the Mock Reading module, each its own
    part. Each part's own score is a true question-solved average (SUM of points earned / SUM of
    points possible across every attempt of that part, so a 20-question exercise counts more than
    a 5-question one WITHIN that part). Those part averages are then combined with EQUAL weight
    across only the parts the student has actually attempted -- an untouched part is skipped
    entirely rather than dragging the average down to 0%, so getting a perfect score on the one
    part you've tried shows as a high score right away, even before you've touched the section's
    other parts.
    Returns 1.0 (the lowest possible band on any TOEFL section scale) if the student hasn't
    attempted a single part of this section yet, so an untouched section reads as "not started"
    rather than showing an artificially inflated placeholder score."""
    cats = SECTION_PRACTICE_CATEGORIES[section] + [SECTION_MOCK_CATEGORY[section]]
    part_pcts = []
    for cat in cats:
        row = conn.execute(
            "SELECT SUM(score) AS total_score, SUM(total) AS total_possible, COUNT(*) AS n "
            "FROM attempt_results WHERE category = ? AND user_id = ?",
            (cat, user_id),
        ).fetchone()
        if row["n"] and row["total_possible"]:
            part_pcts.append((row["total_score"] / row["total_possible"]) * 100)

    if not part_pcts:
        return 1.0
    avg_pct = sum(part_pcts) / len(part_pcts)
    max_band = SECTION_BAND_MAX[section]
    # Simple linear map from question-solving accuracy % to this section's 1.0-max_band scale
    # (0% -> 1.0, 100% -> max_band).
    band = max(1.0, min(max_band, 1 + (avg_pct / 100) * (max_band - 1)))
    return round(band * 2) / 2

@app.post("/api/results/save")
def save_attempt_result(data: AttemptResult, user=Depends(get_current_user)):
    pct = round((data.score / data.total) * 100) if data.total > 0 else 0
    conn = get_db()
    conn.execute("""
        INSERT INTO attempt_results (user_id, category, item_id, label, score, total, pct)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user["id"], data.category, data.item_id, data.label, data.score, data.total, pct))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/results/history")
def get_results_history(category: str = None, limit: int = 300, user=Depends(get_current_user)):
    conn = get_db()
    if category:
        rows = conn.execute(
            "SELECT * FROM attempt_results WHERE category = ? AND user_id = ? ORDER BY saved_at DESC LIMIT ?",
            (category, user["id"], limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM attempt_results WHERE user_id = ? ORDER BY saved_at DESC LIMIT ?",
            (user["id"], limit),
        ).fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/results/summary")
def get_results_summary(user=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("""
        SELECT category,
               COUNT(*) AS attempts,
               AVG(pct) AS avg_pct,
               MAX(pct) AS best_pct,
               SUM(score) AS total_score,
               SUM(total) AS total_possible,
               MAX(saved_at) AS last_attempt
        FROM attempt_results
        WHERE user_id = ?
        GROUP BY category
    """, (user["id"],)).fetchall()
    overall = conn.execute("""
        SELECT COUNT(*) AS attempts, AVG(pct) AS avg_pct, MAX(saved_at) AS last_attempt
        FROM attempt_results
        WHERE user_id = ?
    """, (user["id"],)).fetchone()
    conn.close()

    by_category = {}
    for row in rows:
        cat = row["category"]
        by_category[cat] = {
            "label": CATEGORY_LABELS.get(cat, cat),
            "attempts": row["attempts"],
            "avg_pct": round(row["avg_pct"]) if row["avg_pct"] is not None else 0,
            "best_pct": row["best_pct"] or 0,
            "total_score": row["total_score"],
            "total_possible": row["total_possible"],
            "last_attempt": row["last_attempt"],
        }
    return {
        "by_category": by_category,
        "overall": {
            "attempts": overall["attempts"] or 0,
            "avg_pct": round(overall["avg_pct"]) if overall["avg_pct"] is not None else 0,
            "last_attempt": overall["last_attempt"],
        },
    }

# --- Reading: Academic Passage ---
@app.get("/api/reading/academic-passage")
async def get_academic_passage(user=Depends(get_current_user_optional)):
    json_path = os.path.join(os.path.dirname(__file__), "academic_passage_1.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return gate_pool(data, user)

# --- Full Mock Test: Reading content, kept entirely separate from the practice pools above
# so a student never sees the same question in both practice mode and the mock test. ---
@app.get("/api/mock/complete-the-words")
def get_mock_ctw_exercises(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_CTW_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/read-in-daily-life")
def get_mock_ridl_passages(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_RIDL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/academic-passage")
def get_mock_academic_passage(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_AP_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Full Mock Test: Listening content, kept entirely separate from the practice pools below
# so a student never sees the same question in both practice mode and the mock test. ---
@app.get("/api/mock/choose-response")
def get_mock_listening_car(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_LISTENING_CAR_FILE, "r", encoding="utf-8") as f:
        return _fix_audio_urls(json.load(f))

@app.get("/api/mock/conversation")
def get_mock_listening_conv(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_LISTENING_CONV_FILE, "r", encoding="utf-8") as f:
        return _fix_audio_urls(json.load(f))

@app.get("/api/mock/announcement")
def get_mock_listening_announce(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_LISTENING_ANNOUNCE_FILE, "r", encoding="utf-8") as f:
        return _fix_audio_urls(json.load(f))

@app.get("/api/mock/academic-talk")
def get_mock_listening_at(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_LISTENING_AT_FILE, "r", encoding="utf-8") as f:
        return _fix_audio_urls(json.load(f))

# --- Full Mock Test: Writing content, kept entirely separate from the practice pools below ---
@app.get("/api/mock/build-a-sentence")
def get_mock_bas(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_BAS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/email")
def get_mock_email(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_EMAIL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/academic-discussion")
def get_mock_disc(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_DISC_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Full Mock Test: Speaking content, kept entirely separate from the practice pools below ---
@app.get("/api/mock/listen-and-repeat")
def get_mock_speaking_lr(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_SPEAKING_LR_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)  # fresh read every request, so JSON edits show up without a restart
    for s in data:
        s["audio_url_intro"] = f"{AUDIO_BASE_URL}/mock_speaking_lr/{s['id']}/intro.mp3"
        for sent in s["sentences"]:
            sent["audio_url"] = f"{AUDIO_BASE_URL}/mock_speaking_lr/{s['id']}/{sent['id']}.mp3"
    return data

@app.get("/api/mock/interview")
def get_mock_speaking_interview(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    with open(MOCK_SPEAKING_INTERVIEW_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)  # fresh read every request, so JSON edits show up without a restart
    for s in data:
        s["audio_url_intro"] = f"{AUDIO_BASE_URL}/mock_speaking_interview/{s['id']}/intro.mp3"
        for q in s["questions"]:
            q["audio_url"] = f"{AUDIO_BASE_URL}/mock_speaking_interview/{s['id']}/{q['id']}.mp3"
    return data

# --- Full Mock Test: per-student "seen before" tracking for the random-draw pools above -------
# Only the dynamic (non-fixed) Full Mock Test and "practice one section" random drills sample
# randomly from these pools every attempt -- the 20 fixed tests always show identical content on
# purpose and never touch this. Maps each pool key (matching the frontend's `pools.X` object) to
# the JSON file that holds it, so this file's own item ids stay the single source of truth for
# what "every item in the pool" means.
MOCK_POOL_FILES = {
    "ctw": MOCK_CTW_FILE, "ridl": MOCK_RIDL_FILE, "ap": MOCK_AP_FILE,
    "car": MOCK_LISTENING_CAR_FILE, "conv": MOCK_LISTENING_CONV_FILE,
    "announce": MOCK_LISTENING_ANNOUNCE_FILE, "at": MOCK_LISTENING_AT_FILE,
    "bas": MOCK_BAS_FILE, "email": MOCK_EMAIL_FILE, "disc": MOCK_DISC_FILE,
    "lr": MOCK_SPEAKING_LR_FILE, "interview": MOCK_SPEAKING_INTERVIEW_FILE,
}

def _pool_all_ids(pool: str) -> set:
    """Every currently-valid item id for one pool. The 'car' (Choose a Response) pool is grouped
    into exercises of several questions each -- the frontend flattens it with a composite
    `${exerciseId}-${questionId}` id (see flattenCarPool in App.jsx), so this mirrors that exact
    scheme rather than tracking at the coarser exercise level."""
    path = MOCK_POOL_FILES.get(pool)
    if not path or not os.path.exists(path):
        return set()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if pool == "car":
        ids = set()
        for ex in data:
            for q in ex.get("questions", []):
                ids.add(f"{ex.get('id')}-{q.get('id')}")
        return ids
    return {str(item.get("id")) for item in data}

@app.get("/api/mock/seen-ids")
def get_mock_seen_ids(user=Depends(get_current_user)):
    """Returns, per pool, the item ids this student has already been served by a random draw
    (dynamic Full Mock Test or a single-section practice drill) -- the frontend filters each pool
    down to just the unseen items before sampling, so the same question never comes up twice in a
    row. Once a pool is fully exhausted (every currently-valid id has been seen), this clears that
    pool's seen rows and reports it as fresh again, so the pool wraps around and starts repeating
    from the top instead of leaving the student with an ever-shrinking draw."""
    conn = get_db()
    result = {}
    for pool, all_ids in ((p, _pool_all_ids(p)) for p in MOCK_POOL_FILES):
        rows = conn.execute(
            "SELECT item_id FROM seen_pool_items WHERE user_id = ? AND pool = ?",
            (user["id"], pool),
        ).fetchall()
        seen_ids = {row["item_id"] for row in rows}
        if all_ids and all_ids.issubset(seen_ids):
            conn.execute("DELETE FROM seen_pool_items WHERE user_id = ? AND pool = ?", (user["id"], pool))
            seen_ids = set()
        result[pool] = sorted(seen_ids)
    conn.commit()
    conn.close()
    return result

class MarkSeenRequest(BaseModel):
    pool: str
    item_ids: List[str]

@app.post("/api/mock/mark-seen")
def mark_mock_seen(data: MarkSeenRequest, user=Depends(get_current_user)):
    """Called right after a dynamic Full Mock Test or single-section practice drill draws its
    questions (not after the student finishes them) -- being shown a question is what should stop
    it from repeating, whether or not the student actually answers it before saving & exiting."""
    if data.pool not in MOCK_POOL_FILES or not data.item_ids:
        return {"status": "success"}
    conn = get_db()
    for item_id in data.item_ids:
        conn.execute(
            "INSERT INTO seen_pool_items (user_id, pool, item_id) VALUES (?, ?, ?) "
            "ON CONFLICT(user_id, pool, item_id) DO NOTHING",
            (user["id"], data.pool, str(item_id)),
        )
    conn.commit()
    conn.close()
    return {"status": "success"}

# --- Full Mock Test: fixed (pre-built) tests, served whole as one bundle per test id ---
@app.get("/api/mock/fixed-test/{test_id}")
def get_fixed_test(test_id: int, user=Depends(get_current_user_optional)):
    path = FIXED_TEST_FILES.get(test_id)
    if not path:
        raise HTTPException(status_code=404, detail=f"No fixed test with id {test_id}")
    if test_id != FREE_FIXED_TEST_ID and not (user is not None and has_active_subscription(user)):
        raise HTTPException(
            status_code=402,
            detail=f"Mock Test {test_id} requires an active mrreadyprep subscription. Mock Test {FREE_FIXED_TEST_ID} is free to try.",
        )
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)  # fresh read every request, so JSON edits show up without a restart
    # The two Speaking items were saved without audio_url (same as mock_speaking_lr/interview
    # above) since their mp3s live under the ORIGINAL shared pool's id-keyed folders — inject
    # the URLs here exactly like the dynamic-pool endpoints do.
    lr = data["speaking"]["lr"]
    lr["audio_url_intro"] = f"{AUDIO_BASE_URL}/mock_speaking_lr/{lr['id']}/intro.mp3"
    for sent in lr["sentences"]:
        sent["audio_url"] = f"{AUDIO_BASE_URL}/mock_speaking_lr/{lr['id']}/{sent['id']}.mp3"
    interview = data["speaking"]["interview"]
    interview["audio_url_intro"] = f"{AUDIO_BASE_URL}/mock_speaking_interview/{interview['id']}/intro.mp3"
    for q in interview["questions"]:
        q["audio_url"] = f"{AUDIO_BASE_URL}/mock_speaking_interview/{interview['id']}/{q['id']}.mp3"
    data["listening"] = _fix_audio_urls(data["listening"])
    return data

# --- Listening ---
@app.get("/api/listening/choose-response")
def get_listening_p1(user=Depends(get_current_user_optional)):
    with open(LISTENING_P1_FILE, "r", encoding="utf-8") as f:
        return gate_pool(_fix_audio_urls(json.load(f)), user)

@app.get("/api/listening/conversation")
def get_listening_p2(user=Depends(get_current_user_optional)):
    with open(LISTENING_P2_FILE, "r", encoding="utf-8") as f:
        return gate_pool(_fix_audio_urls(json.load(f)), user)

@app.get("/api/listening/announcement")
def get_listening_p3(user=Depends(get_current_user_optional)):
    with open(LISTENING_P3_FILE, "r", encoding="utf-8") as f:
        return gate_pool(_fix_audio_urls(json.load(f)), user)

@app.get("/api/listening/academic-talk")
def get_listening_p4(user=Depends(get_current_user_optional)):
    with open(LISTENING_P4_FILE, "r", encoding="utf-8") as f:
        return gate_pool(_fix_audio_urls(json.load(f)), user)

# --- Writing: Build a Sentence ---
@app.get("/api/writing/build-a-sentence")
def get_build_a_sentence(user=Depends(get_current_user_optional)):
    # The frontend groups raw items into practice "sets" of BUILD_SENTENCE_SET_SIZE (10, kept in
    # sync with the constant of the same name in App.jsx) -- a non-subscriber needs the WHOLE
    # first set free, not just item id 1, or Set 1 would be a broken mix of 1 real item + 9 locked
    # stubs.
    with open(BUILD_A_SENTENCE_FILE, "r", encoding="utf-8") as f:
        return gate_pool(json.load(f), user, free_ids=frozenset(range(1, 11)))

# --- Writing: Email (JSON tabanlı liste, tüm pratikler) ---
@app.get("/api/writing/email")
def get_write_email_list(user=Depends(get_current_user_optional)):
    with open(WRITE_EMAIL_FILE, "r", encoding="utf-8") as f:
        return gate_pool(json.load(f), user)

# --- Writing: Academic Discussion ---
@app.get("/api/writing/academic-discussion")
def get_academic_discussion_list(user=Depends(get_current_user_optional)):
    with open(WRITE_DISCUSSION_FILE, "r", encoding="utf-8") as f:
        return gate_pool(json.load(f), user)

# --- Speaking: Listen and Repeat ---
@app.get("/api/speaking/listen-and-repeat")
def get_speaking_listen_repeat(user=Depends(get_current_user_optional)):
    with open(SPEAKING_LR_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    for s in data:
        s["audio_url_intro"] = f"{AUDIO_BASE_URL}/speaking_lr/{s['id']}/intro.mp3"
        for sent in s["sentences"]:
            sent["audio_url"] = f"{AUDIO_BASE_URL}/speaking_lr/{s['id']}/{sent['id']}.mp3"
    return gate_pool(data, user)

# --- Speaking: Take an Interview ---
@app.get("/api/speaking/interview")
def get_speaking_interview(user=Depends(get_current_user_optional)):
    with open(SPEAKING_INTERVIEW_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    for s in data:
        s["audio_url_intro"] = f"{AUDIO_BASE_URL}/speaking_interview/{s['id']}/intro.mp3"
        for q in s["questions"]:
            q["audio_url"] = f"{AUDIO_BASE_URL}/speaking_interview/{s['id']}/{q['id']}.mp3"
    return gate_pool(data, user)

# --- Writing: Email (eski DB tabanlı tekil soru, kullanılmıyor ama korunuyor) ---
@app.get("/api/writing/email/{question_id}")
async def get_email_question(question_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM email_questions WHERE id = ?", (question_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Question not found")
    return {
        "id": row["id"],
        "scenario": row["scenario"],
        "recipient": row["recipient"],
        "subject": row["subject"],
        "task_intro": row["task_intro"],
        "tasks": json.loads(row["tasks"]),
        "example_response": row["example_response"],
        "time_limit": row["time_limit"],
        "min_words": row["min_words"]
    }

@app.post("/api/writing/email/submit")
async def submit_email(submission: EmailSubmission):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM email_questions WHERE id = ?", (submission.question_id,))
    question = cursor.fetchone()
    if not question:
        conn.close()
        raise HTTPException(status_code=404, detail="Question not found")
    tasks = json.loads(question["tasks"])
    
    # Puanlama
    feedback = []
    score = 0.0
    lower = submission.response.lower()
    
    # Kelime sayısı
    if submission.word_count >= 100:
        score += 1.5
        feedback.append("Kelime sayisi mukemmel (100+)")
    elif submission.word_count >= 80:
        score += 1.0
        feedback.append(f"Kelime sayisi yeterli ({submission.word_count})")
    elif submission.word_count >= 60:
        score += 0.5
        feedback.append(f"Kelime sayisi biraz az ({submission.word_count})")
    else:
        feedback.append(f"Kelime sayisi yetersiz ({submission.word_count})")
    
    # Email yapısı
    has_greeting = any(kw in lower for kw in ["dear", "hello", "hi", "to whom"])
    has_closing = any(kw in lower for kw in ["sincerely", "regards", "thanks", "yours", "best"])
    has_body = submission.word_count > 40
    if has_greeting and has_closing and has_body:
        score += 1.5
        feedback.append("Email yapisi tam ve dogru")
    elif (has_greeting or has_closing) and has_body:
        score += 1.0
        feedback.append("Email yapisi eksik")
    elif has_body:
        score += 0.5
        feedback.append("Email yapisi eksik")
    
    # Görev tamamlama
    task_score = 0
    for task in tasks:
        keywords = task.get("keywords", [])
        matched = any(kw.lower() in lower for kw in keywords)
        if matched:
            task_score += 2 / len(tasks)
            feedback.append(f"'{task['description'][:40]}...' tamamlandi")
        else:
            feedback.append(f"'{task['description'][:40]}...' eksik")
    score += min(2, task_score)
    score = round(min(5, score), 1)
    
    cursor.execute("""
        INSERT INTO email_results (question_id, response, word_count, time_spent, score, feedback, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (submission.question_id, submission.response, submission.word_count,
          submission.time_spent, score, json.dumps(feedback), datetime.now().isoformat()))
    conn.commit()
    conn.close()
    
    return {
        "score": score, "max_score": 5.0, "feedback": feedback,
        "word_count": submission.word_count, "time_spent": submission.time_spent,
        "submitted_at": datetime.now().isoformat()
    }