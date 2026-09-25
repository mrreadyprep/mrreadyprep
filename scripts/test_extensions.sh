#!/bin/bash

# Test Extensions 2-6 API Endpoints
# Usage: bash scripts/test_extensions.sh <JWT_TOKEN>

TOKEN=${1:-"test-token"}
API="http://localhost:8000"

echo "🧪 EXTENSION API TESTS"
echo "======================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -n "Testing: $description ... "
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -X GET "$API$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -w "\n%{http_code}")
    else
        response=$(curl -s -X POST "$API$endpoint" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -w "\n%{http_code}")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [[ $http_code == 2* ]]; then
        echo -e "${GREEN}✅ $http_code${NC}"
    elif [[ $http_code == 4* ]]; then
        echo -e "${YELLOW}⚠️  $http_code (Expected for unauth tests)${NC}"
    else
        echo -e "${RED}❌ $http_code${NC}"
    fi
}

echo "EXTENSION 2: Email"
test_endpoint "POST" "/api/emails/test" '{"template":"welcome"}' "Send test email"
echo ""

echo "EXTENSION 3: Analytics"
test_endpoint "POST" "/api/analytics/events" '{"event_name":"test_event","event_params":{}}' "Log analytics event"
test_endpoint "GET" "/api/analytics/dashboard" "" "Get analytics dashboard (admin)"
echo ""

echo "EXTENSION 4: SEO Monitoring"
test_endpoint "GET" "/api/seo/metrics" "" "Get SEO metrics (admin)"
test_endpoint "GET" "/api/seo/keywords" "" "Get keyword rankings (admin)"
test_endpoint "POST" "/api/seo/run-monitor" "" "Run SEO monitor (admin)"
echo ""

echo "EXTENSION 5: Video"
test_endpoint "GET" "/api/videos/schedule" "" "Get video schedule"
echo ""

echo "EXTENSION 6: Referral"
test_endpoint "POST" "/api/referral/track?ref=1" "" "Track referral click"
test_endpoint "GET" "/api/referral/stats" "" "Get referral stats"
test_endpoint "POST" "/api/referral/complete" '{"ref_id":1}' "Complete referral"
test_endpoint "GET" "/api/referral/leaderboard" "" "Get leaderboard"
echo ""

echo "======================"
echo "✅ API tests tamamlandı"
echo ""
echo "💡 Not: Authenticated endpoints 401 dönebilir"
echo "   Admin endpoints 403 dönebilir (normal)"
