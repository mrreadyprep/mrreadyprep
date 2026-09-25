# Flask Routes for Extensions 2-6
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import jwt
import os
from functools import wraps

# Import extension systems
from email_service import send_email, send_campaign_emails
from referral_system import ReferralSystem
from seo_monitor import SEOMonitor

bp = Blueprint('extensions', __name__)

# Authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Unauthorized'}), 401
        
        try:
            payload = jwt.decode(token, os.getenv('SECRET_KEY'), algorithms=['HS256'])
            request.user_id = payload['user_id']
        except:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated

# ============ EXTENSION 2: EMAIL CAMPAIGNS ============

@bp.route('/api/emails/send-campaign', methods=['POST'])
@token_required
def trigger_email_campaign():
    """Trigger email campaign for authenticated user"""
    send_campaign_emails()
    return jsonify({'status': 'campaign_triggered'}), 200

@bp.route('/api/emails/test', methods=['POST'])
@token_required
def send_test_email():
    """Send test email to user's address"""
    data = request.get_json()
    template = data.get('template', 'welcome')
    
    # Get user email
    cursor = db.cursor()
    cursor.execute('SELECT email FROM users WHERE id = %s', (request.user_id,))
    user = cursor.fetchone()
    cursor.close()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    success = send_email(user[0], template)
    if success:
        return jsonify({'status': 'email_sent'}), 200
    return jsonify({'error': 'Failed to send email'}), 500

# ============ EXTENSION 3: ANALYTICS ============

@bp.route('/api/analytics/events', methods=['POST'])
@token_required
def log_analytics_event():
    """Log custom analytics event"""
    data = request.get_json()
    event_name = data.get('event_name')
    event_params = data.get('event_params', {})
    
    # Store in database for backup
    cursor = db.cursor()
    cursor.execute(
        '''
        INSERT INTO analytics_events (user_id, event_name, event_params, logged_at)
        VALUES (%s, %s, %s, NOW())
        ''',
        (request.user_id, event_name, json.dumps(event_params))
    )
    db.commit()
    cursor.close()
    
    return jsonify({'status': 'logged'}), 200

@bp.route('/api/analytics/dashboard', methods=['GET'])
@token_required
def get_analytics_dashboard():
    """Get analytics dashboard data for admin"""
    if not is_admin(request.user_id):
        return jsonify({'error': 'Forbidden'}), 403
    
    cursor = db.cursor()
    
    # Get signup trend (last 30 days)
    cursor.execute(
        '''
        SELECT DATE(created_at) as date, COUNT(*) as signups
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date
        '''
    )
    signup_trend = cursor.fetchall()
    
    # Get conversion funnel
    cursor.execute(
        '''
        SELECT 
            COUNT(*) as total_users,
            SUM(CASE WHEN is_premium THEN 1 ELSE 0 END) as premium_users,
            ROUND(100.0 * SUM(CASE WHEN is_premium THEN 1 ELSE 0 END) / COUNT(*), 2) as conversion_rate
        FROM users
        '''
    )
    funnel = cursor.fetchone()
    
    cursor.close()
    
    return jsonify({
        'signup_trend': [
            {'date': str(row[0]), 'signups': row[1]}
            for row in signup_trend
        ],
        'funnel': {
            'total_users': funnel[0],
            'premium_users': funnel[1],
            'conversion_rate': funnel[2]
        }
    }), 200

# ============ EXTENSION 4: SEO MONITORING ============

@bp.route('/api/seo/metrics', methods=['GET'])
@token_required
def get_seo_metrics():
    """Get SEO metrics (admin only)"""
    if not is_admin(request.user_id):
        return jsonify({'error': 'Forbidden'}), 403
    
    cursor = db.cursor()
    cursor.execute(
        '''
        SELECT * FROM seo_metrics
        ORDER BY date DESC
        LIMIT 28
        '''
    )
    
    metrics = []
    for row in cursor.fetchall():
        metrics.append({
            'date': row[1].isoformat(),
            'clicks': row[2],
            'impressions': row[3],
            'avg_ctr': row[4],
            'avg_position': row[5]
        })
    
    cursor.close()
    return jsonify({'metrics': metrics}), 200

@bp.route('/api/seo/keywords', methods=['GET'])
@token_required
def get_keyword_rankings():
    """Get keyword rankings (admin only)"""
    if not is_admin(request.user_id):
        return jsonify({'error': 'Forbidden'}), 403
    
    cursor = db.cursor()
    cursor.execute(
        '''
        SELECT keyword, rank, checked_at
        FROM keyword_rankings
        WHERE checked_at >= NOW() - INTERVAL '7 days'
        ORDER BY keyword, checked_at DESC
        '''
    )
    
    rankings = {}
    for row in cursor.fetchall():
        keyword = row[0]
        if keyword not in rankings:
            rankings[keyword] = []
        rankings[keyword].append({
            'rank': row[1],
            'date': row[2].isoformat()
        })
    
    cursor.close()
    return jsonify({'rankings': rankings}), 200

@bp.route('/api/seo/run-monitor', methods=['POST'])
@token_required
def run_seo_monitor():
    """Run SEO monitoring (admin only)"""
    if not is_admin(request.user_id):
        return jsonify({'error': 'Forbidden'}), 403
    
    try:
        monitor = SEOMonitor()
        monitor.run_all_checks()
        return jsonify({'status': 'monitoring_complete'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============ EXTENSION 5: VIDEO ============

@bp.route('/api/videos/schedule', methods=['GET'])
@token_required
def get_video_schedule():
    """Get video publishing schedule"""
    cursor = db.cursor()
    cursor.execute(
        '''
        SELECT schedule_json FROM video_schedule
        WHERE month = %s
        ''',
        (datetime.now().strftime('%Y-%m'),)
    )
    
    result = cursor.fetchone()
    cursor.close()
    
    if result:
        return jsonify(json.loads(result[0])), 200
    return jsonify({'schedule': []}), 200

# ============ EXTENSION 6: REFERRAL PROGRAM ============

@bp.route('/api/referral/track', methods=['POST'])
def track_referral():
    """Track referral link click"""
    ref_id = request.args.get('ref')
    if ref_id:
        ReferralSystem.track_referral_click(ref_id)
    return jsonify({'status': 'tracked'}), 200

@bp.route('/api/referral/stats', methods=['GET'])
@token_required
def get_referral_stats():
    """Get referral stats for user"""
    stats = ReferralSystem.get_referral_stats(request.user_id)
    return jsonify(stats), 200

@bp.route('/api/referral/complete', methods=['POST'])
@token_required
def complete_referral():
    """Complete referral (called when referred user upgrades)"""
    data = request.get_json()
    referrer_id = data.get('referrer_id')
    
    result = ReferralSystem.complete_referral(referrer_id, request.user_id)
    if 'error' in result:
        return jsonify(result), 400
    
    return jsonify(result), 200

@bp.route('/api/referral/leaderboard', methods=['GET'])
def get_leaderboard():
    """Get referral leaderboard"""
    leaderboard = ReferralSystem.get_leaderboard(limit=10)
    return jsonify({'leaderboard': leaderboard}), 200

@bp.route('/api/referral/apply-discount', methods=['POST'])
def apply_referral_discount():
    """Check if user gets referral discount"""
    data = request.get_json()
    user_id = data.get('user_id')
    
    has_discount = ReferralSystem.apply_referral_discount(user_id)
    return jsonify({
        'eligible': has_discount,
        'discount_percent': 50 if has_discount else 0
    }), 200

# ============ HELPERS ============

def is_admin(user_id):
    """Check if user is admin"""
    cursor = db.cursor()
    cursor.execute('SELECT is_admin FROM users WHERE id = %s', (user_id,))
    result = cursor.fetchone()
    cursor.close()
    return result and result[0]

# Register blueprint
def register_extension_routes(app):
    app.register_blueprint(bp)
