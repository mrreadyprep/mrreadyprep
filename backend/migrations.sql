-- mrreadyprep Database Migrations
-- Run: psql $DATABASE_URL < backend/migrations.sql

-- ============ USERS TABLE ============
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100),
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    is_premium BOOLEAN DEFAULT false,
    premium_until TIMESTAMP,
    referral_credits FLOAT DEFAULT 0,
    is_admin BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_premium ON users(is_premium);

-- ============ REVIEWS TABLE ============
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    score INTEGER CHECK (score >= 1 AND score <= 5),
    text TEXT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_reviews_score ON reviews(score);
CREATE INDEX idx_reviews_created ON reviews(created_at);

-- ============ REFERRAL TABLES ============
CREATE TABLE IF NOT EXISTS referral_clicks (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL,
    referred_user_id INTEGER,
    clicked_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referral_completions (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL,
    referred_user_id INTEGER NOT NULL,
    completed_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (referrer_id) REFERENCES users(id),
    FOREIGN KEY (referred_user_id) REFERENCES users(id)
);

CREATE INDEX idx_referral_clicks_referrer ON referral_clicks(referrer_id);
CREATE INDEX idx_referral_clicks_referred ON referral_clicks(referred_user_id);
CREATE INDEX idx_referral_completions_referrer ON referral_completions(referrer_id);

-- ============ ANALYTICS TABLES ============
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    event_name VARCHAR(100),
    event_params JSONB,
    logged_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_analytics_event ON analytics_events(event_name);
CREATE INDEX idx_analytics_date ON analytics_events(logged_at);

-- ============ SEO MONITORING TABLES ============
CREATE TABLE IF NOT EXISTS seo_metrics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    clicks INTEGER,
    impressions INTEGER,
    avg_ctr FLOAT,
    avg_position FLOAT,
    top_queries JSONB,
    UNIQUE(date)
);

CREATE TABLE IF NOT EXISTS keyword_rankings (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL,
    rank INTEGER,
    checked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(keyword, DATE(checked_at))
);

CREATE TABLE IF NOT EXISTS backlink_sources (
    id SERIAL PRIMARY KEY,
    source_domain VARCHAR(100),
    source_name VARCHAR(100),
    checked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_seo_metrics_date ON seo_metrics(date);
CREATE INDEX idx_keyword_rankings_keyword ON keyword_rankings(keyword);

-- ============ VIDEO TABLES ============
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    video_id VARCHAR(100) UNIQUE,
    title VARCHAR(200),
    youtube_url VARCHAR(200),
    uploaded_at TIMESTAMP DEFAULT NOW(),
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

-- ============ EMAIL CAMPAIGN TABLES ============
CREATE TABLE IF NOT EXISTS email_campaigns (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    template_key VARCHAR(50),
    sent_at TIMESTAMP DEFAULT NOW(),
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_email_sent ON email_campaigns(sent_at);
CREATE INDEX idx_email_opened ON email_campaigns(opened_at);

-- ============ PRACTICE HISTORY (Optional) ============
CREATE TABLE IF NOT EXISTS practice_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    skill_type VARCHAR(50), -- reading, listening, writing, speaking
    score INTEGER,
    questions_attempted INTEGER,
    time_spent_seconds INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_practice_user ON practice_sessions(user_id);
CREATE INDEX idx_practice_date ON practice_sessions(created_at);

-- ============ VERIFY TABLES CREATED ============
SELECT 
    table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
