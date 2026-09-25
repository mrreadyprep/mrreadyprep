# SEO Monitoring: GSC, Rankings, Backlinks
import os
import json
from datetime import datetime, timedelta
import requests
import psycopg2

# Google Search Console API
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# Initialize GSC
try:
    gsc_credentials = Credentials.from_service_account_file(
        'gsc-credentials.json',
        scopes=['https://www.googleapis.com/auth/webmasters.readonly']
    )
    gsc_service = build('webmasters', 'v3', credentials=gsc_credentials)
except Exception as e:
    print(f"GSC init error: {e}")
    gsc_service = None

class SEOMonitor:
    def __init__(self):
        self.site_url = 'https://mrreadyprep.com/'
        self.keywords = [
            'TOEFL prep',
            'TOEFL practice test',
            'TOEFL 2026 format',
            'TOEFL vs Magoosh',
            'TOEFL AI scoring',
            'TOEFL reading practice',
            'TOEFL speaking tips'
        ]
        self.db_conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        self.cursor = self.db_conn.cursor()
    
    def get_gsc_metrics(self):
        """Fetch Google Search Console performance data"""
        if not gsc_service:
            return None
        
        try:
            start_date = (datetime.now() - timedelta(days=28)).strftime('%Y-%m-%d')
            end_date = datetime.now().strftime('%Y-%m-%d')
            
            request = gsc_service.searchanalytics().query(
                siteUrl=self.site_url,
                body={
                    'startDate': start_date,
                    'endDate': end_date,
                    'dimensions': ['query', 'page', 'device'],
                    'rowLimit': 100
                }
            )
            results = request.execute()
            
            # Calculate metrics
            rows = results.get('rows', [])
            total_clicks = sum(r.get('clicks', 0) for r in rows)
            total_impressions = sum(r.get('impressions', 0) for r in rows)
            
            if len(rows) > 0:
                avg_ctr = sum(r.get('ctr', 0) for r in rows) / len(rows)
                avg_position = sum(r.get('position', 0) for r in rows) / len(rows)
            else:
                avg_ctr = 0
                avg_position = 0
            
            # Top queries
            top_queries = sorted(rows, key=lambda x: x.get('clicks', 0), reverse=True)[:10]
            
            metrics = {
                'total_clicks': total_clicks,
                'total_impressions': total_impressions,
                'avg_ctr': round(avg_ctr, 4),
                'avg_position': round(avg_position, 1),
                'top_queries': [
                    {
                        'query': q.get('query'),
                        'clicks': q.get('clicks', 0),
                        'impressions': q.get('impressions', 0),
                        'ctr': round(q.get('ctr', 0), 4),
                        'position': round(q.get('position', 0), 1)
                    }
                    for q in top_queries
                ]
            }
            
            return metrics
        except Exception as e:
            print(f"GSC metrics error: {e}")
            return None
    
    def track_keyword_rankings(self):
        """Track keyword rankings using SerpAPI"""
        serpapi_key = os.getenv('SERPAPI_API_KEY')
        if not serpapi_key:
            return
        
        for keyword in self.keywords:
            try:
                url = "https://serpapi.com/search"
                params = {
                    'q': keyword,
                    'location': 'United States',
                    'api_key': serpapi_key
                }
                
                response = requests.get(url, params=params, timeout=10)
                if response.status_code != 200:
                    continue
                
                data = response.json()
                
                # Find mrreadyprep rank
                rank = None
                for i, result in enumerate(data.get('organic_results', [])):
                    if 'mrreadyprep.com' in result.get('link', ''):
                        rank = i + 1
                        break
                
                # Store rank
                self.cursor.execute(
                    '''
                    INSERT INTO keyword_rankings (keyword, rank, checked_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (keyword, DATE(checked_at)) 
                    DO UPDATE SET rank = EXCLUDED.rank
                    ''',
                    (keyword, rank)
                )
                self.db_conn.commit()
                print(f"✅ {keyword}: rank {rank}")
                
            except Exception as e:
                print(f"Ranking error for '{keyword}': {e}")
    
    def monitor_backlinks(self):
        """Monitor backlinks from key sources"""
        sources = {
            'reddit.com': 'Reddit',
            'medium.com': 'Medium',
            'quora.com': 'Quora',
            'dev.to': 'Dev.to'
        }
        
        for source_domain, source_name in sources.items():
            try:
                # Use Ahrefs or similar service
                # For now, track manually via content
                self.cursor.execute(
                    '''
                    INSERT INTO backlink_sources (source_domain, source_name, checked_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (source_domain, DATE(checked_at))
                    DO UPDATE SET checked_at = NOW()
                    ''',
                    (source_domain, source_name)
                )
                self.db_conn.commit()
                
            except Exception as e:
                print(f"Backlink error: {e}")
    
    def store_gsc_metrics(self):
        """Store GSC metrics in database"""
        metrics = self.get_gsc_metrics()
        if not metrics:
            return
        
        try:
            self.cursor.execute(
                '''
                INSERT INTO seo_metrics (date, clicks, impressions, avg_ctr, avg_position, top_queries)
                VALUES (NOW(), %s, %s, %s, %s, %s)
                ''',
                (
                    metrics['total_clicks'],
                    metrics['total_impressions'],
                    metrics['avg_ctr'],
                    metrics['avg_position'],
                    json.dumps(metrics['top_queries'])
                )
            )
            self.db_conn.commit()
            print(f"✅ GSC metrics stored: {metrics['total_clicks']} clicks, {metrics['total_impressions']} impressions")
        except Exception as e:
            print(f"Store metrics error: {e}")
    
    def run_all_checks(self):
        """Run all SEO monitoring checks"""
        print("🔍 Running SEO monitoring checks...")
        self.store_gsc_metrics()
        self.track_keyword_rankings()
        self.monitor_backlinks()
        self.cursor.close()
        self.db_conn.close()
        print("✅ SEO monitoring complete")

# Main execution
if __name__ == '__main__':
    monitor = SEOMonitor()
    monitor.run_all_checks()
