from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends, Header, Request, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
import asyncio
import base64
import hashlib
import html as _html
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import collections
import pathlib
import threading
import bcrypt
import jwt
import urllib.request
import urllib.error
import requests as http_requests
import httpx

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
    import psycopg2.pool
except ImportError:
    psycopg2 = None

# The exception class(es) that mean "a UNIQUE constraint was violated" -- used by call sites that
# do a SELECT-then-INSERT for uniqueness (e.g. register/google_login checking for an existing
# email) to turn a race between two concurrent requests for the same email into a clean 409
# instead of an unhandled 500. sqlite3.IntegrityError always exists; psycopg2's only exists when
# the driver is actually installed (see the defensive import above).
_INTEGRITY_ERRORS = (sqlite3.IntegrityError,) + ((psycopg2.IntegrityError,) if psycopg2 else ())

import weakref

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

# Standard defense-in-depth response headers -- none of these were set anywhere before, so every
# response (API JSON, streamed audio, everything) went out with browser defaults. Applied via a
# plain middleware function (not a dedicated package) so there's no new dependency to pin/audit.
@app.middleware("http")
async def _security_headers(request: Request, call_next):
    response = await call_next(request)
    # Stop this API from ever being framed (clickjacking) -- nothing here is meant to be embedded.
    response.headers["X-Frame-Options"] = "DENY"
    # Stop browsers from MIME-sniffing a response into a different content type than declared.
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Don't leak the full referring URL (which can contain auth/reset tokens in query strings) to
    # other origins; same-origin requests still get the full path.
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # This API is never rendered as a document, so a restrictive CSP costs nothing and closes off
    # any future accidental HTML-reflection endpoint from being useful for injection.
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    # Force HTTPS on every subsequent request for a year, including subdomains -- Render always
    # terminates TLS at its edge, so this is safe to send unconditionally in production. Only add
    # it once we can tell we're actually behind that HTTPS edge (RENDER env var), so plain local
    # dev over http://localhost is never redirected/upgraded.
    if os.environ.get("RENDER"):
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ============================================================
# AUTH CONFIG
# ============================================================
# In production (Render, etc.) set JWT_SECRET_KEY as a real environment variable -- this
# fallback is only for local development so the app still works out of the box. If it's ever
# unset on Render itself (misconfiguration, a fresh environment spun up without copying vars,
# an env var accidentally cleared during a redeploy), we must NOT silently fall back to this
# fixed, publicly-visible string: anyone who has read this file could forge a valid JWT for any
# user_id (including an admin's), and this same key also signs every /audio-proxy link. RENDER is
# set automatically by Render's platform on every service, so this only refuses to start in an
# actual production deploy -- local/dev environments (no RENDER var) keep working out of the box.
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    if os.environ.get("RENDER"):
        raise RuntimeError(
            "JWT_SECRET_KEY is not set. Refusing to start in production with an insecure default "
            "secret -- set JWT_SECRET_KEY in the Render environment variables."
        )
    JWT_SECRET_KEY = "dev-only-insecure-secret-change-me"
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

# Shared secret for the daily "you haven't practiced" reminder cron (see
# /api/cron/practice-reminders below). This is deliberately NOT a normal user/admin JWT --
# a scheduler (e.g. a Render Cron Job hitting this endpoint with `curl`) has no logged-in
# session to present, so it authenticates with this one fixed secret via the
# X-Cron-Secret header instead. Leave unset to keep the endpoint disabled (returns 503).
PRACTICE_REMINDER_CRON_SECRET = os.environ.get("PRACTICE_REMINDER_CRON_SECRET", "")

# ============================================================
# PADDLE (abonelik / ödeme) CONFIG
# ============================================================
# Paddle is a Merchant of Record -- unlike iyzico, it does NOT need buyer identity numbers, and it
# handles global VAT/sales-tax compliance itself, which is why this replaced the iyzico integration.
# Four separate credentials, all from the Paddle dashboard (Developer Tools > Authentication):
#   PADDLE_API_KEY               server-side secret, used to call the Paddle API (create a
#                                 transaction, cancel a subscription). NEVER expose to the frontend.
#   PADDLE_WEBHOOK_SECRET         per-notification-destination secret, used to verify that incoming
#                                 /api/subscription/webhook calls really came from Paddle.
#   PADDLE_PRICE_ID               the recurring price (e.g. "pri_...") created under Catalog >
#                                 Products for the premium plan -- reused for every checkout.
#   PADDLE_ENVIRONMENT            "sandbox" while testing with a Paddle Sandbox account, "production"
#                                 once the real (live) Paddle account is approved and in use.
# The frontend also needs its own PUBLIC client-side token (VITE_PADDLE_CLIENT_TOKEN, set at build
# time -- see App.jsx) to open the Paddle.js checkout overlay; that one is not a secret and is not
# read here. All blank-safe: if unset, the subscription endpoints raise a clear 500 instead of
# silently misbehaving, so local dev without Paddle configured doesn't crash the whole app at
# import time.
PADDLE_API_KEY = os.environ.get("PADDLE_API_KEY", "")
PADDLE_WEBHOOK_SECRET = os.environ.get("PADDLE_WEBHOOK_SECRET", "")
PADDLE_PRICE_ID = os.environ.get("PADDLE_PRICE_ID", "")
PADDLE_ENVIRONMENT = os.environ.get("PADDLE_ENVIRONMENT", "sandbox")
PADDLE_API_BASE_URL = (
    "https://sandbox-api.paddle.com" if PADDLE_ENVIRONMENT != "production" else "https://api.paddle.com"
)


def _paddle_request(method: str, path: str, body: dict = None):
    """Low-level authenticated call to the Paddle Billing REST API (used instead of a heavier SDK
    dependency -- mirrors the urllib.request style already used elsewhere in this file for Resend/
    formerly iyzico). `path` is the URL path only (e.g. '/transactions'). Raises HTTPException(502)
    on any transport failure, and returns the parsed JSON body on any HTTP response (including
    error responses, which Paddle returns as JSON too) so Paddle's own error payloads reach the
    caller intact."""
    body_str = json.dumps(body if body is not None else {}, separators=(",", ":"), ensure_ascii=False)
    req = urllib.request.Request(
        PADDLE_API_BASE_URL + path,
        data=body_str.encode("utf-8") if body is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {PADDLE_API_KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
        try:
            return json.loads(raw)
        except ValueError:
            # Found in the 27th audit round: only the error branch below was guarded against a
            # non-JSON body -- a 200 response that somehow isn't valid JSON (a CDN/WAF
            # interstitial in front of Paddle, a truncated response, any transport-level anomaly)
            # used to let json.JSONDecodeError propagate straight out of this function and become
            # an unhandled 500 in create_checkout/cancel_subscription, right when Paddle's own
            # infrastructure is already having problems -- exactly when graceful degradation to a
            # clean "please try again" error matters most.
            raise HTTPException(status_code=502, detail="Paddle returned an unexpected response. Please try again.")
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=502, detail=f"Paddle request failed: HTTP {e.code}")
    except urllib.error.URLError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Paddle: {e}")


def _require_paddle():
    if not PADDLE_API_KEY:
        raise HTTPException(status_code=500, detail="Paddle is not configured yet (PADDLE_API_KEY missing)")
    if not PADDLE_PRICE_ID:
        raise HTTPException(status_code=500, detail="Paddle is not configured yet (PADDLE_PRICE_ID missing)")


# Which subscription_status values count as "has active premium access". Paddle subscription
# statuses (mirrored into our own DB, uppercased for consistency with the rest of this file):
# ACTIVE, TRIALING, PAST_DUE, PAUSED, CANCELED -- only ACTIVE/TRIALING count as paid access.
ACTIVE_SUBSCRIPTION_STATUSES = {"ACTIVE", "TRIALING"}

def has_active_subscription(user) -> bool:
    if is_admin_user(user):
        return True
    if (user["subscription_status"] or "") not in ACTIVE_SUBSCRIPTION_STATUSES:
        return False
    # Defense in depth, not the primary gate: subscription_status only ever changes when a Paddle
    # webhook lands and is successfully processed. If a webhook is ever missed for an extended
    # period (webhook URL misconfigured after an infra change, PADDLE_WEBHOOK_SECRET rotated out
    # of sync between Paddle and here, a dropped cancellation event during a Paddle-side outage),
    # subscription_status can stay ACTIVE/TRIALING indefinitely even though Paddle has stopped
    # billing and access should have lapsed -- there's no periodic reconciliation job elsewhere in
    # this file. As a backstop, also treat access as lapsed once
    # subscription_current_period_end is more than a couple of days in the past (a small grace
    # window, not same-day, since a legitimate renewal can land a little after the exact period
    # boundary). Missing/unparsable is treated as still-active, NOT lapsed -- some rows (comped/
    # admin-granted access, or accounts created before this column existed) may have this unset,
    # and a parsing edge case must never accidentally lock a paying student out.
    period_end = user["subscription_current_period_end"]
    if period_end is None:
        return True
    if isinstance(period_end, str):
        try:
            period_end = datetime.fromisoformat(period_end)
        except ValueError:
            return True
    if period_end.tzinfo is None:
        period_end = period_end.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - period_end) < timedelta(days=2)

# Comma-separated list of email addresses that get admin rights (full premium content access +
# the /api/admin/* management endpoints), e.g. ADMIN_EMAILS=owner@mrreadyprep.com,helper@x.com.
# No separate database column/migration needed -- admin status is just "does this account's email
# match one on the list right now", checked fresh on every request, so granting/revoking an admin
# is just an env var edit + redeploy rather than needing direct DB access. Whitespace around each
# entry is stripped so a stray space after a comma doesn't silently exclude someone.
ADMIN_EMAILS = {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}

def is_admin_user(user) -> bool:
    return bool(user) and (user["email"] or "").strip().lower() in ADMIN_EMAILS

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
        # Fail CLOSED, not open: every non-mock content endpoint routes free-tier gating through
        # this function, so if a pool's top-level JSON shape is ever anything other than a list --
        # a corrupted save, a schema change wrapping items in an object, a partial write during a
        # content update -- returning `data` unchanged here would silently serve the full,
        # ungated pool to every non-subscriber with no error, no log line, nothing. Better to
        # return nothing than to accidentally unlock everything.
        return []
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
# SECURITY: only expose this raw, unauthenticated static mount outside of production. Every
# audio_url this backend hands out is deliberately routed through the signed /audio-proxy below
# instead of a direct link (see the long comment above _audio_url further down: paths are a
# small, guessable pattern, e.g. "speaking_lr/61/1.mp3", so an unsigned route lets anyone
# construct a locked item's path by hand and stream premium audio directly, bypassing every
# pool's paywall). Mounting the same files here too, with zero entitlement check, would quietly
# reopen exactly that hole -- currently harmless only because production serves audio from R2 and
# this local audio/ directory is empty there, but nothing would stop it from becoming a live
# bypass the moment that directory is ever repopulated on the deployed instance (e.g. falling
# back to a persistent disk instead of R2). RENDER is set automatically by Render's platform, so
# this mount stays available for local dev (where it's how AUDIO_BASE_URL's default,
# self-referential value is actually served) while being refused outright in production.
if not os.environ.get("RENDER"):
    app.mount("/audio", StaticFiles(directory="audio"), name="audio")

# Base URL prefix for audio files (used to build every audio_url/audio_url_intro field sent to the
# frontend). Defaults to this backend's own /audio static mount (fine for local dev, and for
# production IF a persistent disk has actually been populated with the audio/ folder). Once audio
# is uploaded to an object storage bucket (Cloudflare R2, S3, etc. -- see AUDIO_DEPLOYMENT.md), set
# this env var to that bucket's public base URL instead, e.g.:
#   AUDIO_BASE_URL=https://pub-xxxxxxxx.r2.dev
# This is used internally (by the /audio-proxy endpoint below) as the real upstream to fetch
# from -- it is NOT sent to the frontend directly anymore. See AUDIO_PROXY_BASE_URL.
AUDIO_BASE_URL = os.environ.get("AUDIO_BASE_URL", f"{BACKEND_PUBLIC_URL}/audio")

# Public-facing base URL actually sent to the frontend in every audio_url/audio_url_intro field.
# Routes every request through THIS backend (/audio-proxy/...) instead of letting the student's
# browser connect straight to the R2 bucket. Some students' networks/ISPs (observed: Istanbul,
# Turkey -- matches a documented period of Cloudflare network issues in IST) fail to establish a
# TLS connection directly to *.r2.dev at all (ERR_SSL_PROTOCOL_ERROR / ERR_CONNECTION_RESET),
# in both Safari and Chrome, on multiple networks -- while the exact same URL works fine from a
# server. Proxying through Render's own server-to-server connection to R2 sidesteps that
# unreliable client-to-R2 path entirely; the browser only ever has to reach our own backend,
# which it already does successfully for every other API call.
AUDIO_PROXY_BASE_URL = f"{BACKEND_PUBLIC_URL}/audio-proxy"

# /audio-proxy/{path} has no auth/entitlement check of its own -- it just streams whatever path
# it's given. That's fine as long as the ONLY way to learn a valid path is to already have been
# sent it in a gated API response (gate_pool/require_premium_pool/the fixed-test premium check all
# withhold audio_url fields from non-subscribers). But every path is a small, guessable pattern
# (e.g. "speaking_lr/7/intro.mp3", ids 1-100) -- without this, a free user who simply constructs a
# locked item's path by hand could stream premium audio directly, bypassing the paywall entirely
# even though the frontend never showed them that URL. So every audio_url this backend hands out is
# signed with a short-lived HMAC token tied to that exact path, and the proxy rejects any request
# whose token doesn't verify -- closing that guessing/enumeration gap without needing to duplicate
# each pool's gating logic inside the proxy itself.
AUDIO_URL_TTL_SECONDS = 60 * 60 * 24 * 14  # 14 days: long enough that a slow connection or a
# student resuming a saved draft days later never hits an expired link, short enough to bound how
# long a leaked/shared URL keeps working.

def _sign_audio_path(path: str, exp: int) -> str:
    msg = f"{path}:{exp}".encode()
    return hmac.new(JWT_SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:32]

def _audio_url(path: str) -> str:
    """Builds a signed /audio-proxy URL for `path` (e.g. "speaking_lr/7/intro.mp3"). This is the
    ONLY place that should construct an audio_url/audio_url_intro value -- every call site below
    goes through this instead of f-stringing AUDIO_PROXY_BASE_URL directly, so signing can't be
    accidentally skipped for a new pool added later."""
    exp = int(time.time()) + AUDIO_URL_TTL_SECONDS
    sig = _sign_audio_path(path, exp)
    return f"{AUDIO_PROXY_BASE_URL}/{path}?t={exp}.{sig}"

def _verify_audio_token(path: str, token: str) -> bool:
    if not token or "." not in token:
        return False
    exp_str, _, sig = token.partition(".")
    try:
        exp = int(exp_str)
    except ValueError:
        return False
    if exp < int(time.time()):
        return False
    return hmac.compare_digest(_sign_audio_path(path, exp), sig)

# Fetches an audio file server-to-server from the real upstream (AUDIO_BASE_URL, e.g. R2) and
# serves it back to the browser, instead of the browser connecting to that upstream directly (see
# AUDIO_PROXY_BASE_URL above for why). Range requests are honored so seeking/progressive playback
# in <audio> elements keeps working exactly as it did with a direct R2 URL (206 Partial Content,
# Content-Range, Accept-Ranges) -- but by slicing bytes we already hold, not by relaying a live
# upstream stream (see below for why that distinction matters).
#
# IMPORTANT: this must stay a genuinely `async def` route using an async HTTP client (httpx), not
# a sync `def` using `requests`. Root-caused incident (2026-09-01): <audio> elements routinely
# open-then-abort/abandon connections while probing Range support, which is completely normal
# browser media-loading behavior. A sync `requests`-based version left the worker thread blocked
# forever inside `upstream.iter_content()` on an abandoned connection, eventually exhausting
# FastAPI's whole thread pool so EVERY request -- even a brand new, valid one -- queued forever.
# Staying async plus a bounded httpx timeout (below) means a stalled/abandoned request can only
# ever pin one coroutine for at most `_AUDIO_PROXY_TIMEOUT`, and the ASGI server can actually
# cancel it on disconnect (unlike a thread, which can't be force-killed).
#
# Second incident, same endpoint (2026-09-01, later same day): the *first* fix above made audio
# load reliably, but playback still stuttered -- a very brief, silent pause mid-clip while the
# avatar was still "talking". Root cause: that version relayed bytes live, chunk by chunk, as they
# arrived from R2 (`StreamingResponse` over `upstream.aiter_bytes()`). That makes the browser's
# playback buffer only ever as far ahead as Render's *current* connection to R2 -- so any brief
# latency blip between Render and R2 (normal network jitter, nothing wrong on either end) starved
# the client's buffer in real time and the <audio> element paused for that instant, exactly like a
# live radio stream cutting out. Fixed by decoupling the two legs entirely: fetch the *complete*
# file from R2 into memory first (cached after that -- see _audio_cache below), THEN hand the
# browser a plain, fully-buffered response. Worst case this adds a small one-time delay before
# playback starts (bounded by _AUDIO_PROXY_TIMEOUT); it can never stutter mid-playback again,
# because by the time the browser has any bytes at all, every byte of the file is already sitting
# in RAM on our side with no further network dependency.
_AUDIO_PROXY_TIMEOUT = httpx.Timeout(connect=10.0, read=20.0, write=10.0, pool=10.0)

# In-memory cache of fully-fetched audio files, keyed by the R2 object path (not the signed
# URL/token, so a freshly re-signed link for the same file still hits the cache). Every practice
# item's audio gets re-requested often -- Retry, mock-test re-attempts, the same Listening intro
# narration line reused across many exercises -- so caching turns almost every repeat play into an
# instant in-memory response with zero R2 round-trip, on top of fixing the stutter above. Bounded
# by total bytes with simple LRU eviction (OrderedDict) so a long-running instance can't grow this
# unbounded; 100MB comfortably holds hundreds of these clips (typically well under 1MB each) while
# staying small next to what even a modest Render instance has available.
_audio_cache: "collections.OrderedDict[str, tuple]" = collections.OrderedDict()
_audio_cache_lock = threading.Lock()
_audio_cache_bytes = 0
_AUDIO_CACHE_MAX_BYTES = 100 * 1024 * 1024
# Unlike _pool_cache (which re-signs expiring URLs and so MUST rebuild on a schedule), the audio
# bytes cached here have no expiry of their own -- but without any staleness check at all, if the
# file at an R2 path is ever replaced (re-recorded narration, a content fix) without also
# redeploying the backend, this process would keep serving the old bytes from RAM forever, until
# LRU pressure happens to evict that one path. A day is long enough that the cache still does its
# job (repeat plays/retries/mock-test re-attempts within the same sitting all still hit it) while
# bounding how long a stale re-upload could linger.
_AUDIO_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60

def _audio_cache_get(path: str):
    global _audio_cache_bytes
    with _audio_cache_lock:
        entry = _audio_cache.get(path)
        if entry is None:
            return None
        body, content_type, cached_at = entry
        if (time.time() - cached_at) > _AUDIO_CACHE_MAX_AGE_SECONDS:
            del _audio_cache[path]
            _audio_cache_bytes -= len(body)
            return None
        _audio_cache.move_to_end(path)
        return body, content_type

def _audio_cache_put(path: str, body: bytes, content_type: str):
    global _audio_cache_bytes
    with _audio_cache_lock:
        if path in _audio_cache:
            return  # a concurrent request for the same file already won the race and cached it
        _audio_cache[path] = (body, content_type, time.time())
        _audio_cache_bytes += len(body)
        while _audio_cache_bytes > _AUDIO_CACHE_MAX_BYTES and _audio_cache:
            _, (evicted_body, _, _) = _audio_cache.popitem(last=False)
            _audio_cache_bytes -= len(evicted_body)

_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")

@app.get("/audio-proxy/{path:path}")
async def audio_proxy(path: str, request: Request, t: str = ""):
    if not _verify_audio_token(path, t):
        raise HTTPException(status_code=403, detail="Invalid or expired audio link")

    cached = _audio_cache_get(path)
    if cached is not None:
        body, content_type = cached
    else:
        upstream_url = f"{AUDIO_BASE_URL}/{path}"
        try:
            async with httpx.AsyncClient(timeout=_AUDIO_PROXY_TIMEOUT) as client:
                upstream = await client.get(upstream_url)
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Audio upstream unreachable")
        if upstream.status_code != 200:
            code = 404 if upstream.status_code == 404 else 502
            raise HTTPException(status_code=code, detail="Audio not available")
        body = upstream.content
        content_type = upstream.headers.get("Content-Type") or "audio/mpeg"
        _audio_cache_put(path, body, content_type)

    total_len = len(body)
    resp_headers = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=86400"}

    range_header = request.headers.get("range")
    if range_header:
        m = _RANGE_RE.match(range_header)
        if m:
            start_s, end_s = m.groups()
            if start_s == "" and end_s != "":
                # Suffix range ("bytes=-500" means "the last 500 bytes"), distinct from "bytes=0-500".
                start = max(0, total_len - int(end_s))
                end = total_len - 1
            else:
                start = int(start_s) if start_s else 0
                end = int(end_s) if end_s else total_len - 1
                end = min(end, total_len - 1)
            if 0 <= start <= end < total_len:
                chunk = body[start:end + 1]
                resp_headers["Content-Range"] = f"bytes {start}-{end}/{total_len}"
                return Response(content=chunk, status_code=206, headers=resp_headers, media_type=content_type)

    return Response(content=body, status_code=200, headers=resp_headers, media_type=content_type)

# Fixed spoken-instruction narration lines ("Listen to a conversation.", "Listen to a talk in a
# biology class.", etc.) that the 4 Listening exercise types play before the real
# conversation/announcement/talk audio. Unlike every other audio_url the backend hands out, these
# were never signed at all: the frontend used to build "${AUDIO_PROXY_BASE_URL}/intro/<file>.mp3"
# directly, a plain unsigned URL -- which /audio-proxy above has ALWAYS rejected with 403 "Invalid
# or expired audio link" ever since signed audio links were introduced (see _audio_url's docstring:
# it's meant to be the ONLY place a URL under /audio-proxy gets constructed, and this call site
# was quietly missed). The 403 response body (JSON, not audio) is what the browser's <audio>
# element reports as a generic "Format error" / NotSupportedError -- which is why this looked like
# an autoplay problem at first glance instead of the broken-link issue it actually is: the
# narration never had a working URL to play in the first place, on any browser, for any student.
_SAFE_INTRO_FILENAME = re.compile(r"^[A-Za-z0-9_\-]+\.mp3$")

class IntroAudioUrlsRequest(BaseModel):
    # Deliberately unauthenticated (see docstring below), so unlike every other write-model in this
    # file these bounds are the ONLY thing standing between an anonymous client and forcing this
    # process to buffer/parse an arbitrarily large JSON array before the `[:300]` slice below ever
    # runs -- a straightforward memory-exhaustion DoS otherwise. 300 matches the slice already
    # applied in the handler; 200 chars is generous for a "name.mp3" filename that must also match
    # _SAFE_INTRO_FILENAME below (real values are a few dozen chars at most).
    filenames: List[str] = Field(max_length=300)

    @field_validator("filenames")
    @classmethod
    def _bound_filename_length(cls, v):
        for f in v:
            if len(f) > 200:
                raise ValueError("filename too long")
        return v

# Hardware-check narration (backend/generate_audio_hwcheck.py) lives in its own audio/hwcheck/
# folder, not audio/intro/ -- found via round-23 audit: the "Adjusting the Volume" and "Adjusting
# the Microphone" screens were building their src as a raw, unsigned AUDIO_PROXY_BASE_URL string
# (no ?t= token at all), which /audio-proxy has ALWAYS rejected with 403 "Invalid or expired audio
# link" for every single request, on every browser, for every student -- these two screens have
# never actually played their narration in production. Named explicitly (not a second wildcard
# regex) since there are exactly two of these and it keeps this endpoint's blast radius obvious.
_HWCHECK_FILENAMES = {"adjusting_volume.mp3", "adjusting_microphone.mp3"}

@app.post("/api/audio/intro-urls")
def get_intro_audio_urls(data: IntroAudioUrlsRequest, request: Request):
    """Signs a batch of fixed narration filenames for /audio-proxy in one round trip (the frontend
    calls this once when a Listening list screen mounts, well before the student can click "Start",
    so the signed URL is already sitting in a client-side cache by the time primeAudio() needs to
    play it synchronously from that click -- an async fetch happening AT click time would lose the
    gesture-backed autoplay permission Safari requires, same reasoning as primeAudio() itself).
    Deliberately unauthenticated and NOT entitlement-gated, unlike every other _audio_url() call
    site: these narration lines are generic instructional audio reused identically across every
    item in a pool, free or locked, and carry none of the actual gated exercise content -- there's
    nothing here worth restricting access to. Restricted to the intro/ and hwcheck/ namespaces via
    the filename allowlist regex (no slashes, no "..") plus the explicit _HWCHECK_FILENAMES set, so
    this endpoint can never be used to sign a real gated path like "speaking_lr/7/1.mp3" and bypass
    the entitlement checks that protect those."""
    _check_and_consume_rate_limit(
        _intro_audio_attempts, _client_ip(request),
        INTRO_AUDIO_ATTEMPT_WINDOW_SECONDS, INTRO_AUDIO_ATTEMPT_MAX, "audio URL signing",
    )
    result = {}
    for filename in data.filenames[:300]:
        if _SAFE_INTRO_FILENAME.match(filename):
            folder = "hwcheck" if filename in _HWCHECK_FILENAMES else "intro"
            result[filename] = _audio_url(f"{folder}/{filename}")
    return result

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
                return _audio_url(obj[len(prefix):])
        return obj
    if isinstance(obj, list):
        return [_fix_audio_urls(v) for v in obj]
    if isinstance(obj, dict):
        return {k: _fix_audio_urls(v) for k, v in obj.items()}
    return obj

# ------------------------------------------------------------------------------------------------
# In-memory pool cache -- every pool/practice/mock-test JSON file used to be re-opened, re-parsed,
# and (where applicable) re-transformed (_fix_audio_urls, audio_url injection) on EVERY single
# request. These files never change at runtime (editing one requires a code/data change + redeploy
# either way), so that work was pure waste -- and under concurrent load it was the dominant cost:
# a local load test showed p95 latency on a single pool endpoint growing from ~0.21s at 100
# concurrent requests to ~3.0s at 400 (Python's GIL serializes that CPU-bound parse/serialize work
# across every in-flight request on a single worker). Caching the already-parsed result removes
# that cost entirely after the first request.
#
# IMPORTANT: the object returned by _cached_pool is the SAME object on every call after the first
# -- callers must never mutate it in place. gate_pool/_lock_item/_fix_audio_urls only ever read
# from or build brand-new dicts, never mutate their input, so this is safe as-is; any new caller
# added later must follow the same rule (build a new dict/list instead of assigning into the
# cached one).
_pool_cache: dict = {}
# Timestamp (time.time()) each cache_key was last (re)built. Needed because several builders bake
# a signed, TTL-expiring audio URL (_audio_url, AUDIO_URL_TTL_SECONDS above) into the cached JSON
# at build time. Without tracking cache age, a pool built once and never invalidated would start
# serving audio URLs with already-expired HMAC signatures after AUDIO_URL_TTL_SECONDS of process
# uptime -- audio_proxy would then 403 every request for that pool, for every student, simultaneously,
# with no code change or deploy to explain it, until the process happens to restart. See
# _POOL_CACHE_MAX_AGE_SECONDS below for the fix.
_pool_cache_times: dict = {}
# Guards the check-then-set below: without it, concurrent first-requests for the same not-yet-
# cached pool could all see cache_key missing and each run the (redundant, if harmless) builder.
# All the builders are pure/idempotent so this was never a correctness bug, just wasted CPU on a
# cold-cache burst -- the lock just makes that burst deterministic (one builder call, not N).
_pool_cache_lock = threading.Lock()
# Force a cache rebuild (which re-signs any embedded audio URLs with a fresh expiry) a full day
# before the previous build's signatures would actually expire, so a long-running process never
# serves an already-expired signed URL. Rebuild cost equals the original cold-cache cost and now
# happens roughly every 13 days per pool instead of never -- negligible next to the outage this
# prevents.
_POOL_CACHE_MAX_AGE_SECONDS = AUDIO_URL_TTL_SECONDS - 60 * 60 * 24

def _load_json_pool(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _cached_pool(cache_key, builder):
    def _is_stale():
        cached_at = _pool_cache_times.get(cache_key)
        return cached_at is not None and (time.time() - cached_at) > _POOL_CACHE_MAX_AGE_SECONDS

    if cache_key not in _pool_cache or _is_stale():
        with _pool_cache_lock:
            if cache_key not in _pool_cache or _is_stale():  # re-check: another thread may have won the race
                _pool_cache[cache_key] = builder()
                _pool_cache_times[cache_key] = time.time()
    return _pool_cache[cache_key]

# ============================================================
# VERİ MODELLERİ
# ============================================================

class DashboardData(BaseModel):
    # RegisterRequest.username is already bounded to max_length=50; this is the equivalent field
    # on the existing-account profile-update path (/api/profile/update). update_profile() does
    # check len(username) > 50, but only after Pydantic has already parsed and copied an
    # arbitrarily large string into memory first -- the exact gap already closed for
    # AttemptResult.category. Bounding it here at the model closes it for real.
    username: str = Field(max_length=50)
    # Matches the frontend's own <input min="0" max="6"> for the overall target-score field.
    # The frontend already clamps its four per-section targets (see clampTarget() in App.jsx,
    # added after round 12's audit found the Dashboard's inline edit panel could bypass its own
    # min/max), but that's a client-side convenience only -- a direct API call bypasses it
    # entirely. Enforcing the same 1.0-6.0 band bound here (0.0-6.0 for the overall target,
    # matching the frontend's own allowed range) keeps stored values within the range every other
    # part of this app (band math, progress bars, SECTION_BAND_MAX comparisons) assumes.
    target_score: float = Field(ge=0.0, le=6.0)
    # Per-section goals the student sets for themselves on the Dashboard -- all four sections use
    # the same unified 1.0-6.0 scale (TOEFL 2026 format; see SECTION_BAND_MAX). Optional so older
    # frontend builds that don't send them yet don't break profile saves.
    reading_target: Optional[float] = Field(default=None, ge=1.0, le=6.0)
    listening_target: Optional[float] = Field(default=None, ge=1.0, le=6.0)
    writing_target: Optional[float] = Field(default=None, ge=1.0, le=6.0)
    speaking_target: Optional[float] = Field(default=None, ge=1.0, le=6.0)

# ============================================================
# AUTH VERİ MODELLERİ
# ============================================================

class RegisterRequest(BaseModel):
    email: EmailStr
    # Matches the cap update_profile() already enforces for username changes -- registration had
    # no bound at all before, so a signup could create an arbitrarily long username.
    username: str = Field(max_length=50)
    # No hard byte-length rejection here (a password manager's 100-char passphrase should still
    # work -- see _bcrypt_safe_bytes truncation) -- just a sanity ceiling against pathological
    # payloads.
    password: str = Field(max_length=256)

class LoginRequest(BaseModel):
    email: EmailStr
    # Matches RegisterRequest.password's cap -- this goes through the same _bcrypt_safe_bytes
    # path, so an unbounded value isn't a crash risk, but it was still fully parsed by Pydantic
    # before the rate limiter even runs. Kept consistent with the rest of this file's pattern of
    # bounding every string field.
    password: str = Field(max_length=256)

class GoogleLoginRequest(BaseModel):
    # Real Google ID tokens are a few KB at most; this is just a defensive ceiling, not a
    # functional constraint -- google_login() fully verifies the token's signature regardless.
    id_token: str = Field(max_length=4096)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    # secrets.token_urlsafe(32) tokens are well under 64 chars; generous ceiling for defense in
    # depth, not a functional constraint (an unmatched token is just rejected by the WHERE lookup).
    token: str = Field(max_length=128)
    new_password: str = Field(max_length=256)

class VerifyEmailRequest(BaseModel):
    token: str = Field(max_length=128)

class ExamDateUpdate(BaseModel):
    # Nothing parses this as a date today (confirmed: no fromisoformat/strptime call on it
    # anywhere), so a garbage value can't crash *this* request -- but it's echoed back verbatim
    # in /api/auth/me and /api/dashboard on every request, and any future "days until exam"
    # feature that does parse it would crash on unvalidated input with no defense in depth. Every
    # other user-writable field with a defined shape already gets this treatment.
    exam_date: str = Field(max_length=10, pattern=r"^\d{4}-\d{2}-\d{2}$|^$")  # ISO yyyy-mm-dd, or "" to clear

    @field_validator("exam_date")
    @classmethod
    def _valid_calendar_date(cls, v):
        # The regex above only checks digit *shape* -- "2026-13-99" or "2026-02-30" matches it fine
        # but isn't a real date. Reject anything the calendar itself wouldn't accept, so a garbage-
        # but-shaped value (e.g. sent via a direct API call bypassing the frontend's
        # <input type="date">, which itself can't produce an invalid date) never gets saved and
        # echoed back to the student as their exam date.
        if v:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise ValueError("exam_date must be a real calendar date")
        return v

class RIDLResult(BaseModel):
    # Bounded for the same reason score/total are below: ridl_results.passage_id is a Postgres
    # INTEGER NOT NULL column, and an out-of-range value (e.g. 99999999999) passes an unbounded
    # `int` field with no problem, then hits "integer out of range" -- an uncaught DataError, not
    # one of the handled _INTEGRITY_ERRORS -- crashing the request with a 500 in production.
    passage_id: int = Field(ge=0, le=100000)
    # Bounded (not just "> 0") so a buggy/forged client can't write a score that inflates the
    # student's own Read in Daily Life stats -- see the matching check in save_ridl_result() for
    # the score-can't-exceed-total rule (can't express that as a Field constraint since it's a
    # relationship between two fields, not a single field's range). le=1000 matches AttemptResult's
    # bound and is required, not optional: ridl_results.score/total are Postgres INTEGER columns,
    # and a value like 99999999999 (still non-negative, still <= a matching total) passes past this
    # model with no upper bound and then hits "integer out of range" -- an uncaught DataError, not
    # one of the handled _INTEGRITY_ERRORS -- crashing that request with a 500.
    score: int = Field(ge=0, le=1000)
    total: int = Field(ge=0, le=1000)

# Generic "a student finished some exercise, here's the score" record. Used across every
# exercise type (practice pools AND mock tests) so the student's overall progress can be
# reconstructed from a single table instead of needing per-category storage everywhere.
class AttemptResult(BaseModel):
    # Bounded for consistency with item_id/label right below -- save_attempt_result() already
    # rejects unknown categories via an allowlist, but only after Pydantic has fully parsed the
    # string, so an oversized value was still copied into memory for no reason before that check.
    category: str = Field(max_length=50)   # e.g. 'ctw', 'ridl', 'ap', 'listening_p1'..'p4', 'bas', 'email', 'disc',
                         # 'speaking_lr', 'speaking_interview', 'mock_reading', 'mock_listening',
                         # 'mock_writing', 'mock_speaking', 'mock_overall'
    item_id: str = Field(max_length=100)         # exercise/passage/test id (as string) the attempt belongs to
    label: str = Field("", max_length=200)      # human-readable label shown in the progress UI, e.g. "Mock Test 3 · Reading"
    # Bounded so a forged/buggy request can't permanently inflate compute_section_band()'s SUM(score)/
    # SUM(total) for this student (there's no undo short of DB surgery once a bad row lands). The
    # category-allowlist and score<=total checks live in save_attempt_result() itself, since
    # CATEGORY_LABELS is defined further down the file and score-vs-total is a cross-field rule.
    # Upper bound is a generous sanity ceiling, not a real business rule (no real exercise scores
    # anywhere near this high) -- it only exists to stop a forged request setting e.g. total=1,
    # score=1000000 to permanently inflate this student's own dashboard band score.
    score: float = Field(ge=0, le=1000)
    total: float = Field(ge=0, le=1000)
    detail: str = Field("", max_length=20000)     # optional freeform text of what the student actually wrote/answered
                          # (e.g. the Write an Email / Academic Discussion response body), so it
                          # can be recalled later instead of only the numeric score surviving

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

# Connection pool -- every request used to open a brand new TCP+TLS+auth connection to Postgres
# and throw it away at the end (get_db() called psycopg2.connect() directly). Under concurrent
# load that per-request connection overhead adds up fast, and worse, each new connection eats one
# slot against Postgres's max_connections limit (Render's smaller plans commonly cap this in the
# 20-90 range) -- with enough simultaneous students this could start throwing "too many
# connections" errors. A small pool of already-open connections is reused across requests instead.
#
# DB_POOL_MAX_CONN defaults to a conservative 10 -- if you're on a Postgres plan with a higher
# connection limit and see PoolError ("connection pool exhausted") in the logs under real traffic,
# raise this (but stay comfortably under whatever your actual Postgres plan allows, since other
# things like Render's own health checks also use a connection).
_pg_pool = None
if DATABASE_URL and psycopg2 is not None:
    _pg_pool = psycopg2.pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=int(os.environ.get("DB_POOL_MAX_CONN", "10")),
        dsn=DATABASE_URL,
        # Every "TIMESTAMP" column in this schema (created_at, saved_at, ...) is a plain
        # `timestamp without time zone`, populated via CURRENT_TIMESTAMP. On Postgres,
        # CURRENT_TIMESTAMP is evaluated as a true instant (timestamptz) and then converted into
        # the SESSION's timezone before being stored -- not just string-truncated. Every reader in
        # this file (streak calculation, practice-reminder cutoffs, admin "signups this week")
        # assumes those stored values are plain UTC wall-clock. Without pinning the session
        # timezone here, that assumption silently depends on whatever the Postgres server/provider
        # happens to default to -- which can differ across hosts, restores, or a provider config
        # change, silently skewing every one of those UTC-assuming comparisons by the offset.
        options="-c timezone=UTC",
    )


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
    of the ~40 call sites needing to know which database engine is actually in use.

    Also owns returning the underlying connection to the pool (see _pg_pool above) instead of
    actually closing it. Every call site in this file follows a manual `conn = get_db()` ...
    `conn.close()` convention rather than try/finally, so an unexpected exception raised in
    between (a DB error, a bad dict access, anything not explicitly anticipated) would normally
    skip the close() call and leak that connection out of the fixed-size pool forever. The
    weakref.finalize below is a safety net for exactly that case: once Python's garbage collector
    reclaims this wrapper (which happens promptly once the local `conn` variable holding it goes
    out of scope, including during exception unwinding), the finalizer still returns the raw
    connection to the pool. If close() already ran normally, the finalizer is detached first so
    the connection isn't returned twice."""
    def __init__(self, conn, pool=None):
        self._conn = conn
        self._pool = pool
        self._finalizer = weakref.finalize(self, _PGConnection._return_to_pool, conn, pool) if pool is not None else None

    @staticmethod
    def _return_to_pool(conn, pool):
        try:
            conn.rollback()  # defensive: never hand back a connection mid-transaction
        except Exception:
            pass
        try:
            pool.putconn(conn)
        except Exception:
            pass

    def execute(self, query, params=()):
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(_pg_translate(query), tuple(params))
        return cur

    def cursor(self):
        return _PGCursor(self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))

    def commit(self):
        self._conn.commit()

    def close(self):
        if self._pool is not None:
            if self._finalizer is not None:
                self._finalizer.detach()
            _PGConnection._return_to_pool(self._conn, self._pool)
        else:
            self._conn.close()


def get_db():
    if DATABASE_URL:
        if psycopg2 is None:
            raise RuntimeError(
                "DATABASE_URL is set but psycopg2 isn't installed -- run "
                "'pip install -r requirements.txt' to pick up the new dependency."
            )
        try:
            conn = _pg_pool.getconn()
        except psycopg2.pool.PoolError:
            # Pool exhausted (DB_POOL_MAX_CONN concurrent requests already in flight) -- fail this
            # one request fast with a clear error instead of hanging or crashing unpredictably.
            raise HTTPException(status_code=503, detail="Server is busy, please try again in a moment.")
        except psycopg2.Error:
            # Found in the 27th audit round: PoolError only covers "pool is full" -- it does NOT
            # cover Postgres itself being transiently unreachable (a Render-side restart, a
            # maintenance window, a network blip), which getconn() surfaces as e.g.
            # OperationalError instead. Since virtually every endpoint in this file starts with
            # `conn = get_db()` with no surrounding try/except of its own, an uncaught driver
            # exception here used to become an opaque, unhandled 500 across the ENTIRE app on any
            # transient DB hiccup, instead of the same clean "server is busy" 503 the line above
            # was clearly meant to cover for every connection failure, not just pool exhaustion.
            raise HTTPException(status_code=503, detail="Server is busy, please try again in a moment.")
        return _PGConnection(conn, pool=_pg_pool)
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
            reading_target REAL NOT NULL DEFAULT 6.0,
            listening_target REAL NOT NULL DEFAULT 6.0,
            writing_target REAL NOT NULL DEFAULT 6.0,
            speaking_target REAL NOT NULL DEFAULT 6.0,
            exam_date TEXT NOT NULL DEFAULT '',
            current_streak INTEGER NOT NULL DEFAULT 0,
            reading_score REAL NOT NULL DEFAULT 1.0,
            listening_score REAL NOT NULL DEFAULT 1.0,
            writing_score REAL NOT NULL DEFAULT 1.0,
            speaking_score REAL NOT NULL DEFAULT 1.0,
            vocab_level INTEGER NOT NULL DEFAULT 1,
            token_version INTEGER NOT NULL DEFAULT 0,
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
        conn.execute("ALTER TABLE users ADD COLUMN reading_target REAL NOT NULL DEFAULT 6.0")
    if not _has_column(conn, "users", "listening_target"):
        conn.execute("ALTER TABLE users ADD COLUMN listening_target REAL NOT NULL DEFAULT 6.0")
    if not _has_column(conn, "users", "writing_target"):
        conn.execute("ALTER TABLE users ADD COLUMN writing_target REAL NOT NULL DEFAULT 6.0")
    if not _has_column(conn, "users", "speaking_target"):
        conn.execute("ALTER TABLE users ADD COLUMN speaking_target REAL NOT NULL DEFAULT 6.0")
    # Paddle abonelik alanları -- subscription_status 'ACTIVE'/'TRIALING' olan kullanıcılar premium
    # içeriğe tam erişime sahip olur (bkz. has_active_subscription()). Diğer her şey (None,
    # 'CANCELED', 'PAST_DUE', 'PAUSED' vb.) erişimsiz sayılır. iyzico_* kolonları eski entegrasyondan
    # kalma, artık hiçbir kod yolu tarafından okunmuyor/yazılmıyor -- gerçek/canlı iyzico müşterisi
    # hiç olmadığı için (bkz. görev #145) veri kaybı riski yok, kolonlar sadece dokunulmadan duruyor.
    if not _has_column(conn, "users", "iyzico_customer_reference_code"):
        conn.execute("ALTER TABLE users ADD COLUMN iyzico_customer_reference_code TEXT")
    if not _has_column(conn, "users", "iyzico_subscription_reference_code"):
        conn.execute("ALTER TABLE users ADD COLUMN iyzico_subscription_reference_code TEXT")
    if not _has_column(conn, "users", "paddle_customer_id"):
        conn.execute("ALTER TABLE users ADD COLUMN paddle_customer_id TEXT")
    if not _has_column(conn, "users", "paddle_subscription_id"):
        conn.execute("ALTER TABLE users ADD COLUMN paddle_subscription_id TEXT")
    if not _has_column(conn, "users", "subscription_status"):
        conn.execute("ALTER TABLE users ADD COLUMN subscription_status TEXT")
    if not _has_column(conn, "users", "subscription_current_period_end"):
        conn.execute("ALTER TABLE users ADD COLUMN subscription_current_period_end TIMESTAMP")
    # Tracks the last time this student was sent a "you haven't practiced" nudge email (see
    # /api/cron/practice-reminders) so a daily cron run never double-sends within the same
    # ~24h window even if it's triggered more than once.
    if not _has_column(conn, "users", "last_reminder_sent_at"):
        conn.execute("ALTER TABLE users ADD COLUMN last_reminder_sent_at TIMESTAMP")
    # Embedded in every JWT this backend issues (see create_access_token) and re-checked on every
    # authenticated request (see get_current_user). Bumped by reset_password() so a JWT issued
    # before a password reset -- e.g. one stolen via a compromised device, or a leaked token --
    # stops working the moment the legitimate owner resets their password specifically to lock an
    # attacker out, instead of silently remaining valid for the rest of its normal 30-day life.
    if not _has_column(conn, "users", "token_version"):
        conn.execute("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0")
    # reset_password()/verify_email() both look a token up by scanning these columns -- cheap today
    # at low user counts, but with no index they'd become full table scans as the user base grows.
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token)")

    # Which vocab words each student has personally marked as learned.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS vocab_learned (
            user_id INTEGER NOT NULL,
            word_id INTEGER NOT NULL,
            PRIMARY KEY (user_id, word_id)
        )
    """)

    # Personal "save for later" list -- separate from `vocab_learned`. A student can star a word
    # they want to revisit regardless of whether they've marked it as learned yet.
    conn.execute("""
        CREATE TABLE IF NOT EXISTS vocab_starred (
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
    if not _has_column(conn, "attempt_results", "detail"):
        conn.execute("ALTER TABLE attempt_results ADD COLUMN detail TEXT DEFAULT ''")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attempt_results_category ON attempt_results(category)")
    # One-time backfill: reading/listening/writing/speaking_score used to default to 5.0/4.5/4.5/4.0
    # at signup (an "average-looking" placeholder), which contradicted compute_section_band()'s own
    # documented contract of returning 1.0 for a section with zero attempts. Every existing account
    # that has visited /api/dashboard at least once already has correct, freshly-computed values in
    # these columns regardless of this old default, so it's safe to only touch accounts with zero
    # attempt_results rows at all (i.e. definitely never opened the Dashboard tab) -- those are the
    # only rows that could still be showing the stale, artificially-inflated placeholder. Idempotent:
    # once backfilled to 1.0 the WHERE clause no longer matches, so this is a no-op on every
    # subsequent server start.
    conn.execute("""
        UPDATE users SET reading_score = 1.0, listening_score = 1.0, writing_score = 1.0, speaking_score = 1.0
        WHERE id NOT IN (SELECT DISTINCT user_id FROM attempt_results)
          AND (reading_score = 5.0 OR listening_score = 4.5 OR writing_score = 4.5 OR speaking_score = 4.0)
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attempt_results_user ON attempt_results(user_id)")
    # Every real query against this table filters on user_id AND category together (or user_id
    # alone ordered by saved_at) -- _fetch_category_sums's GROUP BY, get_results_history, and
    # get_mistakes's subquery all do this -- so the two single-column indexes above are
    # considerably less effective than one composite index covering the actual access pattern.
    # Found in the 25th audit round; added alongside the existing ones rather than replacing them
    # since save_attempt_result's plain INSERT and any category-only lookups still benefit from
    # the single-column ones.
    conn.execute("CREATE INDEX IF NOT EXISTS idx_attempt_results_user_category ON attempt_results(user_id, category, saved_at)")

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
    try:
        rows = conn.execute("SELECT key, value FROM profile_settings").fetchall()
        return {row["key"]: row["value"] for row in rows}
    finally:
        conn.close()

def migrate_legacy_data_to_user(user_id: int):
    """One-time bootstrap: the very first account ever created on this server inherits any
    attempt_results/ridl_results rows that were recorded before per-user accounts existed
    (user_id = 0), so pre-launch testing progress isn't silently orphaned."""
    conn = get_db()
    try:
        conn.execute("UPDATE attempt_results SET user_id = ? WHERE user_id = 0", (user_id,))
        conn.execute("UPDATE ridl_results SET user_id = ? WHERE user_id = 0", (user_id,))
        conn.commit()
    finally:
        conn.close()

# ============================================================
# AUTH: password hashing, JWT issuing/verification, current-user dependency
# ============================================================

def _bcrypt_safe_bytes(password: str) -> bytes:
    """bcrypt only looks at the first 72 BYTES of a password and raises ValueError outright on
    anything longer -- a real-world case, not a theoretical one, since password managers commonly
    generate 64-128 CHARACTER passwords that can exceed 72 bytes once UTF-8 encoded (even easier
    with any non-ASCII character in the mix). Without this, register/login/reset-password would
    500 for those users instead of just working. Truncate at a UTF-8 character boundary (never
    split a multi-byte character in half, which would corrupt the byte sequence) rather than a
    raw byte slice."""
    encoded = password.encode("utf-8")
    if len(encoded) <= 72:
        return encoded
    truncated = encoded[:72]
    # Back off until we're not mid-character (UTF-8 continuation bytes are 0b10xxxxxx).
    while truncated and (truncated[-1] & 0xC0) == 0x80:
        truncated = truncated[:-1]
    return truncated

def hash_password(password: str) -> str:
    return bcrypt.hashpw(_bcrypt_safe_bytes(password), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    return bcrypt.checkpw(_bcrypt_safe_bytes(password), password_hash.encode("utf-8"))

# Used by login() below to keep its response time constant regardless of whether the email exists
# or has a password set. bcrypt.checkpw() (~100-300ms at this cost factor) only used to run when a
# real password_hash was found -- an unregistered email or a Google-only account (password_hash is
# NULL) returned in a few ms instead, via Python's `or` short-circuiting past verify_password
# entirely. That's a large, reliably-measurable timing gap behind an identical "Incorrect email or
# password" response, which lets an attacker enumerate which emails are registered (and which of
# those are password-vs-Google-only accounts) purely by timing login attempts -- exactly the kind
# of enumeration forgot_password's own generic-response comment says this codebase cares about
# preventing. Computed once at import time (bcrypt.hashpw is the expensive part) so every login
# call, real or not, pays the same bcrypt.checkpw() cost.
_DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"dummy-password-for-constant-time-login", bcrypt.gensalt()).decode("utf-8")

def create_access_token(user_id: int, token_version: int = 0) -> str:
    payload = {
        "sub": str(user_id),
        "tv": token_version,
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
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        # Not attacker-reachable today (every token this server issues sets "sub" to a real integer
        # user id), but a malformed/forged token here previously fell through to an unguarded
        # int(...) and surfaced as a raw 500 instead of the 401 every other invalid-token path
        # already returns above.
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    # Tokens issued before this field existed carry no "tv" claim -- treat that as version 0,
    # which matches every existing user row's DEFAULT 0, so already-issued valid sessions aren't
    # retroactively invalidated by this change.
    token_version = payload.get("tv", 0)
    conn = get_db()
    try:
        user = get_user_by_id(conn, user_id)
        if not user:
            raise HTTPException(status_code=401, detail="Account no longer exists")
        if int(user["token_version"] or 0) != int(token_version):
            raise HTTPException(status_code=401, detail="Session expired, please log in again")
        # Deliberately checked AFTER the token_version match above, not right after decoding the
        # JWT: token_version is bumped specifically so a stolen/old JWT stops working the instant
        # its real owner resets their password (see reset_password()). If this throttle counted
        # every request keyed only on user_id -- before confirming the token is still the current
        # session -- an attacker replaying an old, already-invalidated token for a victim's account
        # could keep burning that account's shared 60-req/30s budget even though every single replay
        # is ultimately rejected as "Session expired", denial-of-servicing the real, currently
        # logged-in victim the password reset was meant to protect. Counting only requests that
        # already passed the version check closes that gap.
        _check_api_throttle(user_id)
        return user
    finally:
        conn.close()

def require_admin(user=Depends(get_current_user)):
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Admin access required")
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
    except HTTPException as e:
        # Only a bad/missing/expired token means "treat as logged out" -- that's the only case
        # this dependency exists to soften. get_current_user can also raise 429 (via
        # _check_api_throttle) for a perfectly valid, currently-logged-in session that's just
        # made too many requests too fast. Swallowing that too used to silently downgrade a
        # throttled paying subscriber to "anonymous" on every content endpoint that uses this
        # dependency (all the practice/mock pool GETs), which made gate_pool()/require_premium_pool()
        # falsely lock content they'd already paid for -- a 429 must propagate as a 429, not get
        # reinterpreted as "not logged in".
        if e.status_code == 401:
            return None
        raise

def _send_transactional_email(to_email: str, subject: str, html: str, log_prefix: str) -> bool:
    """Shared Resend (resend.com) send path for every transactional email this backend sends
    (password reset, email verification, ...). If RESEND_API_KEY isn't configured, or the send
    fails for any reason, this just logs to the server console instead of raising -- the calling
    endpoint should never itself error out just because email delivery isn't wired up or hiccups.
    Returns whether Resend actually accepted the email, so callers that need to know (e.g. the
    practice-reminder cron, which must not mark someone as "reminded" on a failed send) can check."""
    if not RESEND_API_KEY:
        print(f"[{log_prefix}] RESEND_API_KEY not set -- email to {to_email} not sent (subject: {subject!r})", flush=True)
        return False
    payload = json.dumps({
        "from": RESEND_FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html,
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
        print(f"[{log_prefix}] Resend accepted the email for {to_email} (status {resp.status})", flush=True)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[{log_prefix}] Resend rejected the email for {to_email}: HTTP {e.code} -- {body}", flush=True)
        return False
    except urllib.error.URLError as e:
        print(f"[{log_prefix}] Failed to send email to {to_email}: {e}", flush=True)
        return False

def send_password_reset_email(to_email: str, reset_link: str):
    if not RESEND_API_KEY:
        print(f"[password reset] RESEND_API_KEY not set -- reset link for {to_email}: {reset_link}", flush=True)
        return
    _send_transactional_email(
        to_email,
        "Reset your mrreadyprep password",
        f"<p>We received a request to reset your mrreadyprep password.</p>"
        f"<p><a href=\"{reset_link}\">Click here to choose a new password</a></p>"
        f"<p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>",
        "password reset",
    )

def send_verification_email(to_email: str, verify_link: str):
    if not RESEND_API_KEY:
        print(f"[email verification] RESEND_API_KEY not set -- verify link for {to_email}: {verify_link}", flush=True)
        return
    _send_transactional_email(
        to_email,
        "Verify your mrreadyprep email address",
        f"<p>Welcome to mrreadyprep! Please confirm this is your email address to finish setting up your account.</p>"
        f"<p><a href=\"{verify_link}\">Click here to verify your email</a></p>"
        f"<p>This link expires in 24 hours. If you didn't create a mrreadyprep account, you can safely ignore this email.</p>",
        "email verification",
    )

def send_practice_reminder_email(to_email: str, username: str) -> bool:
    return _send_transactional_email(
        to_email,
        "Haven't practiced today? A few minutes goes a long way",
        f"<p>Hi {_html.escape(username) if username else 'there'},</p>"
        f"<p>You haven't done any TOEFL practice on mrreadyprep in the last day. Even a single "
        f"5-minute exercise keeps your streak going and your skills sharp.</p>"
        f"<p><a href=\"{FRONTEND_PUBLIC_URL}\">Open mrreadyprep and practice now</a></p>"
        f"<p style=\"color:#9ca3af;font-size:12px;\">You're receiving this because you have an "
        f"mrreadyprep account and haven't practiced in a day. We'll stop as soon as you're back.</p>",
        "practice reminder",
    )

@app.post("/api/cron/practice-reminders")
def send_practice_reminders(x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret")):
    """Triggered by an external scheduler (e.g. a Render Cron Job running once a day) to nudge
    students who've gone quiet -- deliberately NOT reachable via normal user/admin auth, since a
    scheduler has no logged-in session to present. Requires PRACTICE_REMINDER_CRON_SECRET to be
    set and match the X-Cron-Secret header; with no secret configured this stays fully disabled
    (503) so it can never accidentally start firing before it's deliberately turned on -- which
    in turn depends on Resend actually being able to deliver mail (see RESEND_API_KEY / the
    verified-domain setup), so don't set this until that's confirmed working.

    "Gone quiet" = no attempt_results row in the last 24h, account is itself more than 24h old
    (so brand-new signups don't get nagged the same day), and not reminded again within the last
    24h (so re-running this more than once a day, or running it daily against someone who never
    comes back, doesn't spam them faster than once/day)."""
    if not PRACTICE_REMINDER_CRON_SECRET:
        raise HTTPException(status_code=503, detail="Practice reminders are not configured (PRACTICE_REMINDER_CRON_SECRET unset)")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, PRACTICE_REMINDER_CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid cron secret")

    now = datetime.now(timezone.utc)
    cutoff_dt = now - timedelta(hours=24)
    cutoff = cutoff_dt.isoformat() if DATABASE_URL else cutoff_dt.strftime("%Y-%m-%d %H:%M:%S")
    now_str = now.isoformat() if DATABASE_URL else now.strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db()
    try:
        # Capped at 200/run so one cron invocation can't run long enough to time out the web
        # process -- if the student base outgrows that, this should move to a background worker
        # instead of raising the cap indefinitely.
        rows = conn.execute("""
            SELECT id, email, username FROM users u
            WHERE u.email_verified = 1
              AND u.created_at < ?
              AND (u.last_reminder_sent_at IS NULL OR u.last_reminder_sent_at < ?)
              AND NOT EXISTS (
                  SELECT 1 FROM attempt_results ar WHERE ar.user_id = u.id AND ar.saved_at > ?
              )
              AND NOT EXISTS (
                  SELECT 1 FROM ridl_results rr WHERE rr.user_id = u.id AND rr.saved_at > ?
              )
            ORDER BY u.id
            LIMIT 200
        """, (cutoff, cutoff, cutoff, cutoff)).fetchall()

        sent = 0
        failed = 0
        for row in rows:
            # Only stamp last_reminder_sent_at on an actual successful send -- otherwise a
            # transient Resend outage (or RESEND_API_KEY being unset/invalid) would silently mark
            # everyone "reminded" for the day and the 24h re-send gate above would then suppress
            # any retry, leaving affected students never actually reminded until someone notices.
            if send_practice_reminder_email(row["email"], row["username"]):
                conn.execute("UPDATE users SET last_reminder_sent_at = ? WHERE id = ?", (now_str, row["id"]))
                sent += 1
            else:
                failed += 1
        conn.commit()
        return {"status": "ok", "reminders_sent": sent, "reminders_failed": failed}
    finally:
        conn.close()

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

    # Every timestamp this app writes is UTC (see the note on _parse_db_datetime) -- use UTC here
    # too, not the server process's local time, so "today"/the streak boundary can't drift by a
    # day depending on which timezone the deployed container happens to be running in.
    today = datetime.now(timezone.utc).date()
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
        "is_admin": is_admin_user(user),
        # Whether there's an actual Paddle subscription behind this account's premium access, as
        # opposed to access granted for free (an admin's own account via is_admin, or another
        # account manually comped through the admin panel's Grant button). The Subscribe screen
        # uses this to decide whether "Cancel subscription" makes sense to show at all -- calling
        # /api/subscription/cancel with no paddle_subscription_id on file just 400s, since there's
        # nothing on Paddle's end to actually cancel.
        "has_billed_subscription": bool(user["paddle_subscription_id"]),
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

def _get_vocab_words():
    # Lazy-loaded + cached via _cached_pool, like every other content pool in this file -- this
    # used to be a plain `with open(...) as f: vocab_words = json.load(f)` run unconditionally at
    # module import time, the one exception to this file's stated convention (see the comment on
    # every other pool file-path constant below) of only opening content files inside a request
    # handler specifically so a bad/missing file breaks just that one endpoint. If
    # toefl_vocab_list.json were ever missing, truncated, or had a JSON syntax error, the eager
    # version would crash the entire FastAPI app at import -- every endpoint down, not just
    # /api/vocab/* -- and fail Render's health check outright. Falls back to [] (not a crash) if
    # the file is genuinely broken; /api/vocab/* would just report zero words instead of the
    # whole process refusing to boot.
    try:
        return _cached_pool("vocab_words", lambda: _load_json_pool(VOCAB_FILE))
    except Exception:
        return []

# Complete the Words verisi
# NOTE: these are file-path constants only. Every endpoint below reads its pool through
# _cached_pool() (see near line 628), which parses the JSON once and then serves that cached
# result for up to _POOL_CACHE_MAX_AGE_SECONDS (~13 days) rather than re-reading the file on every
# request as this comment used to claim -- that claim predates the caching layer being added and
# was never updated to match. Practically: editing one of these JSON files in a running local/dev
# instance will NOT take effect until either that cache entry ages out or the process restarts; on
# Render, a normal redeploy always restarts the process, so this only matters for local testing.
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

# ============================================================
# API ENDPOINT'LERİ
# ============================================================

# Lightweight keep-alive target -- Render's free web-service tier spins the instance down after
# 15 minutes with no incoming HTTP traffic, and the next real visitor then eats a 50+ second cold
# start. Rather than paying for an always-on instance, an external monitor (e.g. UptimeRobot, free
# for this) can be pointed at this endpoint on a ~10-minute interval to keep the instance from
# ever going idle long enough to sleep. Deliberately does no DB/file work -- just confirms the
# process is up -- so it's cheap enough to hit constantly without adding real load.
@app.get("/healthz")
def healthz():
    return {"status": "ok"}

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
    try:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
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
        try:
            if DATABASE_URL:
                # Postgres has no cursor.lastrowid -- RETURNING id gets the new row's id instead.
                cursor = conn.execute(insert_sql.rstrip() + " RETURNING id", params)
                user_id = cursor.fetchone()["id"]
            else:
                cursor = conn.execute(insert_sql, params)
                user_id = cursor.lastrowid
            conn.commit()
        except _INTEGRITY_ERRORS:
            # The SELECT above and this INSERT aren't atomic, so two concurrent requests for the
            # same email (double-submit, or a race with google_login signing up the same address)
            # can both pass the "does this email exist" check and both reach here -- the second one
            # then hits the email UNIQUE constraint. Without this, that surfaces as an unhandled
            # 500 instead of the same clean 409 the upfront check already gives everyone else.
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        if is_first_user:
            migrate_legacy_data_to_user(user_id)

        verify_link = f"{FRONTEND_PUBLIC_URL}/?verify_token={verification_token}"
        send_verification_email(email, verify_link)

        user = get_user_by_id(conn, user_id)
        token = create_access_token(user_id, user["token_version"])
        return {"status": "success", "access_token": token, "user": user_profile_dict(user)}
    finally:
        conn.close()

## --- Login brute-force protection ---
# In-memory only (fine for a single Render instance; would need a shared store like Redis if this
# ever runs multiple worker processes/instances) -- tracks failed-attempt timestamps per key
# (IP + email combined, so one bad actor can't lock out a real student by spamming their email
# from elsewhere, and a shared IP like a school computer lab can't lock everyone out from one
# person's typos). Old timestamps are pruned lazily on each check so this never grows unbounded.
LOGIN_ATTEMPT_WINDOW_SECONDS = 15 * 60
LOGIN_ATTEMPT_MAX = 5
_login_attempts: dict = collections.defaultdict(list)
# The IP+email key above blocks nothing if an attacker varies ONE of the two on every request:
# credential stuffing from a single IP (trying many different emails) never repeats a key, and a
# distributed attack against one known victim email (rotating source IPs/a botnet) gets a fresh
# 5-attempt allowance per IP. These two extra, coarser, IP-only and email-only backstops close
# both gaps without punishing normal users, since their thresholds are far above what a real
# student hitting "wrong password" a few times would ever reach.
LOGIN_ATTEMPT_IP_WINDOW_SECONDS = 15 * 60
LOGIN_ATTEMPT_IP_MAX = 30
_login_attempts_by_ip: dict = collections.defaultdict(list)
LOGIN_ATTEMPT_EMAIL_WINDOW_SECONDS = 60 * 60
LOGIN_ATTEMPT_EMAIL_MAX = 15
_login_attempts_by_email: dict = collections.defaultdict(list)
# Guards every read-modify-write below (all these stores' check-then-append sequences aren't
# atomic on their own) -- without it, concurrent requests sharing a key (e.g. two tabs submitting
# the login form at once) could each read the same pre-append state and let a couple more attempts
# through than max_attempts before the limit kicks in. Low-stakes on its own (bcrypt's cost already
# throttles brute force far more than this off-by-a-couple-attempts race ever could), but cheap to
# close properly.
_rate_limit_lock = threading.Lock()

# Opt-in defense against the gap described in _client_ip below: Render sits its own load balancer
# in front of every web service, so the TCP peer this app actually sees (request.client.host) is
# Render's internal proxy, not the real internet-facing hop -- that's true whether a request came
# via Cloudflare or hit Render directly, so it can't be used to distinguish the two. There's no way
# to verify that distinction from inside the app without Render-side config, so instead: if
# CLOUDFLARE_ORIGIN_SECRET is set, a Cloudflare Transform Rule can be configured to stamp every
# request that actually passes through Cloudflare with a static header carrying this same secret,
# and only THEN is CF-Connecting-IP trusted. Unset (the default), behavior is unchanged from before
# -- this is additive, not a behavior change on its own.
CLOUDFLARE_ORIGIN_SECRET = os.environ.get("CLOUDFLARE_ORIGIN_SECRET", "").strip()

def _peer_is_cloudflare(request: Request) -> bool:
    """True when this request is safe to treat as having come through Cloudflare. See
    CLOUDFLARE_ORIGIN_SECRET above for why this can't be determined from request.client.host."""
    if not CLOUDFLARE_ORIGIN_SECRET:
        return True
    return hmac.compare_digest(
        request.headers.get("x-cf-origin-secret", ""), CLOUDFLARE_ORIGIN_SECRET
    )

def _client_ip(request: Request) -> str:
    # Traffic now flows client -> Cloudflare -> Render -> this app (Cloudflare was added in
    # front of the backend as api.mrreadyprep.com). Cloudflare sets CF-Connecting-IP to the real
    # visitor IP and this header cannot be spoofed by the client *when the request actually came
    # through Cloudflare* -- Cloudflare strips/overwrites any client-supplied value before
    # forwarding. Prefer it when present.
    #
    # Falling back to the last X-Forwarded-For hop (as before) covers local/dev and any request
    # that somehow bypasses Cloudflare and hits Render directly -- Render still appends the real
    # connecting IP as the last hop in that case.
    #
    # CF-Connecting-IP is only trustworthy when the request actually transited Cloudflare -- Render's
    # default *.onrender.com origin is still reachable directly unless separately locked down, and
    # anyone hitting that origin directly could set an arbitrary CF-Connecting-IP to get a fresh
    # identity on every request, silently voiding every IP-keyed rate limiter in this file (login,
    # register, Google sign-in, forgot-password, checkout). See CLOUDFLARE_ORIGIN_SECRET /
    # _peer_is_cloudflare above for the (opt-in, requires a one-time Cloudflare-side Transform Rule)
    # mitigation -- request.client.host can't be used for this the way it can on a bare VM, since
    # Render puts its own load balancer in front of every service, so the TCP peer this app sees is
    # always Render's internal proxy regardless of whether Cloudflare was actually in the path.
    cf_ip = request.headers.get("cf-connecting-ip", "").strip()
    if cf_ip and _peer_is_cloudflare(request):
        return cf_ip
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else "unknown"

def _check_bounded_attempts(store: dict, key: str, window_seconds: int, max_attempts: int) -> bool:
    """Shared helper for the three login backstops below: prunes `key`'s expired timestamps,
    drops the key entirely once empty (so the dict doesn't accumulate one permanent entry per
    IP/email ever seen), and returns whether `key` is currently AT the limit. Must be called
    with _rate_limit_lock already held."""
    now = time.time()
    attempts = [t for t in store[key] if now - t < window_seconds]
    if attempts:
        store[key] = attempts
    else:
        store.pop(key, None)
    return len(attempts) >= max_attempts

def _check_login_rate_limit(key: str, ip: str, email: str):
    _sweep_stale_rate_limit_entries()
    with _rate_limit_lock:
        if _check_bounded_attempts(_login_attempts, key, LOGIN_ATTEMPT_WINDOW_SECONDS, LOGIN_ATTEMPT_MAX):
            raise HTTPException(status_code=429, detail="Too many failed login attempts. Please try again in a few minutes.")
        if _check_bounded_attempts(_login_attempts_by_ip, ip, LOGIN_ATTEMPT_IP_WINDOW_SECONDS, LOGIN_ATTEMPT_IP_MAX):
            raise HTTPException(status_code=429, detail="Too many failed login attempts from this connection. Please try again in a few minutes.")
        if _check_bounded_attempts(_login_attempts_by_email, email, LOGIN_ATTEMPT_EMAIL_WINDOW_SECONDS, LOGIN_ATTEMPT_EMAIL_MAX):
            raise HTTPException(status_code=429, detail="Too many failed login attempts for this account. Please try again in a while, or reset your password.")

def _record_failed_login(key: str, ip: str, email: str):
    with _rate_limit_lock:
        now = time.time()
        _login_attempts[key].append(now)
        _login_attempts_by_ip[ip].append(now)
        _login_attempts_by_email[email].append(now)

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

# get_intro_audio_urls (below) is deliberately public and does no DB/file work, but was the one
# unauthenticated write-adjacent-cost endpoint in this file with no rate limit at all -- found in
# the 26th audit round. Generous limit since it's a legitimate, frequent call (every Listening list
# screen mount signs a fresh batch) -- this is defense-in-depth/cost-control against being hammered
# for free CPU, not a meaningful security boundary on its own.
INTRO_AUDIO_ATTEMPT_WINDOW_SECONDS = 60
INTRO_AUDIO_ATTEMPT_MAX = 60
_intro_audio_attempts: dict = collections.defaultdict(list)

# google_login (below) is the one account-creating/DB-writing auth endpoint that had no rate limit
# at all -- found in the 25th audit round. Same IP-keyed shape as register above (mints a new
# account row on first sign-in, updates one on repeat sign-ins) and the same rationale: nothing
# server-side bounded how many times it could be called besides the attacker's ability to obtain
# Google ID tokens, so a scripted flood could still tie up worker threads / DB connections the same
# way the audio-proxy incident (see AUDIO_PROXY comments elsewhere in this file) did before that was
# fixed. A little more headroom than register's limit since a legitimate multi-account household
# sharing one IP/router calls this far more casually than the register form.
GOOGLE_LOGIN_ATTEMPT_WINDOW_SECONDS = 60 * 60
GOOGLE_LOGIN_ATTEMPT_MAX = 20
_google_login_attempts: dict = collections.defaultdict(list)

FORGOT_PASSWORD_ATTEMPT_WINDOW_SECONDS = 15 * 60
FORGOT_PASSWORD_ATTEMPT_MAX = 5
_forgot_password_attempts: dict = collections.defaultdict(list)
# The IP+email key above blocks nothing against an attacker who rotates IPs against one fixed
# victim email (same gap login's IP+email key alone would have had -- see LOGIN_ATTEMPT_EMAIL_MAX
# above). Without an email-only backstop, that lets someone spam a specific student's inbox with
# password-reset emails indefinitely (nuisance/harassment, and burns the transactional-email
# provider's send quota) just by cycling through a handful of proxy IPs. Wider window and higher
# ceiling than the IP+email limiter so it only kicks in for genuinely abusive volume, never for a
# real student who legitimately requests a reset a few times.
FORGOT_PASSWORD_EMAIL_WINDOW_SECONDS = 60 * 60
FORGOT_PASSWORD_EMAIL_MAX = 10
_forgot_password_attempts_by_email: dict = collections.defaultdict(list)

RESEND_VERIFICATION_WINDOW_SECONDS = 60 * 60
RESEND_VERIFICATION_MAX = 5
_resend_verification_attempts: dict = collections.defaultdict(list)

# reset_password/verify_email (below) consume a high-entropy secrets.token_urlsafe(32) token, so
# brute-forcing the token itself isn't practical -- but found in the 28th audit round: unlike every
# other token/account-mutating endpoint in this file (forgot-password, login, register, google,
# resend-verification-email), these two called no rate limiter at all, each still costing a full DB
# round-trip per request. IP-keyed is enough here (the token is the real secret, this is just a
# floor on how many free DB hits an anonymous caller gets), with a generous ceiling since a
# household/NAT sharing one IP could plausibly complete a few resets/verifications back to back.
RESET_PASSWORD_ATTEMPT_WINDOW_SECONDS = 15 * 60
RESET_PASSWORD_ATTEMPT_MAX = 20
_reset_password_attempts: dict = collections.defaultdict(list)
VERIFY_EMAIL_ATTEMPT_WINDOW_SECONDS = 15 * 60
VERIFY_EMAIL_ATTEMPT_MAX = 20
_verify_email_attempts: dict = collections.defaultdict(list)

# --- General per-user API throttle ---
# Every authenticated endpoint funnels through get_current_user() below, so this is the one choke
# point that can bound how many requests a single account can throw at the DB_POOL_MAX_CONN=10
# connection pool. Without this, a single signed-up (even free-tier) student's own valid JWT lets
# them fire a tight loop of requests at any DB-backed endpoint (save-result, dashboard, vocab
# toggle, ...) and hold enough pooled connections in flight to starve every other concurrent
# user -- login, checkout, dashboard, everything -- with 503s, since the pool itself becomes the
# bottleneck. The threshold below is deliberately generous: normal usage (loading the dashboard,
# which already batches its own queries into one call, tapping through vocab flashcards, saving
# an exercise result) never comes close to it, so this should be invisible to every real student.
API_THROTTLE_WINDOW_SECONDS = 30
API_THROTTLE_MAX = 60
_api_throttle_attempts: dict = collections.defaultdict(list)

def _check_api_throttle(user_id: int):
    _sweep_stale_rate_limit_entries()
    key = str(user_id)
    with _rate_limit_lock:
        now = time.time()
        attempts = [t for t in _api_throttle_attempts[key] if now - t < API_THROTTLE_WINDOW_SECONDS]
        if len(attempts) >= API_THROTTLE_MAX:
            _api_throttle_attempts[key] = attempts
            raise HTTPException(status_code=429, detail="Too many requests. Please slow down and try again in a moment.")
        attempts.append(now)
        _api_throttle_attempts[key] = attempts

# A key (IP, or IP+email) only ever gets its list re-trimmed when that *exact* key is checked
# again -- an IP that fails once and never comes back would otherwise sit in the dict forever,
# so every rate-limited store is swept here too, not just the one being touched right now. Swept
# at most once a minute (module-level timestamp) so this stays cheap even under heavy traffic.
_ALL_RATE_LIMIT_STORES = [_login_attempts, _login_attempts_by_ip, _login_attempts_by_email, _register_attempts, _google_login_attempts, _forgot_password_attempts, _forgot_password_attempts_by_email, _resend_verification_attempts, _api_throttle_attempts, _intro_audio_attempts, _reset_password_attempts, _verify_email_attempts]
_last_rate_limit_sweep = 0.0

def _sweep_stale_rate_limit_entries():
    global _last_rate_limit_sweep
    now = time.time()
    if now - _last_rate_limit_sweep < 60:
        return
    with _rate_limit_lock:
        if now - _last_rate_limit_sweep < 60:  # re-check: another thread may have already swept
            return
        _last_rate_limit_sweep = now
        # Generous upper bound covers every window currently in use (longest is 1 hour) -- a key
        # with nothing in the last hour can't still be actively rate-limiting anyone.
        cutoff = 60 * 60
        for store in _ALL_RATE_LIMIT_STORES:
            stale_keys = [k for k, v in store.items() if not v or now - max(v) >= cutoff]
            for k in stale_keys:
                store.pop(k, None)

def _check_and_consume_rate_limit(store: dict, key: str, window_seconds: int, max_attempts: int, what: str):
    _sweep_stale_rate_limit_entries()
    with _rate_limit_lock:
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
    ip = _client_ip(request)
    rate_limit_key = f"{ip}:{email}"
    _check_login_rate_limit(rate_limit_key, ip, email)
    conn = get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        # Always run bcrypt.checkpw() against *some* hash -- the user's real one if they exist and
        # have a password set, otherwise the fixed dummy hash above -- so this line takes the same
        # ~100-300ms regardless of whether the email is registered. See _DUMMY_PASSWORD_HASH's
        # comment for why: without this, `user and verify_password(...)` short-circuits past the
        # slow bcrypt call for any nonexistent/Google-only email, making those cases reliably
        # faster than a real password mismatch and defeating the generic error message below.
        password_ok = verify_password(data.password, (user["password_hash"] if user else None) or _DUMMY_PASSWORD_HASH)
        if not user or not user["password_hash"] or not password_ok:
            _record_failed_login(rate_limit_key, ip, email)
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        with _rate_limit_lock:
            _login_attempts.pop(rate_limit_key, None)
            _login_attempts_by_email.pop(email, None)
            # _login_attempts_by_ip is deliberately NOT cleared here (unlike the two keys above).
            # It exists specifically as a backstop against credential stuffing -- one IP trying many
            # *different* emails -- so it has to keep counting across accounts. Clearing the whole
            # per-IP bucket just because *this one* login happened to succeed would let an attacker
            # who owns (or has stuffed into) any single account on that IP log into it right before
            # hitting LOGIN_ATTEMPT_IP_MAX, wiping the counter and resuming the attack indefinitely.
            # It's left to decay naturally via the existing sliding window / periodic sweep instead.
        token = create_access_token(user["id"], user["token_version"])
        return {"status": "success", "access_token": token, "user": user_profile_dict(user)}
    finally:
        conn.close()

@app.post("/api/auth/google")
def google_login(data: GoogleLoginRequest, request: Request):
    """Verifies the ID token Google Identity Services hands back to the frontend after the
    student picks their Google account, then either logs them into their existing account
    (matched by google_id first, then by email so someone who registered with a password can
    still link their Google account by signing in with the same address) or creates a brand new
    one. Google has already verified the student's email for us, so accounts created this way
    start out email_verified = 1 -- no separate verification email is needed."""
    _check_and_consume_rate_limit(_google_login_attempts, _client_ip(request), GOOGLE_LOGIN_ATTEMPT_WINDOW_SECONDS, GOOGLE_LOGIN_ATTEMPT_MAX, "Google sign-in")
    if not GOOGLE_CLIENT_ID or not google_id_token:
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured on this server yet")

    try:
        payload = google_id_token.verify_oauth2_token(
            data.id_token, google_auth_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        # The token itself is malformed/expired/wrong-audience -- genuinely invalid credential.
        raise HTTPException(status_code=401, detail="Invalid Google credential")
    except Exception as e:
        # verify_oauth2_token fetches Google's public certs over the network on every call; a
        # transient DNS/connection failure there raises a transport-layer exception (not a
        # ValueError), which used to propagate as an opaque, unlogged 500 instead of a clean,
        # retryable error for what's usually just a momentary network blip.
        print(f"[google sign-in] token verification failed (non-credential error): {e!r}", flush=True)
        raise HTTPException(status_code=503, detail="Could not verify Google credential right now -- please try again")

    google_id = payload.get("sub")
    email = (payload.get("email") or "").strip().lower()
    email_verified_by_google = bool(payload.get("email_verified"))
    # Google doesn't guarantee any particular length limit on the profile-name claim it hands back
    # to relying parties -- every other path that sets `username` (register, update_profile) is
    # bounded to 50 chars via Field(max_length=50)/an explicit re-check, so mirror that bound here
    # too rather than inserting an arbitrarily long value into that column.
    name = (payload.get("name") or (email.split("@")[0] if email else "Student"))[:50]
    if not google_id or not email or not email_verified_by_google:
        raise HTTPException(status_code=401, detail="Google account is missing a verified email")

    conn = get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE google_id = ?", (google_id,)).fetchone()
        if not user:
            user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            if user:
                # Existing account with the same email -- link this Google identity to it instead
                # of creating a duplicate. Found in the 28th audit round: register() never confirms
                # mailbox ownership, so anyone could have pre-registered an arbitrary email address
                # with a password only they know, then simply waited. If the real owner of that
                # email later signs in here for the first time via Google, this lookup finds the
                # attacker's dangling row by email and would previously link it as "the real owner's
                # account" without touching the attacker's password -- silently handing over
                # whatever data/subscription accumulates from then on, while the attacker could
                # still log in with their original password at any time. Google's email_verified
                # claim is the strongest ownership signal available, so treat this link as a full
                # handover: clear any existing password_hash (so a pre-set password can no longer be
                # used to sign in) and bump token_version (so any session/JWT issued before this
                # point, e.g. the attacker's, stops working immediately) -- the same
                # invalidate-on-credential-change pattern reset_password() already uses below. A
                # legitimate account owner who registered with a password and later links Google
                # loses nothing they can't immediately redo via "Forgot password" if they still want
                # a password login option.
                conn.execute(
                    "UPDATE users SET google_id = ?, email_verified = 1, password_hash = NULL, token_version = token_version + 1 WHERE id = ?",
                    (google_id, user["id"]),
                )
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
                try:
                    if DATABASE_URL:
                        cursor = conn.execute(insert_sql.rstrip() + " RETURNING id", params)
                        user_id = cursor.fetchone()["id"]
                    else:
                        cursor = conn.execute(insert_sql, params)
                        user_id = cursor.lastrowid
                    conn.commit()
                except _INTEGRITY_ERRORS:
                    # Same email/google_id race as register() above -- e.g. two tabs both
                    # completing Google Sign-In for the first time at once. Without this, the
                    # second request's INSERT hits the email or google_id UNIQUE constraint and
                    # surfaces as an unhandled 500 instead of a clean, actionable error.
                    raise HTTPException(status_code=409, detail="An account with this email already exists")
                if is_first_user:
                    migrate_legacy_data_to_user(user_id)
                user = get_user_by_id(conn, user_id)

        token = create_access_token(user["id"], user["token_version"])
        return {"status": "success", "access_token": token, "user": user_profile_dict(user)}
    finally:
        conn.close()

@app.post("/api/auth/forgot-password")
def forgot_password(data: ForgotPasswordRequest, request: Request, background_tasks: BackgroundTasks):
    """Always returns the same generic success message whether or not the email is registered --
    this stops someone from using this endpoint to check which emails have an account here.

    The actual send is deferred via BackgroundTasks (found in the 27th audit round) rather than
    called inline -- send_password_reset_email() makes a real, synchronous network call to Resend
    (up to its own 10s timeout), which used to run only on the "account exists" branch. That made
    this endpoint's response latency a reliable timing side-channel: a request for a registered
    email took measurably longer than one for an unregistered email, even though both bodies were
    identical -- defeating the whole point of the generic response, the same class of bug login()
    already closed years ago via its constant-time bcrypt comparison. Queuing the send as a
    background task means the HTTP response returns immediately on both branches regardless of
    whether an email actually goes out, closing the timing gap the same way."""
    email = data.email.strip().lower()
    _check_and_consume_rate_limit(_forgot_password_attempts, f"{_client_ip(request)}:{email}", FORGOT_PASSWORD_ATTEMPT_WINDOW_SECONDS, FORGOT_PASSWORD_ATTEMPT_MAX, "password-reset")
    _check_and_consume_rate_limit(_forgot_password_attempts_by_email, email, FORGOT_PASSWORD_EMAIL_WINDOW_SECONDS, FORGOT_PASSWORD_EMAIL_MAX, "password-reset")
    print(f"[password reset] forgot-password called for email={email!r}", flush=True)
    conn = get_db()
    try:
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
            background_tasks.add_task(send_password_reset_email, email, reset_link)
        return {"status": "success", "message": "If an account exists for that email, a reset link has been sent."}
    finally:
        conn.close()

@app.post("/api/auth/reset-password")
def reset_password(data: ResetPasswordRequest, request: Request):
    _check_and_consume_rate_limit(_reset_password_attempts, _client_ip(request), RESET_PASSWORD_ATTEMPT_WINDOW_SECONDS, RESET_PASSWORD_ATTEMPT_MAX, "password reset")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE password_reset_token = ?", (data.token,)
        ).fetchone()
        if not user:
            raise HTTPException(status_code=400, detail="This reset link is invalid or has already been used")
        expires = user["password_reset_token_expires"]
        if not expires or _parse_db_datetime(expires) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one")
        # Bumping token_version here invalidates every JWT issued before this reset (see
        # get_current_user) -- including one an attacker may have stolen, which is the whole point
        # of letting a student reset their password in the first place.
        conn.execute(
            "UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_token_expires = NULL, token_version = token_version + 1 WHERE id = ?",
            (hash_password(data.new_password), user["id"]),
        )
        conn.commit()
        return {"status": "success", "message": "Password updated. You can now log in with your new password."}
    finally:
        conn.close()

@app.post("/api/auth/verify-email")
def verify_email(data: VerifyEmailRequest, request: Request):
    """Confirms the student's real email address -- purely informational for now (nothing in the
    app is gated on email_verified, see gate_pool/require_premium_pool for the actual subscription
    gating), but it's what powers the 'Verified' badge and lets support trust a reported email."""
    _check_and_consume_rate_limit(_verify_email_attempts, _client_ip(request), VERIFY_EMAIL_ATTEMPT_WINDOW_SECONDS, VERIFY_EMAIL_ATTEMPT_MAX, "email verification")
    conn = get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE verification_token = ?", (data.token,)).fetchone()
        if not user:
            raise HTTPException(status_code=400, detail="This verification link is invalid or has already been used")
        if user["email_verified"]:
            return {"status": "success", "message": "Your email is already verified."}
        expires = user["verification_token_expires"]
        if not expires or _parse_db_datetime(expires) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="This verification link has expired. Please request a new one from your profile.")
        conn.execute(
            "UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?",
            (user["id"],),
        )
        conn.commit()
        return {"status": "success", "message": "Your email has been verified."}
    finally:
        conn.close()

@app.post("/api/auth/resend-verification-email")
def resend_verification_email(user=Depends(get_current_user)):
    if user["email_verified"]:
        return {"status": "success", "message": "Your email is already verified."}
    _check_and_consume_rate_limit(_resend_verification_attempts, str(user["id"]), RESEND_VERIFICATION_WINDOW_SECONDS, RESEND_VERIFICATION_MAX, "verification-email resend")
    verification_token = secrets.token_urlsafe(32)
    verification_expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?",
            (verification_token, verification_expires, user["id"]),
        )
        conn.commit()
        verify_link = f"{FRONTEND_PUBLIC_URL}/?verify_token={verification_token}"
        send_verification_email(user["email"], verify_link)
        return {"status": "success", "message": "Verification email sent. Please check your inbox."}
    finally:
        conn.close()

@app.get("/api/auth/me")
def get_me(user=Depends(get_current_user)):
    return user_profile_dict(user)

# ============================================================
# ADMIN -- gated by require_admin (see ADMIN_EMAILS/is_admin_user near the top of this file).
# Deliberately narrow in scope: view every registered account and manually grant/revoke premium
# access (for support requests, comping an account, or testing) -- editing the actual practice/mock
# content isn't included here, since that content lives in the JSON pool files shipped with the
# backend rather than in the database, so it's edited by changing those files and redeploying.
# ============================================================

class AdminSetSubscriptionRequest(BaseModel):
    action: str  # "grant" | "revoke"

@app.get("/api/admin/users")
def admin_list_users(admin=Depends(require_admin)):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, email, username, email_verified, subscription_status, "
            "subscription_current_period_end, paddle_subscription_id, created_at, current_streak "
            "FROM users ORDER BY created_at DESC"
        ).fetchall()
        def row_is_admin(row):
            return (row["email"] or "").strip().lower() in ADMIN_EMAILS
        return [
            {
                "id": row["id"],
                "email": row["email"],
                "username": row["username"],
                "email_verified": bool(row["email_verified"]),
                "subscription_status": row["subscription_status"],
                # Routed through the same has_active_subscription() used everywhere access is
                # actually gated (not a separately hand-rolled status check) so this can never show
                # "Premium: yes" for an account whose real access has already lapsed under the
                # subscription_current_period_end staleness backstop -- e.g. right after a missed
                # Paddle webhook, which is exactly when support staff would be looking at this panel
                # and need it to be accurate.
                "has_premium": has_active_subscription(row),
                # A real, Paddle-billed subscription -- the admin panel's Revoke button is disabled
                # for these (see admin_set_subscription below) since silently flipping subscription_status
                # here would desync from what Paddle is actually still charging the card for. A paying
                # customer's access should only ever be ended through the real cancel flow.
                "has_billed_subscription": bool(row["paddle_subscription_id"]),
                "is_admin": row_is_admin(row),
                "created_at": row["created_at"].isoformat() if isinstance(row["created_at"], datetime) else row["created_at"],
                "current_streak": row["current_streak"],
            }
            for row in rows
        ]
    finally:
        conn.close()

@app.get("/api/admin/stats")
def admin_stats(admin=Depends(require_admin)):
    conn = get_db()
    try:
        total_users = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
        # Route through has_active_subscription() itself -- same function admin_list_users()'s
        # has_premium field uses (see the fix there) -- rather than a separately hand-rolled status
        # filter, so this count can never silently disagree with the per-row values shown just below
        # it in the admin panel. A raw "status IN (...)" filter would both miss the staleness
        # backstop (a lapsed Paddle webhook leaves subscription_status stuck at ACTIVE/TRIALING
        # indefinitely, see has_active_subscription()'s own comment) and undercount comped admin
        # accounts that have full access without ever having a real subscription row.
        active_subs = sum(
            1 for row in conn.execute(
                "SELECT email, subscription_status, subscription_current_period_end FROM users"
            ).fetchall()
            if has_active_subscription(row)
        )
        verified = conn.execute("SELECT COUNT(*) AS n FROM users WHERE email_verified = 1").fetchone()["n"]
        week_ago_dt = datetime.now(timezone.utc) - timedelta(days=7)
        # Postgres' TIMESTAMP column casts the param before comparing, so ISO format works there.
        # sqlite's created_at is stored as 'YYYY-MM-DD HH:MM:SS' (via CURRENT_TIMESTAMP) and compares
        # lexicographically -- an ISO string with a 'T' separator and +00:00 offset sorts *after* any
        # real row (since 'T' > ' '), so every comparison was silently false. Match sqlite's own format.
        week_ago = week_ago_dt.isoformat() if DATABASE_URL else week_ago_dt.strftime("%Y-%m-%d %H:%M:%S")
        signups_7d = conn.execute(
            "SELECT COUNT(*) AS n FROM users WHERE created_at >= ?", (week_ago,)
        ).fetchone()["n"]
        return {
            "total_users": total_users,
            "active_subscriptions": active_subs,
            "verified_emails": verified,
            "signups_last_7_days": signups_7d,
        }
    finally:
        conn.close()

@app.post("/api/admin/users/{user_id}/subscription")
def admin_set_subscription(user_id: int, data: AdminSetSubscriptionRequest, admin=Depends(require_admin)):
    if data.action not in ("grant", "revoke"):
        raise HTTPException(status_code=400, detail="action must be 'grant' or 'revoke'")
    conn = get_db()
    try:
        target = get_user_by_id(conn, user_id)
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if data.action == "revoke" and target["paddle_subscription_id"]:
            raise HTTPException(
                status_code=400,
                detail="This account has a real Paddle subscription -- revoking here would only hide "
                       "their access while Paddle keeps charging their card. Cancel the subscription "
                       "itself (from their account's Settings, or via /api/subscription/cancel) instead.",
            )
        new_status = "ACTIVE" if data.action == "grant" else None
        if data.action == "grant":
            # Also clear any stale subscription_current_period_end. Without this, comping access to
            # an account that had a real Paddle subscription before (now lapsed, with a
            # current_period_end sitting in the past) was silently ineffective: has_active_subscription()'s
            # staleness backstop would immediately treat the grant as lapsed again the moment it was
            # checked, since it only looks at subscription_status AFTER first checking whether
            # current_period_end is more than a couple of days in the past. NULL reads as "still
            # active" there (comped/admin-granted access has no period to expire).
            conn.execute(
                "UPDATE users SET subscription_status = ?, subscription_current_period_end = NULL WHERE id = ?",
                (new_status, user_id),
            )
        else:
            conn.execute("UPDATE users SET subscription_status = ? WHERE id = ?", (new_status, user_id))
        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()

# ============================================================
# SUBSCRIPTION (Paddle) -- see PADDLE CONFIG block near the top of this file for env vars,
# _paddle_request() for the authenticated HTTP call helper, and has_active_subscription()/
# gate_pool() for how this gates the actual content endpoints below.
#
# Flow: frontend calls create-checkout (below) to get a transaction id, opens Paddle's own
# Checkout.js overlay with that transaction id (student never leaves mrreadyprep.com, and never
# has to hand over a TC Kimlik No / identity number the way iyzico required), then Paddle POSTs
# to the webhook (below) once the payment actually clears -- that webhook is the only thing that
# ever flips subscription_status to ACTIVE. The overlay closing successfully is a UI hint only,
# never trusted on its own.
# ============================================================

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

# Per-user locks guarding create_checkout below. The has_active_subscription check that opens
# that function reads the `user` row handed in by the get_current_user dependency, which was
# fetched once at request start -- two concurrent create_checkout calls for the same user (a
# stale tab plus a fresh one, a double-click before the UI's own re-fetch lands, a retried client
# request) can both read "not subscribed" before either one finishes creating its Paddle
# transaction, producing two real transactions for one student. Serializing per user_id (not a
# single global lock, which would make one user's checkout block every other user's) and
# re-reading the row from the DB after acquiring the lock closes that window; the dict itself
# is small and never cleaned up, but at most one Lock per user account ever exists.
_checkout_locks: dict = {}
_checkout_locks_guard = threading.Lock()

def _checkout_lock_for(user_id: int) -> threading.Lock:
    with _checkout_locks_guard:
        lock = _checkout_locks.get(user_id)
        if lock is None:
            lock = threading.Lock()
            _checkout_locks[user_id] = lock
        return lock

# The lock above only serializes *concurrent* create_checkout calls for one user -- it does nothing
# to stop a script from calling this endpoint many times in a row, sequentially, each call passing
# the "not already subscribed" check (since no transaction from a prior call was ever completed)
# and making a real server-to-server call to Paddle's API. That racks up abandoned transaction
# records against the merchant account and burns Paddle's own API rate limit, which could degrade
# checkout for real, paying customers. A generous per-user ceiling closes this without affecting
# any real student, who only ever calls this once per genuine subscribe attempt.
CREATE_CHECKOUT_WINDOW_SECONDS = 10 * 60
CREATE_CHECKOUT_MAX = 8
_create_checkout_attempts: dict = collections.defaultdict(list)
_ALL_RATE_LIMIT_STORES.append(_create_checkout_attempts)

@app.post("/api/subscription/create-checkout")
def create_checkout(user=Depends(get_current_user)):
    """Creates a Paddle transaction server-side (authenticated) and hands the frontend back just
    the transaction id to open in Paddle's Checkout.js overlay (Paddle.Checkout.open({
    transactionId })). Doing this server-side -- rather than letting the frontend pass
    price/customData straight to Checkout.js -- means custom_data.user_id is set by code that has
    already verified who the logged-in user is, not by anything the browser could tamper with; a
    forged user_id in a client-side customData would otherwise let someone grant premium to an
    account they don't own just by paying for a different one."""
    _require_paddle()
    _check_and_consume_rate_limit(_create_checkout_attempts, str(user["id"]), CREATE_CHECKOUT_WINDOW_SECONDS, CREATE_CHECKOUT_MAX, "checkout")
    with _checkout_lock_for(user["id"]):
        # Re-check against a fresh row (not the possibly-stale `user` the dependency fetched at
        # request start) now that we hold this user's lock -- see _checkout_locks above.
        conn = get_db()
        try:
            fresh_user = get_user_by_id(conn, user["id"])
        finally:
            conn.close()
        if fresh_user is not None and has_active_subscription(fresh_user):
            # Without this, a stale tab / double-click before the UI re-fetches status / a retried
            # client request can create a second real Paddle transaction for someone who's already
            # subscribed. The webhook below just overwrites paddle_subscription_id with whichever one
            # fires last, silently orphaning the other -- Paddle keeps billing it, and the student has
            # no self-service way to cancel it since Settings only offers to cancel the one on file.
            raise HTTPException(status_code=400, detail="You already have an active subscription.")
        body = {
            "items": [{"price_id": PADDLE_PRICE_ID, "quantity": 1}],
            "customer": {"email": user["email"]},
            "custom_data": {"user_id": str(user["id"])},
        }
        result = _paddle_request("POST", "/transactions", body)
        txn = (result or {}).get("data")
        if not txn or not txn.get("id"):
            detail = ((result or {}).get("error") or {}).get("detail", "Could not start checkout. Please try again.")
            raise HTTPException(status_code=400, detail=detail)
        return {"transaction_id": txn["id"]}

@app.post("/api/subscription/cancel")
def cancel_subscription(user=Depends(get_current_user)):
    """Paddle has a hosted Customer Portal, but a direct API call from a confirm button in
    Settings keeps the cancel flow consistent with the rest of this site's UI (and matches what
    the old iyzico integration did). effective_from: 'immediately' matches the copy already shown
    on the Cancel confirmation modal ("You will lose access to locked content immediately")."""
    _require_paddle()
    if not user["paddle_subscription_id"]:
        raise HTTPException(status_code=400, detail="No active subscription on file")
    result = _paddle_request(
        "POST",
        f"/subscriptions/{user['paddle_subscription_id']}/cancel",
        {"effective_from": "immediately"},
    )
    if not (result or {}).get("data"):
        detail = ((result or {}).get("error") or {}).get("detail", "Could not cancel subscription")
        raise HTTPException(status_code=400, detail=detail)
    conn = get_db()
    try:
        conn.execute("UPDATE users SET subscription_status = 'CANCELED' WHERE id = ?", (user["id"],))
        conn.commit()
    finally:
        conn.close()
    return {"status": "success"}

# Paddle subscription statuses come back lowercase (active, trialing, past_due, paused, canceled)
# -- uppercased on the way into our own DB so they line up with the rest of this file's
# ACTIVE_SUBSCRIPTION_STATUSES / admin-panel / dashboard checks, which have always used uppercase.
_PADDLE_STATUS_MAP = {
    "active": "ACTIVE", "trialing": "TRIALING", "past_due": "PAST_DUE",
    "paused": "PAUSED", "canceled": "CANCELED",
}

@app.post("/api/subscription/webhook")
async def paddle_webhook(request: Request):
    """Paddle POSTs here (no Authorization header -- verified via the Paddle-Signature header
    instead, HMAC-SHA256 over 'ts:rawbody' keyed with PADDLE_WEBHOOK_SECRET) on every
    subscription/transaction lifecycle event, including renewals -- this is what keeps
    subscription_status in sync automatically without anyone needing to poll Paddle. Must be
    registered as a Notification destination (pointing at this URL) in the Paddle dashboard under
    Developer Tools > Notifications, subscribed to at least the subscription.* events."""
    if not PADDLE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Paddle webhook not configured (PADDLE_WEBHOOK_SECRET missing)")
    # Defense in depth: real Paddle payloads are a few KB at most. Reject anything absurd before
    # buffering it into memory, rather than trusting Cloudflare/Render's own body-size limits to
    # be the only thing standing between this public, pre-auth endpoint and a memory-exhaustion
    # attempt via a huge POST.
    #
    # A Content-Length check alone is not enough: it's only present when the client sends one, and
    # an HTTP/1.1 request using Transfer-Encoding: chunked legitimately omits Content-Length
    # entirely -- an attacker sending chunked with no Content-Length would sail straight past the
    # check below and get buffered in full by a plain `await request.body()`, exactly the
    # unbounded-memory case this was meant to prevent. Fast-path on Content-Length when present
    # (avoids buffering at all for the common case), then enforce the same ceiling by reading the
    # body incrementally and aborting the moment it's exceeded, regardless of what any header claims.
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            content_length_int = int(content_length)
        except ValueError:
            # This runs before the webhook signature check below, on a public pre-auth endpoint --
            # a malformed (non-numeric) header value must not be able to raise an unhandled 500 here.
            raise HTTPException(status_code=400, detail="Invalid Content-Length header")
        if content_length_int > 1_000_000:
            raise HTTPException(status_code=413, detail="Payload too large")
    body_chunks = []
    total_len = 0
    async for chunk in request.stream():
        total_len += len(chunk)
        if total_len > 1_000_000:
            raise HTTPException(status_code=413, detail="Payload too large")
        body_chunks.append(chunk)
    raw_body = b"".join(body_chunks)
    sig_header = request.headers.get("paddle-signature", "")
    ts, h1 = "", ""
    for part in sig_header.split(";"):
        if part.startswith("ts="):
            ts = part[3:]
        elif part.startswith("h1="):
            h1 = part[3:]
    if not ts or not h1:
        raise HTTPException(status_code=400, detail="Missing or malformed Paddle-Signature header")
    # Reject stale/replayed deliveries -- a generous 5 minute window (rather than Paddle's own
    # SDK default of 5 seconds) since this is a defense-in-depth check on top of the HMAC compare
    # below, not the primary protection, and a tight window is easy to blow past under real
    # network/queueing delay with no actual security benefit.
    try:
        if abs(datetime.now(timezone.utc).timestamp() - int(ts)) > 300:
            raise HTTPException(status_code=400, detail="Webhook timestamp outside allowed window")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Paddle-Signature timestamp")
    signed_payload = f"{ts}:{raw_body.decode('utf-8')}"
    expected_sig = hmac.new(PADDLE_WEBHOOK_SECRET.encode("utf-8"), signed_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(h1, expected_sig):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event = json.loads(raw_body.decode("utf-8"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    event_type = event.get("event_type", "")
    if not event_type.startswith("subscription."):
        return {"status": "ignored"}

    data = event.get("data") or {}
    subscription_id = data.get("id")
    customer_id = data.get("customer_id")
    raw_status = data.get("status", "")
    status = _PADDLE_STATUS_MAP.get(raw_status, None)
    if not subscription_id or not status:
        # Previously silent -- if Paddle ever adds/renames a subscription status (their docs list
        # more values than _PADDLE_STATUS_MAP covers, e.g. any future addition), every webhook
        # delivery for it would 200 as "ignored" with no trace anywhere that anything was skipped.
        # That's fine for event_types we deliberately don't act on, but a subscription.* event with
        # an unrecognized `status` is a real gap worth a log line to notice from Render's logs,
        # rather than only ever surfacing as a confused "why didn't my subscription update" report.
        if subscription_id and not status:
            print(f"[paddle webhook] ignoring subscription {subscription_id}: unrecognized status {raw_status!r} (event_type={event_type!r})", flush=True)
        return {"status": "ignored"}
    period_end = ((data.get("current_billing_period") or {}).get("ends_at"))
    custom_data = data.get("custom_data") or {}
    user_id = custom_data.get("user_id")

    # The DB work below is synchronous (sqlite3, or a real network round-trip to Postgres in
    # production via psycopg2) and was previously run directly inside this `async def` coroutine --
    # the same event-loop-blocking bug already fixed for get_academic_passage, but worse here since
    # Paddle can deliver a webhook for every subscription lifecycle event (creation, renewal,
    # cancellation, past-due, ...) and each one would stall every other concurrent async request on
    # this worker for the duration of the DB round-trip. Running it via asyncio.to_thread keeps the
    # event loop free while this executes on a worker thread.
    def _apply_webhook():
        conn = get_db()
        try:
            # subscription.created is the only event where this subscription_id hasn't been linked to
            # a user yet -- custom_data.user_id (set server-side in create_checkout above) is what
            # binds it. Every later event (updated/canceled/past_due) is matched by subscription_id
            # alone, same as the iyzico webhook matched on subscriptionReferenceCode before it.
            if event_type == "subscription.created" and user_id:
                try:
                    user_id_int = int(user_id)
                except (TypeError, ValueError):
                    print(f"[paddle webhook] subscription.created with non-numeric custom_data.user_id={user_id!r} -- subscription_id={subscription_id}. Cannot link to a user; premium was NOT granted.", flush=True)
                    raise HTTPException(status_code=400, detail="Invalid custom_data.user_id on subscription.created")
                cur = conn.execute(
                    "UPDATE users SET paddle_customer_id = ?, paddle_subscription_id = ?, "
                    "subscription_status = ?, subscription_current_period_end = ? WHERE id = ?",
                    (customer_id, subscription_id, status, period_end, user_id_int),
                )
                if cur.rowcount == 0:
                    # user_id was present and numeric but didn't match any real account (stale/deleted
                    # user, bad data). Same failure mode the "missing custom_data" branch below already
                    # guards against -- the student was charged but premium was never actually granted,
                    # so this needs the same loud, logged failure instead of a silent 200 to Paddle.
                    print(f"[paddle webhook] subscription.created: custom_data.user_id={user_id_int} matched no user -- subscription_id={subscription_id} customer_id={customer_id}. Premium was NOT granted.", flush=True)
                    raise HTTPException(status_code=400, detail="custom_data.user_id did not match any user")
            elif event_type == "subscription.created":
                # custom_data.user_id was missing on the very first event for this subscription --
                # e.g. a subscription created outside our own checkout flow. There's no row with this
                # paddle_subscription_id yet (nothing to have set it before now), so falling through
                # to the WHERE-paddle_subscription_id branch below would silently match zero rows: the
                # student would have paid with no way to ever get premium access, and no error trail
                # for support to find. Surface it loudly instead and ask Paddle to retry, in case the
                # missing custom_data was a transient issue on Paddle's end.
                print(f"[paddle webhook] subscription.created with no custom_data.user_id -- subscription_id={subscription_id} customer_id={customer_id}. Cannot link to a user; premium was NOT granted.", flush=True)
                raise HTTPException(status_code=400, detail="Missing custom_data.user_id on subscription.created")
            else:
                cur = conn.execute(
                    "UPDATE users SET subscription_status = ?, subscription_current_period_end = ? "
                    "WHERE paddle_subscription_id = ?",
                    (status, period_end, subscription_id),
                )
                if cur.rowcount == 0:
                    print(f"[paddle webhook] {event_type} matched no user for subscription_id={subscription_id} -- no row has this paddle_subscription_id yet.", flush=True)
            conn.commit()
        finally:
            conn.close()

    await asyncio.to_thread(_apply_webhook)
    return {"status": "ok"}

# --- Dashboard ---
@app.get("/api/dashboard")
def get_dashboard(user=Depends(get_current_user)):
    # Section scores are always the live average of that section's attempted parts (see
    # compute_section_band) -- a section with zero attempts shows band 1.0, the scale's floor,
    # rather than a placeholder that makes an untouched section look already-practiced.
    conn = get_db()
    try:
        updates = {}
        category_sums = _fetch_category_sums(conn, user["id"])
        for section in ("reading", "listening", "writing", "speaking"):
            updates[f"{section}_score"] = compute_section_band(category_sums, section)
        streak, week_activity = compute_streak_and_week_activity(conn, user["id"])
        updates["current_streak"] = streak
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", (*updates.values(), user["id"]))
        conn.commit()
        # Build the fresh profile from the already-fetched `user` row plus the just-written
        # `updates`, instead of re-SELECTing the row we just UPDATEd -- this is a high-frequency
        # endpoint (refetches on every Dashboard tab visit), and the only fields the UPDATE above
        # can have changed are exactly the keys in `updates`, so a second round trip to read back
        # values we already know is pure overhead.
        fresh_user = {**dict(user), **updates}
        # "mock_overall" is only ever saved once per completed Full Mock Test (all 4 sections) -- see
        # saveResult('mock_overall', ...) on the frontend -- so its most recent saved_at is exactly
        # "when did this student last finish a full test", which the Dashboard's mock-test card shows.
        last_mock_row = conn.execute(
            "SELECT saved_at FROM attempt_results WHERE user_id = ? AND category = 'mock_overall' "
            "ORDER BY saved_at DESC LIMIT 1",
            (user["id"],),
        ).fetchone()
        result = user_profile_dict(fresh_user)
        result["week_activity"] = week_activity
        result["last_mock_test_at"] = (
            last_mock_row["saved_at"].isoformat() if isinstance(last_mock_row["saved_at"], datetime)
            else last_mock_row["saved_at"]
        ) if last_mock_row else None
        return result
    finally:
        conn.close()

@app.post("/api/profile/update")
def update_profile(data: DashboardData, user=Depends(get_current_user)):
    # RegisterRequest already rejects an empty/whitespace-only username at signup time -- this
    # endpoint let that constraint quietly lapse for existing accounts, since DashboardData never
    # had the same check, so a student could set their own username to "" or all-whitespace from
    # the Settings screen even though registration never would have allowed it.
    username = data.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    if len(username) > 50:
        raise HTTPException(status_code=400, detail="Username is too long")
    conn = get_db()
    try:
        fields = {"username": username, "target_score": data.target_score}
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
        return {"status": "success", "message": "Profile updated successfully"}
    finally:
        conn.close()

@app.post("/api/profile/exam-date")
def update_exam_date(data: ExamDateUpdate, user=Depends(get_current_user)):
    conn = get_db()
    try:
        conn.execute("UPDATE users SET exam_date = ? WHERE id = ?", (data.exam_date, user["id"]))
        conn.commit()
        return {"status": "success", "exam_date": data.exam_date}
    finally:
        conn.close()

# --- Vocabulary ---
class VocabLearnedUpdate(BaseModel):
    learned: bool

def _set_vocab_level(conn, user_id):
    learned_count = conn.execute(
        "SELECT COUNT(*) AS n FROM vocab_learned WHERE user_id = ?", (user_id,)
    ).fetchone()["n"]
    conn.execute("UPDATE users SET vocab_level = ? WHERE id = ?", (1 + learned_count // 5, user_id))

@app.get("/api/vocab")
def get_vocab(user=Depends(get_current_user)):
    conn = get_db()
    try:
        learned_ids = {row["word_id"] for row in conn.execute(
            "SELECT word_id FROM vocab_learned WHERE user_id = ?", (user["id"],)
        ).fetchall()}
        starred_ids = {row["word_id"] for row in conn.execute(
            "SELECT word_id FROM vocab_starred WHERE user_id = ?", (user["id"],)
        ).fetchall()}
        return [{**w, "learned": w["id"] in learned_ids, "starred": w["id"] in starred_ids} for w in _get_vocab_words()]
    finally:
        conn.close()

@app.post("/api/vocab/toggle/{word_id}")
def toggle_vocab(word_id: int, user=Depends(get_current_user)):
    if not any(w["id"] == word_id for w in _get_vocab_words()):
        return {"status": "error", "message": "Word not found"}
    conn = get_db()
    try:
        already = conn.execute(
            "SELECT 1 FROM vocab_learned WHERE user_id = ? AND word_id = ?", (user["id"], word_id)
        ).fetchone()
        if already:
            conn.execute("DELETE FROM vocab_learned WHERE user_id = ? AND word_id = ?", (user["id"], word_id))
            now_learned = False
        else:
            # ON CONFLICT DO NOTHING: two concurrent toggles (double-tap on a slow connection,
            # a double-invoked click handler) can both read `already = None` before either
            # commits, so the plain INSERT this used to be could raise an unhandled
            # IntegrityError on (user_id, word_id)'s primary key -- there's no global exception
            # handler in this file, so that surfaced as a raw 500. Matches the pattern already
            # used for seen_pool_items below.
            conn.execute(
                "INSERT INTO vocab_learned (user_id, word_id) VALUES (?, ?) "
                "ON CONFLICT(user_id, word_id) DO NOTHING",
                (user["id"], word_id),
            )
            now_learned = True
        _set_vocab_level(conn, user["id"])
        conn.commit()
        return {"status": "success", "learned": now_learned}
    finally:
        conn.close()

# Idempotent set (as opposed to /toggle above) -- used by Flashcard Mode's "I knew it" / "Still
# learning" buttons, which need to assert a specific state rather than flip whatever it currently
# is (the student may re-see the same card more than once in a session).
@app.post("/api/vocab/set/{word_id}")
def set_vocab_learned(word_id: int, data: VocabLearnedUpdate, user=Depends(get_current_user)):
    if not any(w["id"] == word_id for w in _get_vocab_words()):
        return {"status": "error", "message": "Word not found"}
    conn = get_db()
    try:
        if data.learned:
            already = conn.execute(
                "SELECT 1 FROM vocab_learned WHERE user_id = ? AND word_id = ?", (user["id"], word_id)
            ).fetchone()
            if not already:
                # Same concurrent-double-insert race as toggle_vocab above -- guard with
                # ON CONFLICT DO NOTHING instead of a plain INSERT.
                conn.execute(
                    "INSERT INTO vocab_learned (user_id, word_id) VALUES (?, ?) "
                    "ON CONFLICT(user_id, word_id) DO NOTHING",
                    (user["id"], word_id),
                )
        else:
            conn.execute("DELETE FROM vocab_learned WHERE user_id = ? AND word_id = ?", (user["id"], word_id))
        _set_vocab_level(conn, user["id"])
        conn.commit()
        return {"status": "success", "learned": data.learned}
    finally:
        conn.close()

@app.post("/api/vocab/star/{word_id}")
def toggle_vocab_star(word_id: int, user=Depends(get_current_user)):
    if not any(w["id"] == word_id for w in _get_vocab_words()):
        return {"status": "error", "message": "Word not found"}
    conn = get_db()
    try:
        already = conn.execute(
            "SELECT 1 FROM vocab_starred WHERE user_id = ? AND word_id = ?", (user["id"], word_id)
        ).fetchone()
        if already:
            conn.execute("DELETE FROM vocab_starred WHERE user_id = ? AND word_id = ?", (user["id"], word_id))
            now_starred = False
        else:
            # Same concurrent-double-insert race as toggle_vocab above -- guard with
            # ON CONFLICT DO NOTHING instead of a plain INSERT.
            conn.execute(
                "INSERT INTO vocab_starred (user_id, word_id) VALUES (?, ?) "
                "ON CONFLICT(user_id, word_id) DO NOTHING",
                (user["id"], word_id),
            )
            now_starred = True
        conn.commit()
        return {"status": "success", "starred": now_starred}
    finally:
        conn.close()

# --- Reading: Complete the Words ---
@app.get("/api/reading/complete-the-words")
def get_ctw_exercises(user=Depends(get_current_user_optional)):
    data = _cached_pool("ctw", lambda: _load_json_pool(CTW_FILE))
    return gate_pool(data, user)

# --- Reading: Read in Daily Life ---
@app.get("/api/reading/read-in-daily-life")
def get_ridl_passages(user=Depends(get_current_user_optional)):
    data = _cached_pool("ridl", lambda: _load_json_pool(RIDL_FILE))
    return gate_pool(data, user, free_ids=frozenset({_ridl_free_id(data)}))

@app.post("/api/reading/save-result")
def save_ridl_result(data: RIDLResult, user=Depends(get_current_user)):
    if data.score > data.total:
        raise HTTPException(status_code=400, detail="score cannot exceed total")
    pct = round((data.score / data.total) * 100) if data.total > 0 else 0
    conn = get_db()
    try:
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
        return {"status": "success"}
    finally:
        conn.close()

@app.get("/api/reading/results")
def get_ridl_results(user=Depends(get_current_user)):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT passage_id, score, total, pct FROM ridl_results WHERE user_id = ?", (user["id"],)
        ).fetchall()
        return {str(row["passage_id"]): {"score": row["score"], "total": row["total"], "pct": row["pct"]} for row in rows}
    finally:
        conn.close()

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
# TOEFL 2026 format: all four sections (Reading, Listening, Writing, Speaking) are reported on
# the same unified 1.0-6.0 scale. Mirrors SECTION_BAND_MAX in the frontend (App.jsx).
SECTION_BAND_MAX = {
    "reading": 6.0,
    "listening": 6.0,
    "writing": 6.0,
    "speaking": 6.0,
}

def _fetch_category_sums(conn, user_id):
    """One query, one GROUP BY, covering every category a student could have attempts in --
    replaces what compute_section_band used to do with a separate SELECT per category (16 queries
    per /api/dashboard call: 4 sections x ~4 parts each). Found in the 25th audit round: that
    N+1-style pattern held a connection checked out of the DB_POOL_MAX_CONN=10 pool for roughly
    20x longer than a typical single-query endpoint on every single dashboard load (this is a
    high-frequency endpoint -- it refetches on every tab visit, not just once per session), making
    it disproportionately likely to be what exhausts the pool under real concurrent traffic.
    Returns {category: (total_score, total_possible, n)}."""
    rows = conn.execute(
        "SELECT category, SUM(score) AS total_score, SUM(total) AS total_possible, COUNT(*) AS n "
        "FROM attempt_results WHERE user_id = ? GROUP BY category",
        (user_id,),
    ).fetchall()
    return {row["category"]: (row["total_score"], row["total_possible"], row["n"]) for row in rows}

def compute_section_band(category_sums, section):
    """Computes this section's TOEFL-style band (nearest 0.5, on the unified 1.0-6.0 scale) as
    the average of that section's PARTS -- Reading, for example, is Complete the Words, Read in
    Daily Life, Academic Passage, and the Mock Reading module, each its own part. Each part's own
    score is a true question-solved average (SUM of points earned / SUM of points possible across
    every attempt of that part, so a 20-question exercise counts more than a 5-question one
    WITHIN that part). Those part averages are then combined with EQUAL weight across only the
    parts the student has actually attempted -- an untouched part is skipped entirely rather than
    dragging the average down to 0%, so getting a perfect score on the one part you've tried shows
    as a high score right away, even before you've touched the section's other parts.
    Returns 1.0 (the lowest possible band on the TOEFL 1.0-6.0 scale) if the student hasn't
    attempted a single part of this section yet, so an untouched section reads as "not started"
    rather than showing an artificially inflated placeholder score.
    `category_sums` is the dict _fetch_category_sums() returns -- computed once per request and
    shared across all four section calls, rather than each call re-querying the DB itself."""
    cats = SECTION_PRACTICE_CATEGORIES[section] + [SECTION_MOCK_CATEGORY[section]]
    part_pcts = []
    for cat in cats:
        total_score, total_possible, n = category_sums.get(cat, (None, None, 0))
        if n and total_possible:
            part_pcts.append((total_score / total_possible) * 100)

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
    if data.category not in CATEGORY_LABELS:
        raise HTTPException(status_code=400, detail="unknown category")
    if data.score > data.total:
        raise HTTPException(status_code=400, detail="score cannot exceed total")
    pct = round((data.score / data.total) * 100) if data.total > 0 else 0
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO attempt_results (user_id, category, item_id, label, score, total, pct, detail)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user["id"], data.category, data.item_id, data.label, data.score, data.total, pct, data.detail))
        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()

@app.get("/api/results/history")
def get_results_history(category: str = None, limit: int = Query(300, ge=1, le=1000), user=Depends(get_current_user)):
    conn = get_db()
    try:
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
        return [dict(row) for row in rows]
    finally:
        conn.close()

@app.get("/api/results/summary")
def get_results_summary(user=Depends(get_current_user)):
    conn = get_db()
    try:
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
    finally:
        conn.close()

# Category -> which frontend tab/subTab to send the student to so "Review Mistakes" can jump
# them straight to that category's own exercise list, where the missed item already shows its
# score badge and a Retry button (see the sidebar-list screens wired up in App()).
CATEGORY_NAV = {
    "ctw": {"tab": "reading", "subTab": "ctw"},
    "ridl": {"tab": "reading", "subTab": "ridl"},
    "ap": {"tab": "reading", "subTab": "academic"},
    "listening_p1": {"tab": "listening", "subTab": "p1"},
    "listening_p2": {"tab": "listening", "subTab": "p2"},
    "listening_p3": {"tab": "listening", "subTab": "p3"},
    "listening_p4": {"tab": "listening", "subTab": "p4"},
    "bas": {"tab": "writing", "subTab": "p1"},
    "email": {"tab": "writing", "subTab": "p2"},
    "disc": {"tab": "writing", "subTab": "p3"},
    "speaking_lr": {"tab": "speaking", "subTab": "p1"},
    "speaking_interview": {"tab": "speaking", "subTab": "p2"},
}
CATEGORY_SECTION = {
    "ctw": "reading", "ridl": "reading", "ap": "reading",
    "listening_p1": "listening", "listening_p2": "listening", "listening_p3": "listening", "listening_p4": "listening",
    "bas": "writing", "email": "writing", "disc": "writing",
    "speaking_lr": "speaking", "speaking_interview": "speaking",
}

@app.get("/api/results/mistakes")
def get_mistakes(user=Depends(get_current_user)):
    """Returns this student's most recent attempt on every practice item they've ever done
    (across all 12 practice categories -- mock test items are deliberately excluded, since a
    missed mock question isn't a single re-doable exercise the way a practice-pool item is),
    filtered down to only the ones that weren't a perfect score. Grouped by section then
    category so the frontend's "Review Mistakes" screen can show a focused list and send the
    student straight back to that category's exercise list to retry it."""
    categories = list(CATEGORY_NAV.keys())
    placeholders = ",".join("?" for _ in categories)
    conn = get_db()
    try:
        rows = conn.execute(f"""
            SELECT ar.category, ar.item_id, ar.label, ar.pct, ar.saved_at
            FROM attempt_results ar
            JOIN (
                SELECT category, item_id, MAX(id) AS max_id
                FROM attempt_results
                WHERE user_id = ? AND category IN ({placeholders})
                GROUP BY category, item_id
            ) latest ON ar.id = latest.max_id
            WHERE ar.pct < 100
            ORDER BY ar.pct ASC, ar.saved_at DESC
        """, (user["id"], *categories)).fetchall()

        by_category = {}
        for row in rows:
            cat = row["category"]
            entry = by_category.setdefault(cat, {
                "category": cat,
                "label": CATEGORY_LABELS.get(cat, cat),
                "section": CATEGORY_SECTION.get(cat, ""),
                "nav": CATEGORY_NAV.get(cat, {}),
                "items": [],
            })
            entry["items"].append({
                "item_id": row["item_id"],
                "label": row["label"] or f"{CATEGORY_LABELS.get(cat, cat)} #{row['item_id']}",
                "pct": row["pct"],
                "saved_at": row["saved_at"],
            })

        by_section = {}
        for entry in by_category.values():
            by_section.setdefault(entry["section"], []).append(entry)

        total_items = sum(len(e["items"]) for e in by_category.values())
        return {"by_section": by_section, "total_items": total_items}
    finally:
        conn.close()

# --- Reading: Academic Passage ---
@app.get("/api/reading/academic-passage")
def get_academic_passage(user=Depends(get_current_user_optional)):
    # Was `async def` with no `await` inside -- every sibling content-pool endpoint is a plain
    # `def`, which FastAPI runs in a threadpool automatically. As `async def`, a cache-miss (first
    # request after boot, or the ~13-day _cached_pool staleness rebuild) ran its synchronous
    # open()/json.load() directly on the event loop instead of a worker thread, briefly blocking
    # every other concurrent async request. Normalized to match every other pool endpoint.
    json_path = os.path.join(os.path.dirname(__file__), "academic_passage_1.json")
    data = _cached_pool("academic_passage", lambda: _load_json_pool(json_path))
    return gate_pool(data, user)

# --- Full Mock Test: Reading content, kept entirely separate from the practice pools above
# so a student never sees the same question in both practice mode and the mock test. ---
@app.get("/api/mock/complete-the-words")
def get_mock_ctw_exercises(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_ctw", lambda: _load_json_pool(MOCK_CTW_FILE))

@app.get("/api/mock/read-in-daily-life")
def get_mock_ridl_passages(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_ridl", lambda: _load_json_pool(MOCK_RIDL_FILE))

@app.get("/api/mock/academic-passage")
def get_mock_academic_passage(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_ap", lambda: _load_json_pool(MOCK_AP_FILE))

# --- Full Mock Test: Listening content, kept entirely separate from the practice pools below
# so a student never sees the same question in both practice mode and the mock test. ---
@app.get("/api/mock/choose-response")
def get_mock_listening_car(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_listening_car", lambda: _fix_audio_urls(_load_json_pool(MOCK_LISTENING_CAR_FILE)))

@app.get("/api/mock/conversation")
def get_mock_listening_conv(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_listening_conv", lambda: _fix_audio_urls(_load_json_pool(MOCK_LISTENING_CONV_FILE)))

@app.get("/api/mock/announcement")
def get_mock_listening_announce(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_listening_announce", lambda: _fix_audio_urls(_load_json_pool(MOCK_LISTENING_ANNOUNCE_FILE)))

@app.get("/api/mock/academic-talk")
def get_mock_listening_at(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_listening_at", lambda: _fix_audio_urls(_load_json_pool(MOCK_LISTENING_AT_FILE)))

# --- Full Mock Test: Writing content, kept entirely separate from the practice pools below ---
@app.get("/api/mock/build-a-sentence")
def get_mock_bas(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_bas", lambda: _load_json_pool(MOCK_BAS_FILE))

@app.get("/api/mock/email")
def get_mock_email(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_email", lambda: _load_json_pool(MOCK_EMAIL_FILE))

@app.get("/api/mock/academic-discussion")
def get_mock_disc(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_disc", lambda: _load_json_pool(MOCK_DISC_FILE))

# --- Full Mock Test: Speaking content, kept entirely separate from the practice pools below ---
def _build_mock_speaking_lr():
    data = _load_json_pool(MOCK_SPEAKING_LR_FILE)
    for s in data:
        s["audio_url_intro"] = _audio_url(f"mock_speaking_lr/{s['id']}/intro.mp3")
        for sent in s["sentences"]:
            sent["audio_url"] = _audio_url(f"mock_speaking_lr/{s['id']}/{sent['id']}.mp3")
    return data

@app.get("/api/mock/listen-and-repeat")
def get_mock_speaking_lr(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_speaking_lr", _build_mock_speaking_lr)

def _build_mock_speaking_interview():
    data = _load_json_pool(MOCK_SPEAKING_INTERVIEW_FILE)
    for s in data:
        s["audio_url_intro"] = _audio_url(f"mock_speaking_interview/{s['id']}/intro.mp3")
        for q in s["questions"]:
            q["audio_url"] = _audio_url(f"mock_speaking_interview/{s['id']}/{q['id']}.mp3")
    return data

@app.get("/api/mock/interview")
def get_mock_speaking_interview(user=Depends(get_current_user_optional)):
    require_premium_pool(user)
    return _cached_pool("mock_speaking_interview", _build_mock_speaking_interview)

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
    data = _cached_pool(f"mock_pool_ids_raw:{pool}", lambda: _load_json_pool(path))
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
    try:
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
        return result
    finally:
        conn.close()

class MarkSeenRequest(BaseModel):
    pool: str = Field(max_length=50)
    # The handler already slices this to [:200] before use, but that happened after Pydantic had
    # fully parsed the list -- bounding it here rejects an oversized request before that work
    # happens. Per-item length capped to match AttemptResult.item_id's bound (real ids are short
    # pool-relative identifiers); an unconstrained item_id string here would otherwise let a
    # logged-in user grow seen_pool_items with values far larger than any real item id needs.
    item_ids: List[str] = Field(max_length=200)

    @field_validator("item_ids")
    @classmethod
    def _bound_item_id_length(cls, v):
        for item_id in v:
            if len(item_id) > 100:
                raise ValueError("item_id too long")
        return v

@app.post("/api/mock/mark-seen")
def mark_mock_seen(data: MarkSeenRequest, user=Depends(get_current_user)):
    """Called right after a dynamic Full Mock Test or single-section practice drill draws its
    questions (not after the student finishes them) -- being shown a question is what should stop
    it from repeating, whether or not the student actually answers it before saving & exiting."""
    if data.pool not in MOCK_POOL_FILES or not data.item_ids:
        return {"status": "success"}
    # A real draw is at most a couple dozen items -- cap well above that so a malformed/forged
    # request can't tie up a pooled DB connection for an extended one-row-at-a-time INSERT loop
    # (with only DB_POOL_MAX_CONN=10 connections total, a handful of oversized requests in flight
    # at once could starve the pool for every other student, the same 503 symptom as a genuine
    # leak).
    item_ids = data.item_ids[:200]
    conn = get_db()
    try:
        # Batched into a single multi-row INSERT instead of looping conn.execute() once per item
        # -- found in the 28th audit round: a single account can legitimately call this endpoint
        # up to API_THROTTLE_MAX times per API_THROTTLE_WINDOW_SECONDS, each with up to 200 items,
        # which meant up to thousands of sequential single-row round trips per window, all held on
        # one checked-out connection out of the fixed DB_POOL_MAX_CONN=10 pool -- exactly the
        # N+1/pool-exhaustion pattern the rest of this file (e.g. _fetch_category_sums) was written
        # to avoid elsewhere. ON CONFLICT applies per-row regardless of how many rows are in one
        # VALUES clause, so behavior is unchanged -- just one round trip instead of up to 200.
        placeholders = ", ".join(["(?, ?, ?)"] * len(item_ids))
        flat_params = []
        for item_id in item_ids:
            flat_params.extend([user["id"], data.pool, str(item_id)])
        conn.execute(
            f"INSERT INTO seen_pool_items (user_id, pool, item_id) VALUES {placeholders} "
            "ON CONFLICT(user_id, pool, item_id) DO NOTHING",
            flat_params,
        )
        conn.commit()
        return {"status": "success"}
    finally:
        conn.close()

def _build_fixed_test(path):
    data = _load_json_pool(path)
    # The two Speaking items were saved without audio_url (same as mock_speaking_lr/interview
    # above) since their mp3s live under the ORIGINAL shared pool's id-keyed folders — inject
    # the URLs here exactly like the dynamic-pool endpoints do.
    lr = data["speaking"]["lr"]
    lr["audio_url_intro"] = _audio_url(f"mock_speaking_lr/{lr['id']}/intro.mp3")
    for sent in lr["sentences"]:
        sent["audio_url"] = _audio_url(f"mock_speaking_lr/{lr['id']}/{sent['id']}.mp3")
    interview = data["speaking"]["interview"]
    interview["audio_url_intro"] = _audio_url(f"mock_speaking_interview/{interview['id']}/intro.mp3")
    for q in interview["questions"]:
        q["audio_url"] = _audio_url(f"mock_speaking_interview/{interview['id']}/{q['id']}.mp3")
    data["listening"] = _fix_audio_urls(data["listening"])
    return data

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
    return _cached_pool(f"fixed_test:{test_id}", lambda: _build_fixed_test(path))

# --- Listening ---
@app.get("/api/listening/choose-response")
def get_listening_p1(user=Depends(get_current_user_optional)):
    data = _cached_pool("listening_p1", lambda: _fix_audio_urls(_load_json_pool(LISTENING_P1_FILE)))
    return gate_pool(data, user)

@app.get("/api/listening/conversation")
def get_listening_p2(user=Depends(get_current_user_optional)):
    data = _cached_pool("listening_p2", lambda: _fix_audio_urls(_load_json_pool(LISTENING_P2_FILE)))
    return gate_pool(data, user)

@app.get("/api/listening/announcement")
def get_listening_p3(user=Depends(get_current_user_optional)):
    data = _cached_pool("listening_p3", lambda: _fix_audio_urls(_load_json_pool(LISTENING_P3_FILE)))
    return gate_pool(data, user)

@app.get("/api/listening/academic-talk")
def get_listening_p4(user=Depends(get_current_user_optional)):
    data = _cached_pool("listening_p4", lambda: _fix_audio_urls(_load_json_pool(LISTENING_P4_FILE)))
    return gate_pool(data, user)

# --- Writing: Build a Sentence ---
@app.get("/api/writing/build-a-sentence")
def get_build_a_sentence(user=Depends(get_current_user_optional)):
    # The frontend groups raw items into practice "sets" of BUILD_SENTENCE_SET_SIZE (10, kept in
    # sync with the constant of the same name in App.jsx) -- a non-subscriber needs the WHOLE
    # first set free, not just item id 1, or Set 1 would be a broken mix of 1 real item + 9 locked
    # stubs.
    data = _cached_pool("build_a_sentence", lambda: _load_json_pool(BUILD_A_SENTENCE_FILE))
    return gate_pool(data, user, free_ids=frozenset(range(1, 11)))

# --- Writing: Email (JSON tabanlı liste, tüm pratikler) ---
@app.get("/api/writing/email")
def get_write_email_list(user=Depends(get_current_user_optional)):
    data = _cached_pool("write_email", lambda: _load_json_pool(WRITE_EMAIL_FILE))
    return gate_pool(data, user)

# --- Writing: Academic Discussion ---
@app.get("/api/writing/academic-discussion")
def get_academic_discussion_list(user=Depends(get_current_user_optional)):
    data = _cached_pool("write_discussion", lambda: _load_json_pool(WRITE_DISCUSSION_FILE))
    return gate_pool(data, user)

def _build_speaking_lr():
    data = _load_json_pool(SPEAKING_LR_FILE)
    for s in data:
        s["audio_url_intro"] = _audio_url(f"speaking_lr/{s['id']}/intro.mp3")
        for sent in s["sentences"]:
            sent["audio_url"] = _audio_url(f"speaking_lr/{s['id']}/{sent['id']}.mp3")
    return data

# --- Speaking: Listen and Repeat ---
@app.get("/api/speaking/listen-and-repeat")
def get_speaking_listen_repeat(user=Depends(get_current_user_optional)):
    data = _cached_pool("speaking_lr", _build_speaking_lr)
    return gate_pool(data, user)

def _build_speaking_interview():
    data = _load_json_pool(SPEAKING_INTERVIEW_FILE)
    for s in data:
        s["audio_url_intro"] = _audio_url(f"speaking_interview/{s['id']}/intro.mp3")
        for q in s["questions"]:
            q["audio_url"] = _audio_url(f"speaking_interview/{s['id']}/{q['id']}.mp3")
    return data

# --- Speaking: Take an Interview ---
@app.get("/api/speaking/interview")
def get_speaking_interview(user=Depends(get_current_user_optional)):
    data = _cached_pool("speaking_interview", _build_speaking_interview)
    return gate_pool(data, user)

