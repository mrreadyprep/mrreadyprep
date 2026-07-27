#!/bin/bash
cd "$(dirname "$0")"
echo "== venv aktif ediliyor =="
source ../.venv/bin/activate
echo "== eksik paketler kuruluyor (uvicorn, fastapi dahil) =="
pip install -r requirements.txt
echo "== 8000 portunu kullanan eski surecler kapatiliyor =="
lsof -ti:8000 | xargs kill -9 2>/dev/null
sleep 1
echo "== backend baslatiliyor =="
python -m uvicorn main:app --reload --port 8000
