# Backend: User Reviews Endpoint (Sketch)
# Add to main.py after auth endpoints

# ─── Database Schema ─────
# CREATE TABLE IF NOT EXISTS user_reviews (
#   id INTEGER PRIMARY KEY,
#   user_id INTEGER NOT NULL,
#   rating INTEGER NOT NULL (1-5),
#   title TEXT,
#   review_text TEXT,
#   course TEXT (all_sections, reading, listening, writing, speaking, mocks),
#   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
#   FOREIGN KEY(user_id) REFERENCES users(id),
#   UNIQUE(user_id, course)
# );

from pydantic import BaseModel

class SubmitReviewRequest(BaseModel):
    rating: int = Field(1, ge=1, le=5)
    title: str = Field(..., max_length=100)
    review_text: str = Field(..., max_length=2000)
    course: str = Field("all_sections")  # all_sections, reading, listening, writing, speaking, mocks

@app.post("/api/reviews/submit")
def submit_review(req: SubmitReviewRequest, auth_header: str = Header(None)):
    """Submit or update a user review"""
    try:
        user_id = authenticate(auth_header)

        conn = get_db()
        cursor = conn.cursor()

        # Upsert: update if exists, insert if not
        cursor.execute("""
            INSERT INTO user_reviews (user_id, rating, title, review_text, course, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(user_id, course) DO UPDATE SET
                rating = excluded.rating,
                title = excluded.title,
                review_text = excluded.review_text,
                updated_at = datetime('now')
        """, (user_id, req.rating, req.title, req.review_text, req.course))

        conn.commit()
        return {"status": "success", "message": "Review submitted"}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500
    finally:
        conn.close()

@app.get("/api/reviews/list")
def list_reviews(course: str = "all_sections", limit: int = 50):
    """Get top reviews for display (public)"""
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT rating, title, review_text, created_at
            FROM user_reviews
            WHERE course = ? AND rating >= 4
            ORDER BY created_at DESC
            LIMIT ?
        """, (course, limit))

        reviews = []
        for row in cursor.fetchall():
            reviews.append({
                "rating": row[0],
                "title": row[1],
                "text": row[2],
                "date": row[3]
            })

        # Calculate aggregate rating
        cursor.execute("""
            SELECT AVG(rating), COUNT(*) FROM user_reviews WHERE course = ?
        """, (course,))
        avg_rating, count = cursor.fetchone()

        return {
            "reviews": reviews,
            "average_rating": round(avg_rating, 1) if avg_rating else 0,
            "total_reviews": count
        }
    except Exception as e:
        return {"error": str(e)}, 500
    finally:
        conn.close()

@app.get("/api/reviews/stats")
def get_review_stats():
    """Get review statistics for display"""
    try:
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT
                ROUND(AVG(rating), 1),
                COUNT(*),
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END),
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)
            FROM user_reviews
        """)

        avg_rating, total, five_star, four_star = cursor.fetchone()

        return {
            "average_rating": avg_rating or 0,
            "total_reviews": total or 0,
            "five_star_count": five_star or 0,
            "four_star_count": four_star or 0,
            "display_text": f"⭐ {avg_rating or 0}/5 from {total or 0}+ students"
        }
    except Exception as e:
        return {"error": str(e)}, 500
    finally:
        conn.close()
