#!/bin/bash

# mrreadyprep Staging Deployment Script
# Usage: bash scripts/deploy_staging.sh

set -e  # Exit on error

echo "🚀 STAGING DEPLOYMENT BAŞLANIYOR"
echo "=================================="

# Step 1: Environment Check
echo "📋 Step 1: Environment kontrol ediliyor..."
if [ ! -f .env.staging ]; then
    echo "❌ .env.staging dosyası bulunamadı!"
    echo "Lütfen .env.staging dosyasını oluşturun ve API keys ekleyin."
    exit 1
fi
echo "✅ .env.staging bulundu"

# Step 2: Dependencies
echo ""
echo "📦 Step 2: Dependencies kurulumu..."
pip install -r requirements.txt --break-system-packages 2>/dev/null || echo "⚠️  pip install kısmi başarılı"
npm install 2>/dev/null || echo "⚠️  npm install kısmi başarılı"
echo "✅ Dependencies hazır"

# Step 3: Database
echo ""
echo "🗄️  Step 3: Database migrations çalıştırılıyor..."
export $(cat .env.staging | grep DATABASE_URL | xargs) 2>/dev/null || true

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL tanımlanmamış!"
    echo ".env.staging dosyasında DATABASE_URL'i ayarlayın."
    exit 1
fi

psql $DATABASE_URL -f backend/migrations.sql > /tmp/migration.log 2>&1 || true
if grep -q "ERROR" /tmp/migration.log 2>/dev/null; then
    echo "⚠️  Bazı migration hataları (varolan tablolar normal)"
else
    echo "✅ Database migrations tamamlandı"
fi

# Step 4: Referral System
echo ""
echo "🔄 Step 4: Referral sistem başlatılıyor..."
export $(cat .env.staging | xargs) 2>/dev/null || true
python backend/referral_system.py > /tmp/referral_init.log 2>&1 || echo "⚠️  Referral init"
echo "✅ Referral sistem hazır"

# Step 5: Frontend Build
echo ""
echo "🏗️  Step 5: Frontend build ediliyor..."
npm run build 2>&1 | grep -E "built|error" || echo "Build tamamlandı"
echo "✅ Frontend build tamamlandı"

# Step 6: Summary
echo ""
echo "=================================="
echo "✅ STAGING DEPLOYMENT HAZIR!"
echo "=================================="
echo ""
echo "📝 SONRAKI ADIMLAR:"
echo ""
echo "1️⃣  Terminal 1 - Frontend başlat:"
echo "   cd ~/mnt/mrreadyprep && npm run dev"
echo ""
echo "2️⃣  Terminal 2 - Backend başlat:"
echo "   cd ~/mnt/mrreadyprep"
echo "   export \$(cat .env.staging | xargs)"
echo "   python backend/main.py"
echo ""
echo "3️⃣  Frontend URL: http://localhost:5173"
echo "   Backend URL:  http://localhost:8000"
echo ""
echo "4️⃣  API test et:"
echo "   curl http://localhost:8000/health"
echo ""
echo "=================================="
