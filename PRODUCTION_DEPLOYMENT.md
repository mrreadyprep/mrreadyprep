# 🚀 PRODUCTION DEPLOYMENT - mrreadyprep.com CANLIYA ÇIKIS

**NOT:** Bu guide mrreadyprep.com'ı gerçek sunucuya deploy etmek içindir.

---

## PHASE 1: SUNUCU SETUP

### 1.1 VPS Seç (Önerilir: DigitalOcean, AWS, Linode)

**DigitalOcean örneği:**
- **Droplet:** Ubuntu 22.04 LTS, 2GB RAM, 50GB SSD
- **Region:** Frankfurt ya da New York
- **Cost:** $12-18/ay

### 1.2 SSH Setup

```bash
# Local machine'den
ssh-keygen -t ed25519 -f ~/.ssh/mrreadyprep

# Public key'i server'a ekle
cat ~/.ssh/mrreadyprep.pub | ssh root@YOUR_SERVER_IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# Test et
ssh -i ~/.ssh/mrreadyprep root@YOUR_SERVER_IP
```

### 1.3 Server Hazırlama

```bash
# Server'da çalıştır
apt update && apt upgrade -y

# Dependencies
apt install -y python3 python3-pip python3-venv postgresql postgresql-contrib \
  nodejs npm nginx certbot python3-certbot-nginx git curl wget build-essential

# Node.js latest
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Verify
python3 --version  # Python 3.10+
node --version     # v20+
psql --version     # PostgreSQL 14+
nginx -v           # Nginx
```

### 1.4 App User Oluştur

```bash
# root'ta değil, dedicated user'da çalıştır
useradd -m -s /bin/bash mrreadyprep
usermod -aG sudo mrreadyprep
su - mrreadyprep

# GitHub SSH key oluştur (deploy için)
ssh-keygen -t ed25519 -f ~/.ssh/github_mrreadyprep -C "deploy@mrreadyprep.com"
cat ~/.ssh/github_mrreadyprep.pub
# GitHub > Settings > Deploy Keys > Add
```

---

## PHASE 2: DATABASE SETUP

### 2.1 PostgreSQL Production DB

```bash
# PostgreSQL'e gir
sudo -u postgres psql

# Production database oluştur
CREATE USER mrreadyprep_prod WITH ENCRYPTED PASSWORD 'STRONG_PASSWORD_HERE';
CREATE DATABASE mrreadyprep_prod OWNER mrreadyprep_prod;
GRANT ALL PRIVILEGES ON DATABASE mrreadyprep_prod TO mrreadyprep_prod;
\q

# Backups directory
sudo mkdir -p /var/backups/mrreadyprep
sudo chown mrreadyprep:mrreadyprep /var/backups/mrreadyprep

# Backup cron job
sudo -u mrreadyprep crontab -e
# Add:
# Daily backup at 2 AM
0 2 * * * pg_dump mrreadyprep_prod | gzip > /var/backups/mrreadyprep/backup-$(date +\%Y\%m\%d).sql.gz
# Keep 30 days
0 3 * * * find /var/backups/mrreadyprep -name "backup-*.sql.gz" -mtime +30 -delete
```

### 2.2 Migrations Çalıştır

```bash
su - mrreadyprep

# DATABASE_URL set et
export DATABASE_URL="postgresql://mrreadyprep_prod:STRONG_PASSWORD_HERE@localhost/mrreadyprep_prod"

# Migrations
psql $DATABASE_URL < /home/mrreadyprep/mrreadyprep/backend/migrations.sql

# Verify
psql $DATABASE_URL -c "\dt"
```

---

## PHASE 3: APPLICATION DEPLOY

### 3.1 Git Pull

```bash
cd /home/mrreadyprep
git clone https://github.com/mehmetdisbudak/mrreadyprep.git
cd mrreadyprep
```

### 3.2 Production Environment

```bash
# .env.production oluştur
cat > .env.production << 'ENVEOF'
# DATABASE
DATABASE_URL=postgresql://mrreadyprep_prod:STRONG_PASSWORD_HERE@localhost/mrreadyprep_prod

# APP
ENVIRONMENT=production
SECRET_KEY=GENERATE_32_CHAR_RANDOM_STRING
DEBUG=false

# DOMAIN
DOMAIN=mrreadyprep.com
CORS_ORIGIN=https://mrreadyprep.com

# SENDGRID (Extension 2)
SENDGRID_API_KEY=SG.your_production_key

# FIREBASE (Extension 3)
VITE_GA_MEASUREMENT_ID=G-PRODUCTION_ID

# SERPAPI (Extension 4)
SERPAPI_API_KEY=your_production_key

# Ports
FLASK_PORT=3000
VITE_PORT=3001
ENVEOF

chmod 600 .env.production
```

### 3.3 Dependencies

```bash
# Python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Node
npm install
npm run build
```

### 3.4 Gunicorn Setup (Production WSGI)

```bash
pip install gunicorn

# systemd service oluştur
sudo cat > /etc/systemd/system/mrreadyprep-api.service << 'SVCEOF'
[Unit]
Description=mrreadyprep API
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
  --access-logfile /var/log/mrreadyprep/access.log \
  --error-logfile /var/log/mrreadyprep/error.log \
  backend.main:app
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl enable mrreadyprep-api
sudo systemctl start mrreadyprep-api
sudo systemctl status mrreadyprep-api
```

---

## PHASE 4: NGINX REVERSE PROXY

### 4.1 Nginx Config

```bash
sudo cat > /etc/nginx/sites-available/mrreadyprep << 'NGXEOF'
upstream mrreadyprep_api {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name mrreadyprep.com www.mrreadyprep.com;
    
    # Redirect HTTP → HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mrreadyprep.com www.mrreadyprep.com;
    
    # SSL certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/mrreadyprep.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mrreadyprep.com/privkey.pem;
    
    # SSL security
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Static frontend files
    root /home/mrreadyprep/mrreadyprep/frontend/dist;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript;
    
    # Cache static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # API reverse proxy
    location /api/ {
        proxy_pass http://mrreadyprep_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Frontend SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Logs
    access_log /var/log/nginx/mrreadyprep-access.log;
    error_log /var/log/nginx/mrreadyprep-error.log;
}
NGXEOF

# Activate
sudo ln -sf /etc/nginx/sites-available/mrreadyprep /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

### 4.2 SSL Certificate (Let's Encrypt)

```bash
# DNS records setup öncesi (gerekli!)
# A record: mrreadyprep.com → YOUR_SERVER_IP
# CNAME: www → mrreadyprep.com

# Certbot ile certificate al
sudo certbot certonly --nginx -d mrreadyprep.com -d www.mrreadyprep.com

# Auto-renewal cron (Let's Encrypt süresi 90 gün)
sudo certbot renew --quiet --no-eff-email
# Crontab'a ekle: 0 12 * * * certbot renew --quiet --nginx
```

---

## PHASE 5: MONITORING & LOGGING

### 5.1 Log Directory

```bash
sudo mkdir -p /var/log/mrreadyprep
sudo chown -R mrreadyprep:mrreadyprep /var/log/mrreadyprep
```

### 5.2 PM2 Process Manager (Optional)

```bash
# Daha advanced process management için
sudo npm install -g pm2

su - mrreadyprep
cd ~/mrreadyprep

# ecosystem.config.js
cat > ecosystem.config.js << 'PM2EOF'
module.exports = {
  apps: [
    {
      name: 'mrreadyprep-api',
      script: './venv/bin/gunicorn',
      args: '--workers 4 --bind 0.0.0.0:3000 backend.main:app',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/mrreadyprep/pm2-error.log',
      out_file: '/var/log/mrreadyprep/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M'
    }
  ]
};
PM2EOF

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5.3 Monitoring & Alerts

```bash
# Log rotation
sudo cat > /etc/logrotate.d/mrreadyprep << 'LOGEOF'
/var/log/mrreadyprep/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 mrreadyprep mrreadyprep
    sharedscripts
    postrotate
        systemctl reload mrreadyprep-api > /dev/null 2>&1 || true
    endscript
}
LOGEOF

# Health check cron
sudo -u mrreadyprep crontab -e
# Add:
# Every 5 minutes
*/5 * * * * curl -s https://mrreadyprep.com/health || echo "Health check failed" | mail -s "mrreadyprep Alert" admin@mrreadyprep.com
```

---

## PHASE 6: CI/CD (GitHub Actions)

### 6.1 GitHub Actions Workflow

```bash
mkdir -p .github/workflows

cat > .github/workflows/deploy.yml << 'CIEOF'
name: Deploy to Production

on:
  push:
    branches: [ main ]
    paths-ignore:
      - '**.md'
      - 'docs/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Frontend
      run: |
        npm install
        npm run build
    
    - name: Deploy to Server
      env:
        DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
        DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
      run: |
        mkdir -p ~/.ssh
        echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
        chmod 600 ~/.ssh/deploy_key
        ssh-keyscan -H $DEPLOY_HOST >> ~/.ssh/known_hosts
        
        # Deploy
        ssh -i ~/.ssh/deploy_key deploy@$DEPLOY_HOST << 'SSHEOF'
        cd ~/mrreadyprep
        git pull origin main
        npm install
        npm run build
        source venv/bin/activate
        pip install -r requirements.txt
        psql $DATABASE_URL -f backend/migrations.sql
        systemctl reload mrreadyprep-api
SSHEOF

    - name: Notify Slack
      if: always()
      uses: slackapi/slack-github-action@v1.24.0
      with:
        webhook-url: ${{ secrets.SLACK_WEBHOOK }}
        payload: |
          {
            "text": "Deployment ${{ job.status }}"
          }
CIEOF
```

### 6.2 GitHub Secrets Setup

```
Settings → Secrets and variables → Actions → New repository secret

DEPLOY_KEY: (private SSH key)
DEPLOY_HOST: your_server_ip
SLACK_WEBHOOK: (optional)
```

---

## PHASE 7: POST-DEPLOYMENT CHECKLIST

### 7.1 Security

- [ ] SSL/TLS aktif (https://)
- [ ] SSH key-based auth only (password login disabled)
- [ ] Firewall rules: only 22, 80, 443
- [ ] Database password 32+ karakterlik
- [ ] SECRET_KEY production-unique
- [ ] environment=production doğrulandı

### 7.2 Performance

- [ ] Frontend bundle size < 500KB
- [ ] API response time < 200ms
- [ ] Database query time < 100ms
- [ ] Gzip compression enabled
- [ ] Browser cache enabled (30 days static)

### 7.3 Monitoring

- [ ] Nginx error log monitored
- [ ] Backend error log monitored
- [ ] Database backup running
- [ ] SSL certificate auto-renewal
- [ ] Health checks running

### 7.4 Extensions

- [ ] Email: SendGrid production key aktif
- [ ] Analytics: GA4 production ID set
- [ ] SEO: GSC credentials mounted
- [ ] Video: YouTube API credentials mounted
- [ ] Referral: Database tables created

---

## PHASE 8: PRODUCTION MONITORING

### 8.1 Real-time Logs

```bash
# API logs
sudo tail -f /var/log/mrreadyprep/error.log

# Nginx logs
sudo tail -f /var/log/nginx/mrreadyprep-access.log

# PM2 logs (if using)
pm2 logs mrreadyprep-api
```

### 8.2 Performance Metrics

```bash
# CPU/Memory
top

# Disk usage
df -h

# Network
netstat -tuln | grep :443

# Database
psql $DATABASE_URL -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datname = 'mrreadyprep_prod';"
```

### 8.3 Google Search Console

```
1. https://search.google.com/search-console
2. Add mrreadyprep.com
3. Verify ownership (DNS TXT record)
4. Submit sitemap
5. Monitor impressions/clicks
```

---

## TROUBLESHOOTING

### SSL Certificate yenilenemedi
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

### Database connection hatası
```bash
psql $DATABASE_URL -c "SELECT 1"
# Permissions kontrol et
psql -U postgres -c "GRANT ALL ON DATABASE mrreadyprep_prod TO mrreadyprep_prod;"
```

### API çökse
```bash
sudo systemctl restart mrreadyprep-api
sudo systemctl status mrreadyprep-api
sudo journalctl -u mrreadyprep-api -n 50
```

### High CPU usage
```bash
top -p $(pgrep -f gunicorn)
# Worker sayısını artır: --workers 8
```

### Disk doluysa
```bash
df -h
# Logs rotate et
sudo logrotate -f /etc/logrotate.d/mrreadyprep
```

---

## BAŞARIYI ÖLÇME

**Hedefler (1. ay):**
- Uptime: > 99%
- Page Load: < 2 sn
- API Response: < 200ms
- SSL Grade: A+
- Signups: 100+
- Free→Premium: 15-20%

**Check:**
```bash
# Uptime monitoring
curl -I https://mrreadyprep.com

# SSL test
curl https://www.ssllabs.com/ssltest/analyze.html?d=mrreadyprep.com

# Speed test
curl https://pagespeed.web.dev/?url=mrreadyprep.com
```

---

**NOT:** Production'a çıkış yapılmadan evvel bu checklist'i tamamen tamamla! 🚀
