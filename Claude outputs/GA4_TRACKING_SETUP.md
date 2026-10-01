# GA4 Event Tracking Setup for MRReadyPrep

## Quick Start
Copy these event codes into your Google Tag Manager (GTM) or GA4 data stream configuration.

---

## EVENT STRUCTURE & IMPLEMENTATION

### 1. Landing Page View
**Event Name:** `landing_page_view`

**Parameters:**
```
variant: [string] - "control" | "variant_a" | "variant_b"
source: [string] - "organic" | "paid_search" | "email" | "social" | "direct"
```

**GTM Implementation (Data Layer):**
```javascript
dataLayer.push({
  'event': 'landing_page_view',
  'variant': 'control',
  'source': 'organic'
});
```

**Purpose:** Track landing page visits by traffic source and A/B test variant

---

### 2. Blog View
**Event Name:** `blog_view`

**Parameters:**
```
article_id: [string] - unique identifier (e.g., "blog_001_toefl_format")
section: [string] - "format" | "tips" | "reading" | "listening" | "writing" | "speaking"
scroll_depth: [integer] - 25 | 50 | 75 | 100 (percentage)
```

**GTM Implementation:**
```javascript
dataLayer.push({
  'event': 'blog_view',
  'article_id': 'blog_001_toefl_format',
  'section': 'format',
  'scroll_depth': 75
});
```

**Purpose:** Measure blog engagement and content performance

---

### 3. Email Open
**Event Name:** `email_open`

**Parameters:**
```
campaign_id: [string] - unique campaign identifier
device: [string] - "mobile" | "desktop" | "tablet"
```

**Implementation:** Use tracking pixel in email template
```html
<img src="https://yoursite.com/pixel?event=email_open&campaign_id=welcome_001&device=mobile" width="1" height="1" />
```

**Purpose:** Track email campaign performance and device breakdown

---

### 4. Email Click
**Event Name:** `email_click`

**Parameters:**
```
link_id: [string] - "cta_signup" | "blog_link" | "pricing"
campaign_id: [string] - unique campaign identifier
```

**URL Parameter Implementation:**
```
https://yoursite.com/page?utm_source=email&utm_campaign=welcome_001&link_id=cta_signup
```

**Purpose:** Track which email links drive traffic

---

### 5. Social Click
**Event Name:** `social_click`

**Parameters:**
```
platform: [string] - "twitter" | "linkedin" | "instagram" | "tiktok" | "youtube"
post_id: [string] - unique identifier (e.g., "social_001_linkedin_tips")
```

**Implementation (URL Parameters):**
```
https://yoursite.com/?utm_source=social&utm_medium=twitter&post_id=social_001_linkedin_tips
```

**Purpose:** Track social media referrals and post performance

---

### 6. Trial Signup
**Event Name:** `trial_signup`

**Parameters:**
```
source: [string] - "landing_page" | "email" | "blog" | "social" | "organic"
variant: [string] - A/B test variant identifier
```

**GTM Implementation (On Form Submit):**
```javascript
dataLayer.push({
  'event': 'trial_signup',
  'source': 'email',
  'variant': 'variant_a'
});
```

**Purpose:** Track conversion source and test performance

---

### 7. Paid Conversion
**Event Name:** `paid_conversion`

**Parameters:**
```
plan: [string] - "monthly_29" | "quarterly_69" | "annual_199"
source: [string] - "landing_page" | "email" | "blog" | "social"
revenue: [float] - actual transaction amount
```

**GTM Implementation (On Purchase Complete):**
```javascript
dataLayer.push({
  'event': 'paid_conversion',
  'plan': 'monthly_29',
  'source': 'email',
  'revenue': 29.00
});
```

**Purpose:** Track revenue, conversion source, and plan performance

---

## GA4 CONFIGURATION CHECKLIST

### Step 1: Create Events in GA4
- [ ] Go to GA4 Admin → Data Streams → Web
- [ ] Create custom event for each event above
- [ ] Map parameters to user properties (source, variant, device)

### Step 2: Set Up Conversions
- [ ] Mark `trial_signup` as conversion
- [ ] Mark `paid_conversion` as conversion
- [ ] Set revenue as currency event value for `paid_conversion`

### Step 3: Set Up Audiences
- [ ] Audience: "Blog Readers" (blog_view + scroll_depth ≥ 50)
- [ ] Audience: "Email Engagers" (email_open + email_click)
- [ ] Audience: "Social Clickers" (social_click)
- [ ] Audience: "Trial Users" (trial_signup)

### Step 4: Create Reports
- [ ] Event flow: landing_page_view → trial_signup → paid_conversion
- [ ] Conversion funnel by source
- [ ] Email performance (open rate, click rate)
- [ ] Blog performance by section
- [ ] Social performance by platform

---

## TRACKING SNIPPETS - COPY & PASTE

### Universal Event Tracking (GTM Data Layer)
Place this in your website header (before GTM container):

```javascript
<script>
window.dataLayer = window.dataLayer || [];

// Helper function for consistent event tracking
function trackEvent(eventName, params = {}) {
  dataLayer.push({
    'event': eventName,
    ...params
  });
}

// Auto-track page views
trackEvent('page_view', {
  'page_title': document.title,
  'page_path': window.location.pathname
});
</script>
```

### Blog Scroll Tracking
Add to blog pages:

```javascript
<script>
let scrollTracked = false;

window.addEventListener('scroll', function() {
  const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
  
  if (!scrollTracked && scrollPercent >= 75) {
    trackEvent('blog_view', {
      'article_id': 'article_' + document.querySelector('[data-article-id]')?.dataset.articleId,
      'section': document.body.dataset.section || 'general',
      'scroll_depth': 75
    });
    scrollTracked = true;
  }
});
</script>
```

### Form Submission Tracking
Add to signup form:

```javascript
document.querySelector('form').addEventListener('submit', function() {
  trackEvent('trial_signup', {
    'source': new URLSearchParams(window.location.search).get('utm_source') || 'direct',
    'variant': localStorage.getItem('variant') || 'control'
  });
});
```

---

## TESTING CHECKLIST

- [ ] Install Google Analytics Debugger Chrome extension
- [ ] Visit landing page → confirm `landing_page_view` event fires
- [ ] Click blog link → confirm `blog_view` event with correct article_id
- [ ] Scroll blog 75%+ → confirm scroll_depth recorded
- [ ] Click social link → confirm `social_click` with platform and post_id
- [ ] Submit signup form → confirm `trial_signup` event
- [ ] Complete purchase → confirm `paid_conversion` with revenue
- [ ] Check GA4 Real-Time report for all events

---

## UTM PARAMETER GUIDE

Use these UTM codes consistently:

**Email Campaigns:**
```
utm_source=email
utm_medium=email
utm_campaign=[campaign_id]
&link_id=[link_purpose]
```

**Social Media:**
```
utm_source=social
utm_medium=[platform]
utm_campaign=[post_id]
```

**Blog Posts:**
```
utm_source=blog
utm_medium=organic
utm_campaign=[article_id]
```

---

## REVENUE TRACKING

For paid conversions, track:
- Plan selected (monthly/quarterly/annual)
- Source of conversion
- Revenue amount
- Currency (USD)

**Example:**
```javascript
trackEvent('paid_conversion', {
  'plan': 'annual_199',
  'source': 'email',
  'revenue': 199.00,
  'currency': 'USD'
});
```

---

## SUPPORT & TROUBLESHOOTING

**Events not firing?**
1. Check GTM container is installed
2. Use GA4 Debugger extension to verify events
3. Wait 24-48 hours for GA4 to process historical data

**Questions?**
- GA4 Help: https://support.google.com/analytics
- GTM Guide: https://tagmanager.google.com/
