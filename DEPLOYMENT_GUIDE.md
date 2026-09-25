# Deployment Guide: Extensions 2-6

Complete setup instructions for Email, Analytics, SEO Monitoring, Video, and Referral systems.

---

## EXTENSION 2: Email Nurture Sequence

### 1. SendGrid Setup

```bash
# Install SendGrid
pip install sendgrid --break-system-packages

# Get API key from sendgrid.com
# Add to .env
echo "SENDGRID_API_KEY=SG.xxx" >> .env
```

### 2. Database Schema

```sql
-- Email campaign tracking (optional, for analytics)
CREATE TABLE IF NOT EXISTS email_campaigns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    template_key VARCHAR(50),
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_email_sent_at ON email_campaigns(sent_at);
```

### 3. Schedule Email Campaigns

**Option A: Celery (Production)**
```python
# Add to celery_tasks.py
from celery import shared_task
from email_service import send_campaign_emails

@shared_task
def send_daily_emails():
    send_campaign_emails()
    return "Email campaign sent"

# In celery beat schedule (every day at 9 AM UTC)
CELERY_BEAT_SCHEDULE = {
    'send-daily-emails': {
        'task': 'celery_tasks.send_daily_emails',
        'schedule': crontab(hour=9, minute=0),
    },
}
```

**Option B: Cron (Simple)**
```bash
# Add to crontab
# Every day at 9 AM
0 9 * * * cd /path/to/mrreadyprep && python backend/email_service.py
```

### 4. Test Email

```bash
curl -X POST http://localhost:8000/api/emails/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template": "welcome"}'
```

---

## EXTENSION 3: Analytics & Tracking (GA4)

### 1. Firebase Setup

```bash
# Create Firebase project at console.firebase.google.com
# Download credentials JSON

# Add to .env
VITE_GA_API_KEY=xxx
VITE_GA_AUTH_DOMAIN=xxx
VITE_GA_PROJECT_ID=xxx
VITE_GA_STORAGE_BUCKET=xxx
VITE_GA_SENDER_ID=xxx
VITE_GA_APP_ID=xxx
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 2. Vite Config

```javascript
// vite.config.js - already configured
// Environment variables loaded from .env files

// Make sure App.jsx imports analytics
import { initPageTracking } from './utils/analytics'

// In useEffect:
useEffect(() => {
  initPageTracking()
}, [])
```

### 3. Track Events in Components

```jsx
import { trackingEvents } from '../utils/analytics'

// In your components:
function PracticeScreen() {
  useEffect(() => {
    trackingEvents.practiceStart('reading')
    return () => {
      trackingEvents.practiceComplete('reading', score, questions)
    }
  }, [])
}
```

### 4. View Analytics Dashboard

```
1. Go to firebase.google.com
2. Select your project
3. Analytics > Realtime to see live events
4. Analytics > Dashboard for trends
5. Analytics > Events for custom event data
```

### 5. Create GA4 Conversion Goals

In Firebase Console:
- Go to Analytics > Events
- Click "Create conversion event"
- Select: `upgrade_start`, `purchase`, `mock_test_submit`

---

## EXTENSION 4: SEO Monitoring

### 1. Google Search Console Setup

```bash
# Create service account at console.cloud.google.com
# Download JSON key file to gsc-credentials.json

# Enable Search Console API
# Add site at search.google.com/search-console

# Verify ownership and get GSC access
```

### 2. SerpAPI Setup (Keyword Tracking)

```bash
# Get API key from serpapi.com
echo "SERPAPI_API_KEY=xxx" >> .env
```

### 3. Database Schema

```sql
CREATE TABLE IF NOT EXISTS seo_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    clicks INTEGER,
    impressions INTEGER,
    avg_ctr FLOAT,
    avg_position FLOAT,
    top_queries JSONB
);

CREATE TABLE IF NOT EXISTS keyword_rankings (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL,
    rank INTEGER,
    checked_at TIMESTAMP,
    UNIQUE(keyword, DATE(checked_at))
);

CREATE TABLE IF NOT EXISTS backlink_sources (
    id SERIAL PRIMARY KEY,
    source_domain VARCHAR(100),
    source_name VARCHAR(100),
    checked_at TIMESTAMP
);

CREATE INDEX idx_seo_metrics_date ON seo_metrics(date);
CREATE INDEX idx_keyword_rankings_keyword ON keyword_rankings(keyword);
```

### 4. Schedule SEO Monitoring

**Daily monitoring via cron:**
```bash
# Add to crontab - Run at 2 AM UTC daily
0 2 * * * cd /path/to/mrreadyprep && python backend/seo_monitor.py
```

Or via Flask command:
```bash
# Add to backend/main.py CLI commands
@app.cli.command()
def monitor_seo():
    monitor = SEOMonitor()
    monitor.run_all_checks()

# Run: flask monitor-seo
```

### 5. View SEO Metrics

```bash
# API endpoint (admin only)
curl -X GET http://localhost:8000/api/seo/metrics \
  -H "Authorization: Bearer ADMIN_TOKEN"

# API endpoint for keywords
curl -X GET http://localhost:8000/api/seo/keywords \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## EXTENSION 5: Video Content Strategy

### 1. YouTube API Setup

```bash
# Create OAuth 2.0 credentials at console.cloud.google.com
# Download as youtube_credentials.json

# Install
pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client --break-system-packages

# First run will open browser for auth
python backend/video_content.py
# This creates youtube_token.json (keep it safe!)
```

### 2. Create YouTube Playlist

```bash
# Manually in YouTube Studio
# Create playlists:
# - "TOEFL Demo Videos"
# - "TOEFL Tutorials"
# - "Student Success Stories"

# Get playlist IDs from URL
# https://youtube.com/playlist?list=PLxxxxxxxxxxxxxx
#                                        ^ this is the ID
```

### 3. Database Schema

```sql
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(100) UNIQUE,
    title VARCHAR(200),
    youtube_url VARCHAR(200),
    uploaded_at TIMESTAMP,
    status VARCHAR(50),
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    engagement_rate FLOAT
);

CREATE TABLE IF NOT EXISTS video_schedule (
    id SERIAL PRIMARY KEY,
    month VARCHAR(7),
    schedule_json JSONB,
    UNIQUE(month)
);

CREATE INDEX idx_videos_uploaded ON videos(uploaded_at);
```

### 4. Upload Videos

```python
from backend.video_content import VideoContentManager

manager = VideoContentManager()

# Upload a video
manager.upload_video(
    file_path='demo_video.mp4',
    title='How mrreadyprep Adaptive Practice Works',
    description='...',
    tags=['TOEFL', 'practice', 'adaptive'],
    playlist_id='PLxxxxxxxxxxxxxx'
)

manager.close()
```

### 5. Monitor Performance

```bash
# API to get video performance
curl -X GET http://localhost:8000/api/videos/schedule \
  -H "Authorization: Bearer TOKEN"
```

---

## EXTENSION 6: Referral Program

### 1. Database Schema

```bash
# Already in referral_system.py
python backend/referral_system.py
# This creates tables automatically
```

Manually if needed:
```sql
-- Already created by init_referral_schema()
-- Verify with:
SELECT * FROM information_schema.tables 
WHERE table_name IN ('referral_clicks', 'referral_completions');
```

### 2. Register Routes

Add to `backend/main.py`:
```python
from backend.extensions_routes import register_extension_routes

register_extension_routes(app)

# Restart Flask
```

### 3. Frontend Integration

In `frontend/src/AppMain.jsx`:
```jsx
import ReferralPanel from './components/ReferralPanel'

// Add to dashboard or settings page:
<ReferralPanel userId={userId} />
```

### 4. Test Referral Flow

```bash
# Get referral link for user 1
curl -X GET http://localhost:8000/api/referral/stats \
  -H "Authorization: Bearer USER1_TOKEN"

# Returns: {
#   "total_invites": 0,
#   "completed_referrals": 0,
#   "total_earnings": 0
# }

# Simulate click from user 2
curl -X POST "http://localhost:8000/api/referral/track?ref=1"

# Simulate referral completion when user 2 upgrades
curl -X POST http://localhost:8000/api/referral/complete \
  -H "Authorization: Bearer USER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref_id": 1}'

# Check user 1's updated stats
curl -X GET http://localhost:8000/api/referral/stats \
  -H "Authorization: Bearer USER1_TOKEN"

# Returns: {
#   "total_invites": 1,
#   "completed_referrals": 1,
#   "total_earnings": 5.0
# }
```

### 5. Leaderboard

```bash
# Get public leaderboard
curl -X GET http://localhost:8000/api/referral/leaderboard
```

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] All environment variables set in `.env`
- [ ] Database migrations completed
- [ ] SendGrid API key working
- [ ] Firebase project created and configured
- [ ] GSC connected and verified
- [ ] SerpAPI key obtained
- [ ] YouTube credentials set up
- [ ] GitHub credentials for video uploads

### Staging Deployment

```bash
# 1. Pull latest code
cd /path/to/mrreadyprep
git pull origin main

# 2. Install/update dependencies
pip install -r requirements.txt --break-system-packages
npm install

# 3. Run database migrations
psql $DATABASE_URL < backend/migrations.sql

# 4. Build frontend
npm run build

# 5. Start backend
python backend/main.py

# 6. Verify all endpoints
./scripts/test_endpoints.sh
```

### Production Deployment

```bash
# 1-5. Same as staging

# 6. Start with Gunicorn (production WSGI)
gunicorn -w 4 -b 0.0.0.0:8000 backend.main:app

# 7. Setup Nginx reverse proxy
# See nginx.conf in repo

# 8. Enable SSL/TLS
# Use certbot for Let's Encrypt

# 9. Setup cron jobs
# - Email campaigns: 0 9 * * *
# - SEO monitoring: 0 2 * * *
# - Video updates: 0 3 * * 0

# 10. Monitor logs
tail -f /var/log/mrreadyprep/app.log
```

---

## MONITORING & OPTIMIZATION

### Email Metrics

```bash
# Track opens/clicks in SendGrid Dashboard
# Target: 25%+ open rate, 5%+ click rate
```

### Analytics Metrics

```bash
# Key metrics to track:
# - Signup conversion rate: target 15-20%
# - Upgrade conversion rate: target 8-12%
# - Mock test completion: target 60%+
# - Referral conversion: target 30-40%
```

### SEO Metrics

```bash
# Monitor weekly:
# - Keyword rankings (aim for top 10)
# - Click-through rate (target 3-5%)
# - Impressions (track growth)
# - Average position (target < 3.0)
```

### Video Metrics

```bash
# YouTube targets:
# - Click-through rate: 4-6%
# - Watch time: 50%+ of video
# - Engagement rate: 3-5%
# - Subscribers from content
```

### Referral Metrics

```bash
# Track:
# - Referral conversion rate (target 35-40%)
# - Cost per acquisition (should be < $5)
# - Referrer retention (do they stay premium?)
# - Viral coefficient (how many refer others?)
```

---

## TROUBLESHOOTING

### Email not sending?
- Check SENDGRID_API_KEY in .env
- Check recipient email address is valid
- Check SendGrid dashboard for bounces

### Analytics not tracking?
- Check VITE_GA_MEASUREMENT_ID is correct
- Check browser console for errors
- Verify Firebase project is active

### SEO monitoring failing?
- Check gsc-credentials.json path
- Verify GSC site is verified
- Check SERPAPI_API_KEY is valid
- Verify database connection

### YouTube upload failing?
- Check youtube_credentials.json exists
- Re-authenticate if token expired
- Check file path exists and is valid
- Verify video format (MP4, MOV supported)

### Referral system not working?
- Check referral_clicks table exists
- Test API endpoints directly
- Verify JWT tokens are valid
- Check database foreign keys

---

## Support & Maintenance

All extensions should be monitored weekly:

```bash
# Weekly check script
./scripts/health_check.sh

# This checks:
# - Email deliverability
# - Analytics events flowing
# - SEO metrics updating
# - Video uploads processing
# - Referral conversions tracking
```

For issues, check logs:
```bash
tail -f /var/log/mrreadyprep/extensions.log
```
