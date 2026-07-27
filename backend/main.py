from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import json
import os
import re
import secrets
import sqlite3
import pathlib
import bcrypt
import jwt
import urllib.request
import urllib.error

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

# The audio/ folder is deployed separately from git (see AUDIO_DEPLOYMENT.md -- it's ~364MB of
# generated mp3s, too large for a normal git push). Create it if missing so a fresh deploy that
# hasn't had its persistent disk populated yet still boots instead of crashing at startup; audio
# playback simply 404s until the files are uploaded.
os.makedirs("audio", exist_ok=True)
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

# ============================================================
# VERİ MODELLERİ
# ============================================================

class DashboardData(BaseModel):
    username: str
    target_score: float

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

def get_db():
    conn = sqlite3.connect(str(DB_FILE))
    conn.row_factory = sqlite3.Row
    return conn

def _has_column(conn, table, column):
    cols = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    return column in cols

def init_db():
    conn = get_db()

    # Öğrenci hesapları -- her öğrencinin kendi email/kullanıcı adı ile açtığı hesap. Profil
    # alanları (exam_date, target_score, section skorları, vocab_level) artık ayrı bir kv-store
    # yerine doğrudan bu tabloda tutuluyor, her satır bir öğrencinin tüm profilini kapsıyor.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS email_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS attempt_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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

def send_password_reset_email(to_email: str, reset_link: str):
    """Sends the 'reset your password' email via Resend (resend.com), if RESEND_API_KEY is
    configured. If it isn't set yet, or the send fails for any reason, this just logs the link to
    the server console instead of raising -- forgot-password should never itself error out just
    because email delivery isn't wired up or hiccups, since the reset token has already been saved
    either way and the generic response to the student must stay the same regardless."""
    if not RESEND_API_KEY:
        print(f"[password reset] RESEND_API_KEY not set -- reset link for {to_email}: {reset_link}")
        return
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
        },
    )
    try:
        urllib.request.urlopen(req, timeout=10)
    except urllib.error.URLError as e:
        print(f"[password reset] Failed to send email to {to_email}: {e}")

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
    active_dates = {row["d"] for row in rows if row["d"]}

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
        "current_streak": user["current_streak"],
        "vocab_level": user["vocab_level"],
        "reading_score": user["reading_score"],
        "listening_score": user["listening_score"],
        "writing_score": user["writing_score"],
        "speaking_score": user["speaking_score"],
        "exam_date": user["exam_date"],
        "email_verified": bool(user["email_verified"]),
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
    cursor.execute("SELECT COUNT(*) FROM email_questions")
    count = cursor.fetchone()[0]
    
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
def register(data: RegisterRequest):
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

    cursor = conn.execute("""
        INSERT INTO users (email, username, password_hash, email_verified, verification_token,
                            verification_token_expires, exam_date, target_score)
        VALUES (?, ?, ?, 0, ?, ?, ?, ?)
    """, (email, username, hash_password(data.password), verification_token,
          verification_expires, exam_date, target_score))
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

@app.post("/api/auth/login")
def login(data: LoginRequest):
    email = data.email.strip().lower()
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    token = create_access_token(user["id"])
    return {"status": "success", "access_token": token, "user": user_profile_dict(user)}

@app.post("/api/auth/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    """Always returns the same generic success message whether or not the email is registered --
    this stops someone from using this endpoint to check which emails have an account here."""
    email = data.email.strip().lower()
    conn = get_db()
    user = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
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
    if not expires or datetime.fromisoformat(expires) < datetime.now(timezone.utc):
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

# --- Dashboard ---
@app.get("/api/dashboard")
def get_dashboard(user=Depends(get_current_user)):
    # Section scores reflect actual practice/mock-test performance whenever there's any recorded
    # activity for that section -- otherwise they keep whatever placeholder value is already on
    # the user's row, so a brand-new student doesn't see a jarring 1.0.
    conn = get_db()
    updates = {}
    for section in ("reading", "listening", "writing", "speaking"):
        band = compute_section_band(conn, user["id"], section)
        if band is not None:
            updates[f"{section}_score"] = band
    streak, week_activity = compute_streak_and_week_activity(conn, user["id"])
    updates["current_streak"] = streak
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", (*updates.values(), user["id"]))
    conn.commit()
    fresh_user = get_user_by_id(conn, user["id"])
    conn.close()
    result = user_profile_dict(fresh_user)
    result["week_activity"] = week_activity
    return result

@app.post("/api/profile/update")
def update_profile(data: DashboardData, user=Depends(get_current_user)):
    conn = get_db()
    conn.execute("UPDATE users SET username = ?, target_score = ? WHERE id = ?",
                 (data.username, data.target_score, user["id"]))
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
def get_ctw_exercises():
    with open(CTW_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Reading: Read in Daily Life ---
@app.get("/api/reading/read-in-daily-life")
def get_ridl_passages():
    with open(RIDL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

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
    Returns None if the student hasn't attempted anything in this section yet, so the caller can
    fall back to the existing placeholder score instead of showing an artificial 1.0."""
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
        return None
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
async def get_academic_passage():
    json_path = os.path.join(os.path.dirname(__file__), "academic_passage_1.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

# --- Full Mock Test: Reading content, kept entirely separate from the practice pools above
# so a student never sees the same question in both practice mode and the mock test. ---
@app.get("/api/mock/complete-the-words")
def get_mock_ctw_exercises():
    with open(MOCK_CTW_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/read-in-daily-life")
def get_mock_ridl_passages():
    with open(MOCK_RIDL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/academic-passage")
def get_mock_academic_passage():
    with open(MOCK_AP_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Full Mock Test: Listening content, kept entirely separate from the practice pools below
# so a student never sees the same question in both practice mode and the mock test. ---
@app.get("/api/mock/choose-response")
def get_mock_listening_car():
    with open(MOCK_LISTENING_CAR_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/conversation")
def get_mock_listening_conv():
    with open(MOCK_LISTENING_CONV_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/announcement")
def get_mock_listening_announce():
    with open(MOCK_LISTENING_ANNOUNCE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/academic-talk")
def get_mock_listening_at():
    with open(MOCK_LISTENING_AT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Full Mock Test: Writing content, kept entirely separate from the practice pools below ---
@app.get("/api/mock/build-a-sentence")
def get_mock_bas():
    with open(MOCK_BAS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/email")
def get_mock_email():
    with open(MOCK_EMAIL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/mock/academic-discussion")
def get_mock_disc():
    with open(MOCK_DISC_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Full Mock Test: Speaking content, kept entirely separate from the practice pools below ---
@app.get("/api/mock/listen-and-repeat")
def get_mock_speaking_lr():
    with open(MOCK_SPEAKING_LR_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)  # fresh read every request, so JSON edits show up without a restart
    for s in data:
        s["audio_url_intro"] = f"{BACKEND_PUBLIC_URL}/audio/mock_speaking_lr/{s['id']}/intro.mp3"
        for sent in s["sentences"]:
            sent["audio_url"] = f"{BACKEND_PUBLIC_URL}/audio/mock_speaking_lr/{s['id']}/{sent['id']}.mp3"
    return data

@app.get("/api/mock/interview")
def get_mock_speaking_interview():
    with open(MOCK_SPEAKING_INTERVIEW_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)  # fresh read every request, so JSON edits show up without a restart
    for s in data:
        s["audio_url_intro"] = f"{BACKEND_PUBLIC_URL}/audio/mock_speaking_interview/{s['id']}/intro.mp3"
        for q in s["questions"]:
            q["audio_url"] = f"{BACKEND_PUBLIC_URL}/audio/mock_speaking_interview/{s['id']}/{q['id']}.mp3"
    return data

# --- Full Mock Test: fixed (pre-built) tests, served whole as one bundle per test id ---
@app.get("/api/mock/fixed-test/{test_id}")
def get_fixed_test(test_id: int):
    path = FIXED_TEST_FILES.get(test_id)
    if not path:
        raise HTTPException(status_code=404, detail=f"No fixed test with id {test_id}")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)  # fresh read every request, so JSON edits show up without a restart
    # The two Speaking items were saved without audio_url (same as mock_speaking_lr/interview
    # above) since their mp3s live under the ORIGINAL shared pool's id-keyed folders — inject
    # the URLs here exactly like the dynamic-pool endpoints do.
    lr = data["speaking"]["lr"]
    lr["audio_url_intro"] = f"{BACKEND_PUBLIC_URL}/audio/mock_speaking_lr/{lr['id']}/intro.mp3"
    for sent in lr["sentences"]:
        sent["audio_url"] = f"{BACKEND_PUBLIC_URL}/audio/mock_speaking_lr/{lr['id']}/{sent['id']}.mp3"
    interview = data["speaking"]["interview"]
    interview["audio_url_intro"] = f"{BACKEND_PUBLIC_URL}/audio/mock_speaking_interview/{interview['id']}/intro.mp3"
    for q in interview["questions"]:
        q["audio_url"] = f"{BACKEND_PUBLIC_URL}/audio/mock_speaking_interview/{interview['id']}/{q['id']}.mp3"
    return data

# --- Listening ---
@app.get("/api/listening/choose-response")
def get_listening_p1():
    with open(LISTENING_P1_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/listening/conversation")
def get_listening_p2():
    with open(LISTENING_P2_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/listening/announcement")
def get_listening_p3():
    with open(LISTENING_P3_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/api/listening/academic-talk")
def get_listening_p4():
    with open(LISTENING_P4_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Writing: Build a Sentence ---
@app.get("/api/writing/build-a-sentence")
def get_build_a_sentence():
    with open(BUILD_A_SENTENCE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Writing: Email (JSON tabanlı liste, tüm pratikler) ---
@app.get("/api/writing/email")
def get_write_email_list():
    with open(WRITE_EMAIL_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Writing: Academic Discussion ---
@app.get("/api/writing/academic-discussion")
def get_academic_discussion_list():
    with open(WRITE_DISCUSSION_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Speaking: Listen and Repeat ---
@app.get("/api/speaking/listen-and-repeat")
def get_speaking_listen_repeat():
    with open(SPEAKING_LR_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    for s in data:
        s["audio_url_intro"] = f"{BACKEND_PUBLIC_URL}/audio/speaking_lr/{s['id']}/intro.mp3"
        for sent in s["sentences"]:
            sent["audio_url"] = f"{BACKEND_PUBLIC_URL}/audio/speaking_lr/{s['id']}/{sent['id']}.mp3"
    return data

# --- Speaking: Take an Interview ---
@app.get("/api/speaking/interview")
def get_speaking_interview():
    with open(SPEAKING_INTERVIEW_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    for s in data:
        s["audio_url_intro"] = f"{BACKEND_PUBLIC_URL}/audio/speaking_interview/{s['id']}/intro.mp3"
        for q in s["questions"]:
            q["audio_url"] = f"{BACKEND_PUBLIC_URL}/audio/speaking_interview/{s['id']}/{q['id']}.mp3"
    return data

# --- Writing: Email (eski DB tabanlı tekil soru, kullanılmıyor ama korunuyor) ---
@app.get("/api/writing/email/{question_id}")
async def get_email_question(question_id: str):
    conn = get_db()
    conn.row_factory = sqlite3.Row
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
    conn.row_factory = sqlite3.Row
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