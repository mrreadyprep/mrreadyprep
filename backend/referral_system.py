# Referral Program System
import os
import jwt
from datetime import datetime, timedelta
import psycopg2
from functools import wraps

db_conn = psycopg2.connect(os.getenv('DATABASE_URL'))

class ReferralSystem:
    REFERRAL_CREDIT = 5.0  # $5 per referral
    REFERRED_DISCOUNT = 0.5  # 50% off first month
    REFERRAL_VALIDITY = 30  # Days for referred user to upgrade
    
    def __init__(self):
        self.db = db_conn
    
    @staticmethod
    def generate_referral_link(user_id):
        """Generate unique referral link"""
        return f"https://mrreadyprep.com/?ref={user_id}"
    
    @staticmethod
    def track_referral_click(referrer_id):
        """Track when someone clicks a referral link"""
        cursor = db_conn.cursor()
        try:
            cursor.execute(
                '''
                INSERT INTO referral_clicks (referrer_id, clicked_at)
                VALUES (%s, NOW())
                ''',
                (referrer_id,)
            )
            db_conn.commit()
        except Exception as e:
            print(f"Click tracking error: {e}")
        finally:
            cursor.close()
    
    @staticmethod
    def complete_referral(referrer_id, referred_user_id):
        """Complete referral when referred user upgrades"""
        cursor = db_conn.cursor()
        try:
            # Check if referral is valid (within 30 days)
            cursor.execute(
                '''
                SELECT clicked_at FROM referral_clicks 
                WHERE referrer_id = %s AND referred_user_id IS NULL
                ORDER BY clicked_at DESC LIMIT 1
                ''',
                (referrer_id,)
            )
            result = cursor.fetchone()
            
            if not result:
                return {'error': 'No valid referral found'}
            
            click_time = result[0]
            if (datetime.now() - click_time).days > 30:
                return {'error': 'Referral expired'}
            
            # Award $5 credit to referrer
            cursor.execute(
                '''
                UPDATE users SET referral_credits = referral_credits + %s
                WHERE id = %s
                ''',
                (ReferralSystem.REFERRAL_CREDIT, referrer_id)
            )
            
            # Mark referral as complete
            cursor.execute(
                '''
                INSERT INTO referral_completions 
                (referrer_id, referred_user_id, completed_at)
                VALUES (%s, %s, NOW())
                ''',
                (referrer_id, referred_user_id)
            )
            
            # Track the referral click as used
            cursor.execute(
                '''
                UPDATE referral_clicks 
                SET referred_user_id = %s 
                WHERE referrer_id = %s AND referred_user_id IS NULL
                ORDER BY clicked_at DESC LIMIT 1
                ''',
                (referred_user_id, referrer_id)
            )
            
            db_conn.commit()
            
            return {
                'success': True,
                'credit_awarded': ReferralSystem.REFERRAL_CREDIT
            }
        except Exception as e:
            db_conn.rollback()
            return {'error': str(e)}
        finally:
            cursor.close()
    
    @staticmethod
    def apply_referral_discount(user_id):
        """Check if user gets referral discount"""
        cursor = db_conn.cursor()
        try:
            cursor.execute(
                '''
                SELECT referrer_id FROM referral_clicks
                WHERE referred_user_id = %s LIMIT 1
                ''',
                (user_id,)
            )
            result = cursor.fetchone()
            return result is not None
        finally:
            cursor.close()
    
    @staticmethod
    def get_referral_stats(user_id):
        """Get referral stats for a user"""
        cursor = db_conn.cursor()
        try:
            cursor.execute(
                '''
                SELECT 
                    COUNT(*) as total_referrals,
                    SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed,
                    COALESCE(SUM(CASE WHEN completed_at IS NOT NULL THEN %s ELSE 0 END), 0) as earnings
                FROM referral_clicks
                WHERE referrer_id = %s
                ''',
                (ReferralSystem.REFERRAL_CREDIT, user_id)
            )
            result = cursor.fetchone()
            
            if result:
                return {
                    'total_invites': result[0],
                    'completed_referrals': result[1],
                    'total_earnings': float(result[2])
                }
            return {'total_invites': 0, 'completed_referrals': 0, 'total_earnings': 0}
        finally:
            cursor.close()
    
    @staticmethod
    def get_leaderboard(limit=10):
        """Get referral leaderboard"""
        cursor = db_conn.cursor()
        try:
            cursor.execute(
                '''
                SELECT 
                    u.id,
                    u.username,
                    COUNT(*) as referrals,
                    COALESCE(SUM(CASE WHEN rc.completed_at IS NOT NULL THEN 1 ELSE 0 END), 0) as completed,
                    COALESCE(SUM(CASE WHEN rc.completed_at IS NOT NULL THEN %s ELSE 0 END), 0) as earnings
                FROM users u
                LEFT JOIN referral_clicks rc ON u.id = rc.referrer_id
                GROUP BY u.id, u.username
                HAVING COUNT(*) > 0
                ORDER BY earnings DESC
                LIMIT %s
                ''',
                (ReferralSystem.REFERRAL_CREDIT, limit)
            )
            results = cursor.fetchall()
            
            return [
                {
                    'rank': i + 1,
                    'user_id': r[0],
                    'username': r[1],
                    'referrals': r[2],
                    'completed': r[3],
                    'earnings': float(r[4])
                }
                for i, r in enumerate(results)
            ]
        finally:
            cursor.close()

# Database schema migrations
SCHEMA_SQL = '''
-- Create referral tables if they don't exist
CREATE TABLE IF NOT EXISTS referral_clicks (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL,
    referred_user_id INTEGER,
    clicked_at TIMESTAMP NOT NULL,
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referral_completions (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL,
    referred_user_id INTEGER NOT NULL,
    completed_at TIMESTAMP NOT NULL,
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

-- Add referral_credits column to users if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_credits FLOAT DEFAULT 0;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer ON referral_clicks(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referred ON referral_clicks(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_completions_referrer ON referral_completions(referrer_id);
'''

def init_referral_schema():
    """Initialize referral tables"""
    cursor = db_conn.cursor()
    try:
        cursor.execute(SCHEMA_SQL)
        db_conn.commit()
        print("✅ Referral schema initialized")
    except Exception as e:
        print(f"Schema init error: {e}")
        db_conn.rollback()
    finally:
        cursor.close()

if __name__ == '__main__':
    init_referral_schema()
