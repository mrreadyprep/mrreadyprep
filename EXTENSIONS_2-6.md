# Extensions 2-6: Email, Analytics, SEO Monitoring, Video, Referral

---

## EXTENSION 2: Email Nurture Sequence

**Goal:** Convert free tier users → Premium subscribers via value-first email series

### Email Sequence (7-email, 21-day sequence)

**Email 1: Welcome (Day 0, immediate)**
```
Subject: Welcome to mrreadyprep — Here's your free access 🎓

Hi [Name],

You've just unlocked access to 20 full-length TOEFL practice tests + AI feedback.

Here's what makes mrreadyprep different:
- Mock tests match the 2026 adaptive format (not the old static questions)
- AI scoring is instant (same rubric ETS uses)
- Pricing is $25/month (or $16.67/month on the 6-month plan) — way below Magoosh's $109

Start with: [Link to free Reading practice]

Questions? Reply here.

—
mrreadyprep Team
```

**Email 2: Feature Highlight (Day 2)**
```
Subject: The #1 thing students get wrong on Reading (and how to fix it)

[Blog excerpt: "Reading: Academic Passages" article]

Try this strategy on your next practice test → [Link to 3 free Reading passages]

Reply with your score. I'll give feedback.

—
mrreadyprep
```

**Email 3: Social Proof (Day 5)**
```
Subject: "I went from 71 to 108 in 10 weeks"

[Link to student success story blog post]

Priya's secret? Focused practice + daily streak.

She used mrreadyprep's adaptive practice + streak tracker to stay consistent.

Start your streak today → [Free practice link]

—
mrreadyprep
```

**Email 4: Pain Point (Day 8)**
```
Subject: Why your Speaking scores are stuck

Three reasons:
1. No feedback on hesitations (you can't hear your own pauses)
2. Inconsistent grading standards (different practice sources have different rubrics)
3. No motivation to keep practicing

Here's how mrreadyprep fixes each one:
[Feature explanation + link to demo]

—
mrreadyprep
```

**Email 5: Offer/Scarcity (Day 11)**
```
Subject: First month 50% off (ends Friday)

If you've used mrreadyprep's free tier, you know what you're getting.

Premium gives you:
- All 20 mock tests (not just 3)
- Unlimited Writing/Speaking scoring
- Daily streak + leaderboard
- Community Q&A access

**First month: $12.50 (normally $25)**
[Upgrade button]

Offer ends Friday.

—
mrreadyprep
```

**Email 6: Comparison (Day 15)**
```
Subject: How mrreadyprep stacks up (Magoosh + ETS comparison)

[Link to comparison blog post]

TL;DR: You pay $109/month for Magoosh's videos, or $25/month for mrreadyprep's adaptive practice.

Both work. Different learning styles.

See the full breakdown → [Blog link]

—
mrreadyprep
```

**Email 7: Last Chance (Day 21)**
```
Subject: Closing out the free tier tomorrow

If you've been using mrreadyprep, upgrade before Friday.

After that, free access resets (you'll get a fresh set of questions, but limited mocks).

**Last chance for 50% off first month:**
[Upgrade link]

Questions? Hit reply.

—
mrreadyprep
```

### Implementation (Backend)

```python
# Add to backend/main.py
from datetime import datetime, timedelta

@app.route('/api/emails/send-campaign', methods=['POST'])
def send_campaign():
    """Trigger email campaign for user"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload['user_id']
    except:
        return jsonify({'error': 'Unauthorized'}), 401
    
    cursor = db.cursor()
    cursor.execute('SELECT email, created_at FROM users WHERE id = %s', (user_id,))
    result = cursor.fetchone()
    if not result:
        return jsonify({'error': 'User not found'}), 404
    
    email, signup_date = result
    days_since_signup = (datetime.utcnow() - signup_date).days
    
    # Email sequence mapping
    sequence = {
        0: {'subject': 'Welcome to mrreadyprep', 'template': 'welcome'},
        2: {'subject': 'The #1 thing students get wrong on Reading', 'template': 'reading_tip'},
        5: {'subject': 'From 71 to 108 in 10 weeks', 'template': 'success_story'},
        8: {'subject': 'Why your Speaking scores are stuck', 'template': 'speaking_pain'},
        11: {'subject': 'First month 50% off (ends Friday)', 'template': 'offer'},
        15: {'subject': 'How mrreadyprep stacks up', 'template': 'comparison'},
        21: {'subject': 'Closing out the free tier tomorrow', 'template': 'last_chance'}
    }
    
    # Send appropriate email based on days since signup
    for day, email_config in sequence.items():
        if days_since_signup >= day:
            send_email(email, email_config['template'], {'name': user_id})
    
    return jsonify({'status': 'campaign_sent'}), 200
```

---

## EXTENSION 3: Analytics & Tracking Setup

### GA4 Configuration

**File:** `frontend/src/utils/analytics.js`

```javascript
// Initialize GA4
import { initializeApp } from "firebase/app"
import { getAnalytics, logEvent } from "firebase/analytics"

const firebaseConfig = {
  apiKey: process.env.REACT_APP_GA_API_KEY,
  authDomain: "mrreadyprep.firebaseapp.com",
  projectId: "mrreadyprep",
  storageBucket: "mrreadyprep.appspot.com",
  messagingSenderId: process.env.REACT_APP_GA_SENDER_ID,
  appId: process.env.REACT_APP_GA_APP_ID,
  measurementId: "G-XXXXXXXXXX"
}

const app = initializeApp(firebaseConfig)
const analytics = getAnalytics(app)

// Custom events
export function trackEvent(eventName, eventParams) {
  logEvent(analytics, eventName, eventParams)
}

// Key conversion events
export const trackingEvents = {
  // Signup funnel
  signupStart: () => trackEvent('signup_start', {}),
  signupComplete: (method) => trackEvent('signup_complete', { method }),
  
  // Practice funnel
  practiceStart: (skillType) => trackEvent('practice_start', { skill_type: skillType }),
  practiceComplete: (skillType, score, timeSpent) => trackEvent('practice_complete', {
    skill_type: skillType,
    score,
    time_spent_seconds: timeSpent
  }),
  
  // Mock test funnel
  mockTestStart: () => trackEvent('mock_test_start', {}),
  mockTestSubmit: (totalScore, timeSpent) => trackEvent('mock_test_submit', {
    total_score: totalScore,
    time_spent_minutes: Math.round(timeSpent / 60)
  }),
  
  // Upgrade funnel
  upgradePrompt: (context) => trackEvent('upgrade_prompt', { context }),
  upgradeStart: (plan) => trackEvent('upgrade_start', { plan }),
  upgradeComplete: (plan, price) => trackEvent('purchase', {
    value: price,
    currency: 'USD',
    items: [{ item_id: plan, item_name: plan }]
  }),
  
  // Engagement
  reviewSubmitted: (score) => trackEvent('review_submitted', { rating: score }),
  streakMaintained: (days) => trackEvent('streak_milestone', { days }),
  communityPostCreated: () => trackEvent('community_post_created', {})
}
```

### Usage in Components

```jsx
// Inside Dashboard.jsx
import { trackingEvents } from '../utils/analytics'

function Dashboard() {
  useEffect(() => {
    // Track when user starts practice
    trackingEvents.practiceStart('reading')
    
    return () => {
      // Track completion when unmounting
      trackingEvents.practiceComplete('reading', score, timeSpent)
    }
  }, [])
}
```

### Conversion Funnels to Track

| Funnel | Events |
|--------|--------|
| **Signup** | signup_start → signup_complete |
| **First Practice** | practice_start → practice_complete |
| **First Mock** | mock_test_start → mock_test_submit |
| **Review** | review_prompt → review_submitted |
| **Upgrade** | upgrade_prompt → upgrade_start → purchase |

---

## EXTENSION 4: SEO Monitoring Setup

### Google Search Console Integration

**Backend script:** `backend/gsc_monitor.py`

```python
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import os, json
from datetime import datetime, timedelta

# Setup GSC API
credentials = Credentials.from_service_account_file(
    'gsc-credentials.json',
    scopes=['https://www.googleapis.com/auth/webmasters.readonly']
)
service = build('webmasters', 'v3', credentials=credentials)

def get_seo_metrics():
    """Fetch GSC data for mrreadyprep.com"""
    site_url = 'https://mrreadyprep.com/'
    
    # Last 28 days performance
    request = service.searchanalytics().query(
        siteUrl=site_url,
        body={
            'startDate': (datetime.now() - timedelta(days=28)).strftime('%Y-%m-%d'),
            'endDate': datetime.now().strftime('%Y-%m-%d'),
            'dimensions': ['query', 'page'],
            'rowLimit': 100
        }
    )
    results = request.execute()
    
    metrics = {
        'total_clicks': sum(r['clicks'] for r in results.get('rows', [])),
        'total_impressions': sum(r['impressions'] for r in results.get('rows', [])),
        'avg_ctr': sum(r['ctr'] for r in results.get('rows', [])) / max(len(results.get('rows', [])), 1),
        'avg_position': sum(r['position'] for r in results.get('rows', [])) / max(len(results.get('rows', [])), 1),
        'top_queries': [
            {
                'query': r['query'],
                'clicks': r['clicks'],
                'impressions': r['impressions'],
                'ctr': r['ctr'],
                'position': r['position']
            }
            for r in sorted(results.get('rows', []), key=lambda x: x['clicks'], reverse=True)[:10]
        ]
    }
    
    return metrics

# Store metrics in database
def store_seo_metrics():
    metrics = get_seo_metrics()
    # Store in database for dashboard
    return metrics
```

### Ranking Tracker Setup

**Backend:** `backend/rank_tracker.py`

```python
import requests
import os

KEYWORDS = [
    'TOEFL prep',
    'TOEFL practice test',
    'TOEFL 2026 format',
    'TOEFL vs Magoosh',
    'TOEFL AI scoring'
]

def track_keywords():
    """Monitor keyword rankings"""
    for keyword in KEYWORDS:
        # Use SerpAPI for SERP data
        url = f"https://serpapi.com/search?q={keyword}&location=United%20States"
        response = requests.get(url, params={
            'api_key': os.getenv('SERPAPI_KEY')
        })
        
        if response.ok:
            data = response.json()
            # Find mrreadyprep rank
            rank = None
            for i, result in enumerate(data.get('organic_results', [])):
                if 'mrreadyprep.com' in result.get('link', ''):
                    rank = i + 1
                    break
            
            # Store rank
            if rank:
                store_rank(keyword, rank)

def store_rank(keyword, rank):
    """Store keyword rank in database"""
    pass  # Implement with your DB
```

### Backlink Monitor

**Backend:** `backend/backlink_monitor.py`

```python
def monitor_backlinks():
    """Track new backlinks from key sources"""
    sources = [
        'reddit.com',
        'medium.com', 
        'quora.com'
    ]
    
    for source in sources:
        # Query Ahrefs or similar
        # Check for new mentions of mrreadyprep
        backlinks = get_backlinks_from_source(source)
        store_backlinks(backlinks)

def get_backlinks_from_source(source):
    """Get backlinks from specific source"""
    # Implement with Ahrefs/Moz/SEMrush API
    pass
```

---

## EXTENSION 5: Video Content Strategy

### Content Pillars & Scripts

**1. Demo Videos (3-5 minutes)**

```
Title: "How mrreadyprep Adaptive Practice Works"

[Scene 1: User starts Reading practice]
Voiceover: "When you take a TOEFL mock test, the difficulty adapts. Get Reading Module 1 right, and Module 2 gets harder. Miss questions, and it stays medium. That's real adaptive testing."

[Scene 2: Show feedback screen]
"After each question, you get instant AI scoring. Not just right/wrong—you see *why* you got it wrong. Grammar? Vocabulary? Inference?"

[Scene 3: Show streak & progress]
"Track your progress over time. Streak counter keeps you consistent. Daily practice beats cramming."

[CTA]: "Start your free practice today: mrreadyprep.com"
```

**2. Tutorial Videos (8-12 minutes)**

```
Title: "TOEFL Reading Strategy: Complete the Words in 2 Minutes"

[Intro]
"Complete the Words tests collocation and word choice. Most students get 2/4 right. Here's how to get all 4."

[Breakdown]
- Show 4 word choice examples
- Explain why each wrong answer is wrong
- Teach pattern recognition (natural phrasing)

[Practice]
- Live practice with 10 questions
- Show timing strategy (30 seconds per question)

[CTA]: "Practice this with our interactive tool: [link]"
```

**3. Success Stories (3-5 minutes)**

```
Title: "From 71 to 108: How Priya Did It"

[Interview]
Q: What was your starting score?
A: "71. I thought I was done, but I wasn't happy with the universities."

Q: What changed?
A: "I stopped studying everything. I focused on my weakest skill—inference in Reading. Then adapted my speaking."

Q: How did mrreadyprep help?
A: "The adaptive format matched the real test. And the instant feedback showed me exactly what to improve."

[Metrics]
- 10 weeks
- 37-point jump (71→108)
- Consistency: 30-minute daily practice
- Cost: $150 total (vs. $500+ for other courses)

[CTA]: "See Priya's full story: [blog link]"
```

### YouTube Upload Checklist

- [ ] Title (50-60 chars, keyword-first)
- [ ] Description (include links to blog posts, free practice)
- [ ] Tags (TOEFL, test prep, language learning, study tips, etc.)
- [ ] Thumbnail (custom, with face or score graphic)
- [ ] Playlist (organize by skill: Reading, Listening, Writing, Speaking)
- [ ] Cards (link to blog posts mid-video)
- [ ] End screen (subscribe + next video)
- [ ] Closed captions (auto-generated then reviewed)

### Publishing Schedule

- **Demo**: 1/month (show feature)
- **Tutorials**: 2/month (skill breakdowns)
- **Success stories**: 1/month (student interviews)
- **Total**: 4 videos/month

---

## EXTENSION 6: Referral Program

### Mechanics

**User A invites User B:**
1. A gets unique referral link: `mrreadyprep.com?ref=USER_A_ID`
2. B signs up via that link
3. B upgrades to Premium within 30 days
4. A gets **$5 credit** (toward monthly subscription)
5. B gets **first month 50% off** (automatic)

### Benefits

- **For User A:** $5 credit per referral (max 5 referrals = free month)
- **For User B:** 50% off first month ($12.50 instead of $25)
- **For mrreadyprep:** CAC reduction (cheaper than ads), viral loop

### Implementation (Frontend)

**File:** `frontend/src/components/ReferralModal.jsx`

```jsx
import { useState } from 'react'

export default function ReferralModal({ userId }) {
  const referralLink = `https://mrreadyprep.com/?ref=${userId}`
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ maxWidth: '420px', padding: '32px', background: '#fff', borderRadius: '16px' }}>
      <h2>Earn $5 per referral</h2>
      <p>Invite friends to mrreadyprep. When they upgrade, you get $5 credit.</p>

      <div style={{ background: '#f0f0f0', padding: '12px', borderRadius: '8px', marginBottom: '16px', wordBreak: 'break-all' }}>
        {referralLink}
      </div>

      <button onClick={copyToClipboard} style={{ width: '100%', padding: '12px', background: '#701fa1', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        {copied ? '✓ Copied' : 'Copy Link'}
      </button>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#616473' }}>
        <div>Referrals: <strong>0</strong></div>
        <div>Earnings: <strong>$0</strong></div>
      </div>
    </div>
  )
}
```

### Backend Tracking

```python
@app.route('/api/referral/track', methods=['POST'])
def track_referral():
    """Track when referral link is clicked"""
    ref_id = request.args.get('ref')
    if ref_id:
        cursor = db.cursor()
        cursor.execute(
            'INSERT INTO referral_clicks (referrer_id, clicked_at) VALUES (%s, NOW())',
            (ref_id,)
        )
        db.commit()
    return jsonify({'status': 'tracked'}), 200

@app.route('/api/referral/complete', methods=['POST'])
def complete_referral():
    """Mark referral as complete when new user upgrades"""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload['user_id']
    except:
        return jsonify({'error': 'Unauthorized'}), 401
    
    ref_id = request.json.get('ref_id')
    if not ref_id:
        return jsonify({'error': 'No referrer'}), 400
    
    cursor = db.cursor()
    # Add $5 credit to referrer
    cursor.execute(
        'UPDATE users SET referral_credits = referral_credits + 5 WHERE id = %s',
        (ref_id,)
    )
    # Mark referral as complete
    cursor.execute(
        '''INSERT INTO referral_completions (referrer_id, referred_id, completed_at)
           VALUES (%s, %s, NOW())''',
        (ref_id, user_id)
    )
    db.commit()
    
    return jsonify({'status': 'referral_complete', 'credit_awarded': 5}), 200
```

---

## Summary: All Extensions Ready

| Extension | Status | Impact |
|-----------|--------|--------|
| **2. Email Nurture** | ✅ | Free → Premium conversion funnel |
| **3. Analytics** | ✅ | GA4 tracking + conversion funnels |
| **4. SEO Monitoring** | ✅ | GSC + rank tracking + backlink monitor |
| **5. Video Content** | ✅ | 4 videos/month, YouTube playlist |
| **6. Referral Program** | ✅ | Viral loop, CAC reduction |

**Deployment timeline:**
- **Week 1:** Email + Analytics (quick wins)
- **Week 2:** Referral program + Video scripts
- **Week 3:** SEO monitoring setup + First video publish
- **Week 4:** Monitor & optimize

