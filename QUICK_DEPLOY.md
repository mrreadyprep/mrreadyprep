# ⚡ PRODUCTION DEPLOYMENT - QUICK START

## STEP 1: Frontend Build (2 dakika)

```bash
cd ~/mnt/mrreadyprep

# Cleanup
rm -rf node_modules package-lock.json
npm install

# Build
npm run build
```

✅ **Hedef:** `frontend/dist/` folder oluşturulmalı

---

## STEP 2: Python Setup (3 dakika)

```bash
# Virtual environment
python3 -m venv venv
source venv/bin/activate

# Dependencies
pip install -r requirements.txt
```

✅ **Hedef:** `(venv)` prompt'unda Python ready

---

## STEP 3: .env.production Doldur

```bash
# Açık ve doldur:
nano .env.production
```

**Zorunlu alanlar:**
- `DATABASE_URL` → PostgreSQL bağlantısı
- `SECRET_KEY` → 32 karakter random
- `SENDGRID_API_KEY` → SendGrid
- `VITE_GA_MEASUREMENT_ID` → GA4 ID

---

## STEP 4: Database Migrations

```bash
# Environment yükle
export $(cat .env.production | xargs)

# Migrations çalıştır
psql $DATABASE_URL < backend/migrations.sql

# Verify
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
```

✅ **Hedef:** 9 tablo görünmeli

---

## STEP 5: Gunicorn Test

```bash
# Backend çalıştır
gunicorn --workers 4 --bind 0.0.0.0:3000 backend.main:app
```

✅ **Hedef:** `Running on http://0.0.0.0:3000`

**Ayrı terminal'de test et:**
```bash
curl http://localhost:3000/health
```

---

## STEP 6: Nginx Setup (VPS'de)

### 6.1 Sunucu'ya SSH ile gir
```bash
ssh -i ~/.ssh/mrreadyprep root@YOUR_SERVER_IP
```

### 6.2 Nginx Config Kopyala
```bash
# Terminal'den (local):
scp -i ~/.ssh/mrreadyprep \
  ~/mnt/mrreadyprep/nginx.conf \
  root@YOUR_SERVER_IP:/etc/nginx/sites-available/mrreadyprep
```

### 6.3 Enable & Test
```bash
# Server'da:
sudo ln -sf /etc/nginx/sites-available/mrreadyprep /etc/nginx/sites-enabled/

sudo nginx -t
# → "configuration file test is successful"

sudo systemctl restart nginx
```

---

## STEP 7: SSL Certificate (Let's Encrypt)

### 7.1 DNS Setup (ÖNCE!)
```
A record:    mrreadyprep.com → YOUR_SERVER_IP
CNAME:       www.mrreadyprep.com → mrreadyprep.com
```

### 7.2 Certificate Al (Server'da)
```bash
sudo certbot certonly --nginx -d mrreadyprep.com -d www.mrreadyprep.com

# Sertifika paths:
# /etc/letsencrypt/live/mrreadyprep.com/fullchain.pem
# /etc/letsencrypt/live/mrreadyprep.com/privkey.pem
```

### 7.3 Auto-Renewal
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## STEP 8: Systemd Service Setup (Server'da)

```bash
sudo cat > /etc/systemd/system/mrreadyprep-api.service << 'SVCEOF'
[Unit]
Description=mrreadyprep API (Production)
After=network.target postgresql.service

[Service]
Type=notify
User=mrreadyprep
WorkingDirectory=/home/mrreadyprep/mrreadyprep
Environment="PATH=/home/mrreadyprep/mrreadyprep/venv/bin"
EnvironmentFile=/home/mrreadyprep/mrreadyprep/.env.production
ExecStart=/home/mrreadyprep/mrreadyprep/venv/bin/gunicorn \
  --workers 4 \
  --worker-class sync \
  --bind 0.0.0.0:3000 \
  backend.main:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable mrreadyprep-api
sudo systemctl start mrreadyprep-api
```

---

## STEP 9: Production Check

```bash
# 1. HTTPS accessible?
curl https://mrreadyprep.com/health

# 2. SSL Grade
# https://www.ssllabs.com/ssltest/analyze.html?d=mrreadyprep.com

# 3. Frontend loads?
# https://mrreadyprep.com → Homepage görünmeli

# 4. API works?
curl https://mrreadyprep.com/api/health

# 5. Logs
sudo journalctl -u mrreadyprep-api -n 20
sudo tail -f /var/log/nginx/mrreadyprep-access.log
```

---

## STEP 10: Extensions Verify

```bash
# 1. Email
curl -X POST https://mrreadyprep.com/api/emails/test \
  -H "Authorization: Bearer YOUR_JWT"

# 2. Analytics
# Firebase Console → Realtime Events

# 3. Referral
curl https://mrreadyprep.com/api/referral/leaderboard

# 4. Video
curl https://mrreadyprep.com/api/videos/schedule

# 5. SEO
# Google Search Console → Submit sitemap
```

---

## ✅ DEPLOYMENT COMPLETE!

**Metrics to monitor (Week 1):**
- Uptime: > 99%
- Response time: < 200ms
- No errors in logs
- SSL Grade: A+
- Signups flowing

---

## 🚨 EMERGENCY COMMANDS

```bash
# Stop if crashing
sudo systemctl stop mrreadyprep-api

# View errors
sudo journalctl -u mrreadyprep-api -xe

# Restart
sudo systemctl restart mrreadyprep-api

# Force reload nginx
sudo systemctl reload nginx

# Check cert expiry
sudo certbot certificates
```

---

**Ready? Run the commands above in order!** 🚀
