# 🚀 STAGING DEPLOYMENT - ADIM ADIM REHBER

## ✅ HAZIRLAMA (15 dakika)

### 1. .env.staging Dosyasını Düzenle

```bash
cd ~/mnt/mrreadyprep
cp .env.staging .env.staging.bak
nano .env.staging
```

Değiştir:
- `DATABASE_URL` → Gerçek PostgreSQL bağlantı stringi
- `SECRET_KEY` → 32 karakterlik random string
- `SENDGRID_API_KEY` → SendGrid'den al
- `VITE_GA_*` → Firebase GA4 keys
- `SERPAPI_API_KEY` → SerpAPI'den al

### 2. Google Service Account Files

```bash
# GSC credentials (SEO monitoring için)
# 1. Google Cloud Console'a git
# 2. Service Account JSON indir
# 3. backend/gsc-credentials.json olarak kaydet

# YouTube credentials (Video upload için)
# 1. Google Cloud Console'a git
# 2. OAuth 2.0 Desktop App JSON indir
# 3. backend/youtube_credentials.json olarak kaydet
```

### 3. Database Hazırla

```bash
# PostgreSQL kurulu mu kontrol et
psql --version

# Eğer kurulu değilse:
# macOS: brew install postgresql
# Linux: apt-get install postgresql

# Yeni database oluştur
createdb mrreadyprep_staging

# Migrations çalıştır
psql mrreadyprep_staging < backend/migrations.sql
```

Tabloları kontrol et:
```bash
psql mrreadyprep_staging -c "\dt"
```

Hepsi görülmeli:
- `users`
- `reviews`
- `referral_clicks`, `referral_completions`
- `analytics_events`
- `seo_metrics`, `keyword_rankings`
- `videos`, `video_schedule`
- `email_campaigns`

---

## 🎬 ÇALIŞTIRMA (3 terminal)

### Terminal 1: Referral System & Backend

```bash
cd ~/mnt/mrreadyprep

# Environment yükle
export $(cat .env.staging | xargs)

# Referral sistem başlat
python backend/referral_system.py

# Backend başlat
python backend/main.py
```

Hedef output:
```
✅ Referral schema initialized
WARNING: Running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### Terminal 2: Frontend

```bash
cd ~/mnt/mrreadyprep
npm run dev
```

Hedef output:
```
  Local:        http://localhost:5173/
  press h to show help
```

### Terminal 3: Monitoring (opsiyonel)

```bash
# Backend loglarını izle
tail -f /var/log/mrreadyprep/app.log

# Ya da curl ile health check
watch -n 5 'curl -s http://localhost:8000/health | jq .'
```

---

## ✅ KONTROL LISTESI

Açılan tarayıcıda:

### 1. Frontend Açılsın
```
http://localhost:5173 → Ana sayfa görünmeli
```

### 2. Signup/Login Test
```
1. Signup butonuna tıkla
2. Email + password gir
3. Login yap
→ JWT token aldığını doğrula
```

### 3. Extension 2: Email Test
```bash
# Terminal 3'te:
curl -X POST http://localhost:8000/api/emails/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template":"welcome"}'
  
# Hedef: {"status":"email_sent"} ya da {"error":"..."}
```

### 4. Extension 3: Analytics Test
```bash
# Google Chrome açıp DevTools (F12)
# Console'da:
trackEvent('test_event', {test: true})

# Firebase Analytics → Realtime görünmeli
```

### 5. Extension 4: SEO Monitoring Test
```bash
# Admin kullanıcı ile login yap
# /api/seo/metrics GET çalıştır

curl -X GET http://localhost:8000/api/seo/metrics \
  -H "Authorization: Bearer ADMIN_JWT"
```

### 6. Extension 5: Video Schedule Test
```bash
curl -X GET http://localhost:8000/api/videos/schedule \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7. Extension 6: Referral Test
```bash
# Get stats
curl -X GET http://localhost:8000/api/referral/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Leaderboard (public)
curl -X GET http://localhost:8000/api/referral/leaderboard

# Complete referral simulation
curl -X POST http://localhost:8000/api/referral/track?ref=1

curl -X POST http://localhost:8000/api/referral/complete \
  -H "Authorization: Bearer REFERRED_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"ref_id":1}'
```

---

## 📊 MONITORING METRIKLERI

### 1. Backend Health
```bash
curl http://localhost:8000/health
→ {"status":"ok"} dönmeli
```

### 2. Database Connection
```bash
psql mrreadyprep_staging -c "SELECT COUNT(*) FROM users;"
```

### 3. Frontend Network Tab
Chrome DevTools → Network → API calls görmeli

### 4. Firebase Console
```
https://console.firebase.google.com
→ Analytics → Realtime → Events görünmeli
```

### 5. SendGrid Dashboard
```
https://app.sendgrid.com
→ Sent e-maillar görünmeli
```

---

## 🐛 TROUBLESHOOTING

### Backend başlamıyor?
```bash
# Port 8000 kullanımda mı?
lsof -i :8000

# Eğer evet:
kill -9 <PID>

# Ya da farklı port kullan:
export FLASK_PORT=8001
python backend/main.py
```

### Database connection hatası
```bash
# DATABASE_URL kontrol et
echo $DATABASE_URL

# Bağlantı test et
psql $DATABASE_URL -c "SELECT 1"
```

### Frontend node_modules hatası
```bash
rm -rf node_modules package-lock.json
npm install
```

### Environment variables yüklenmedi
```bash
# .env.staging kayıt edilmiş mi?
ls -la .env.staging

# Tüm variables yüklendi mi?
env | grep SENDGRID
env | grep VITE_GA
```

### Git güncellemesi gerekli
```bash
cd ~/mnt/mrreadyprep
git pull origin main
git status  # uncommitted changes kontrol et
```

---

## 📈 PERFORMANCE BASELINE (Hedefleri)

### Startup Times
- Backend: < 5 saniye
- Frontend: < 10 saniye

### API Response Times
- GET requests: < 200ms
- POST requests: < 500ms

### Database Queries
- User lookup: < 50ms
- Referral stats: < 100ms

### Frontend Metrics
- LCP (Largest Contentful Paint): < 2.5s
- CLS (Cumulative Layout Shift): < 0.1
- FID (First Input Delay): < 100ms

---

## 🎯 NEXT STEPS

1. **Tüm testler geçerse:**
   ```
   ✅ Stage 1 tamamlandı
   → İlk 50 beta kullanıcıyla test et
   ```

2. **Metric'leri 1 hafta izle:**
   - Email open rates
   - Analytics event flow
   - Referral conversion rates
   - API response times

3. **Production deployment planı:**
   - SSL/TLS setup (Let's Encrypt)
   - Nginx reverse proxy
   - PM2 process manager
   - Automated backups

---

**Her sorun için Terminal 3'teki logları kontrol et** 👇

```bash
tail -100f /var/log/mrreadyprep/app.log
```
