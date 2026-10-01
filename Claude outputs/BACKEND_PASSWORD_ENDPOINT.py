# Backend Addition: Password Change Endpoint
# Add this to backend/main.py after the login/reset-password endpoints

# Location: Add around line 3500 (after password reset endpoint)

@app.post("/api/auth/change-password")
def change_password(request_data, user=Depends(get_current_user)):
    """
    Authenticated endpoint for users to change their password.

    Request body:
    {
      "current_password": "old_password",
      "new_password": "new_password_min_8_chars"
    }

    Returns:
    {
      "status": "success",
      "message": "Password changed successfully"
    }
    """

    # Validate input
    current_password = request_data.get('current_password', '').strip()
    new_password = request_data.get('new_password', '').strip()

    if not current_password:
        raise HTTPException(status_code=400, detail="Current password is required")

    if not new_password:
        raise HTTPException(status_code=400, detail="New password is required")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if current_password == new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")

    # Verify current password
    conn = get_db()
    try:
        user_record = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user["id"],)).fetchone()

        if not user_record:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if current password is correct
        if not verify_password(current_password, user_record["password_hash"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

        # Hash new password
        new_password_hash = hash_password(new_password)

        # Update password in database
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (new_password_hash, user["id"])
        )
        conn.commit()

        return {
            "status": "success",
            "message": "Password changed successfully. You may need to log in again."
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[password change] Error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Failed to change password")
    finally:
        conn.close()


# ─── HELPER: Onboarding completion endpoint ────────────────────────────────

@app.post("/api/user/onboarding-complete")
def mark_onboarding_complete(user=Depends(get_current_user)):
    """
    Mark onboarding as completed for the user.

    Returns:
    {
      "status": "success",
      "message": "Onboarding marked as completed"
    }
    """
    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET onboarding_completed = 1 WHERE id = ?",
            (user["id"],)
        )
        conn.commit()
        return {"status": "success", "message": "Onboarding marked as completed"}
    except Exception as e:
        print(f"[onboarding complete] Error: {e}", flush=True)
        raise HTTPException(status_code=500, detail="Failed to update onboarding status")
    finally:
        conn.close()


# ─── SCHEMA UPDATES ──────────────────────────────────────────────────────

# Run these migration commands in your database to add onboarding_completed column:

"""
-- SQLite (local dev)
ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;

-- PostgreSQL (production)
ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- MySQL
ALTER TABLE users ADD COLUMN onboarding_completed TINYINT NOT NULL DEFAULT 0;
"""

# To apply this programmatically (like other migrations in main.py):

def _ensure_onboarding_column():
    """Ensure onboarding_completed column exists in users table."""
    conn = get_db()
    try:
        if not _has_column(conn, "users", "onboarding_completed"):
            if DATABASE_URL:
                # PostgreSQL
                conn.execute("ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE")
            else:
                # SQLite
                conn.execute("ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0")
            conn.commit()
            print("[migration] Added onboarding_completed column to users", flush=True)
    except Exception as e:
        print(f"[migration] Could not add onboarding_completed column: {e}", flush=True)
    finally:
        conn.close()

# Call this in app startup:
# Add to the existing startup code (around line 2000 in main.py)
# _ensure_onboarding_column()


# ─── TESTING THESE ENDPOINTS ──────────────────────────────────────────────

"""
# Test password change endpoint:

curl -X POST http://localhost:8000/api/auth/change-password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "OldPassword123!",
    "new_password": "NewPassword456!"
  }'

# Test onboarding complete endpoint:

curl -X POST http://localhost:8000/api/user/onboarding-complete \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected responses:

# Success (200):
{
  "status": "success",
  "message": "Password changed successfully. You may need to log in again."
}

# Error - wrong password (401):
{
  "detail": "Current password is incorrect"
}

# Error - weak password (400):
{
  "detail": "Password must be at least 8 characters"
}
"""


# ─── ERROR HANDLING PATTERNS ──────────────────────────────────────────────

"""
HTTP Status Codes Used:
- 200: Success
- 400: Bad request (validation failed)
- 401: Unauthorized (wrong password)
- 404: Not found (user)
- 500: Server error

All endpoints follow the existing error handling pattern in main.py with
try/catch, logging, and proper HTTPException responses.
"""
