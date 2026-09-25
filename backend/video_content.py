# Video Content Strategy & YouTube Integration
import os
import json
from datetime import datetime, timedelta
import psycopg2
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ['https://www.googleapis.com/auth/youtube.upload']

class VideoContentManager:
    def __init__(self):
        self.db_conn = psycopg2.connect(os.getenv('DATABASE_URL'))
        self.cursor = self.db_conn.cursor()
        self.youtube = self._init_youtube()
    
    def _init_youtube(self):
        """Initialize YouTube API"""
        try:
            creds = None
            if os.path.exists('youtube_token.json'):
                creds = Credentials.from_authorized_user_file('youtube_token.json', SCOPES)
            
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    flow = InstalledAppFlow.from_client_secrets_file(
                        'youtube_credentials.json', SCOPES)
                    creds = flow.run_local_server(port=0)
                
                with open('youtube_token.json', 'w') as token:
                    token.write(creds.to_json())
            
            return build('youtube', 'v3', credentials=creds)
        except Exception as e:
            print(f"YouTube init error: {e}")
            return None
    
    def upload_video(self, file_path, title, description, tags, playlist_id=None):
        """Upload video to YouTube"""
        if not self.youtube:
            print("YouTube API not initialized")
            return None
        
        try:
            body = {
                'snippet': {
                    'title': title,
                    'description': description,
                    'tags': tags,
                    'categoryId': '27'  # Education category
                },
                'status': {
                    'privacyStatus': 'public',
                    'madeForKids': False
                }
            }
            
            request = self.youtube.videos().insert(
                part='snippet,status',
                body=body,
                media_body=file_path
            )
            
            response = request.execute()
            video_id = response['id']
            print(f"✅ Video uploaded: {video_id}")
            
            # Add to playlist if provided
            if playlist_id:
                self._add_to_playlist(video_id, playlist_id)
            
            # Store in database
            self._store_video_metadata(video_id, title, file_path)
            
            return video_id
        except HttpError as e:
            print(f"Upload error: {e}")
            return None
    
    def _add_to_playlist(self, video_id, playlist_id):
        """Add video to YouTube playlist"""
        try:
            request = self.youtube.playlistItems().insert(
                part='snippet',
                body={
                    'snippet': {
                        'playlistId': playlist_id,
                        'resourceId': {
                            'kind': 'youtube#video',
                            'videoId': video_id
                        }
                    }
                }
            )
            request.execute()
            print(f"✅ Added to playlist: {playlist_id}")
        except Exception as e:
            print(f"Playlist error: {e}")
    
    def _store_video_metadata(self, video_id, title, file_path):
        """Store video metadata in database"""
        try:
            self.cursor.execute(
                '''
                INSERT INTO videos (video_id, title, youtube_url, uploaded_at, status)
                VALUES (%s, %s, %s, NOW(), 'published')
                ''',
                (video_id, title, f'https://youtube.com/watch?v={video_id}')
            )
            self.db_conn.commit()
        except Exception as e:
            print(f"Store metadata error: {e}")
    
    def create_video_schedule(self):
        """Create monthly video publishing schedule"""
        schedule = {
            'month': datetime.now().strftime('%Y-%m'),
            'videos': [
                {
                    'week': 1,
                    'type': 'Demo',
                    'title': 'How mrreadyprep Adaptive Practice Works',
                    'duration': '3-5 min',
                    'tags': ['TOEFL', 'adaptive practice', 'test prep'],
                    'cta': 'Start free practice'
                },
                {
                    'week': 2,
                    'type': 'Tutorial',
                    'title': 'TOEFL Reading: Complete the Words Strategy',
                    'duration': '8-12 min',
                    'tags': ['TOEFL', 'reading tips', 'vocabulary'],
                    'cta': 'Practice with our tool'
                },
                {
                    'week': 3,
                    'type': 'Tutorial',
                    'title': 'TOEFL Listening: Note-Taking Hacks',
                    'duration': '8-12 min',
                    'tags': ['TOEFL', 'listening tips', 'note-taking'],
                    'cta': 'Practice with our tool'
                },
                {
                    'week': 4,
                    'type': 'Success Story',
                    'title': 'From 71 to 108: Real Student Journey',
                    'duration': '3-5 min',
                    'tags': ['TOEFL', 'success story', 'motivation'],
                    'cta': 'Read the full story'
                }
            ]
        }
        
        # Store schedule in database
        self.cursor.execute(
            '''
            INSERT INTO video_schedule (month, schedule_json)
            VALUES (%s, %s)
            ON CONFLICT (month) DO UPDATE SET schedule_json = EXCLUDED.schedule_json
            ''',
            (schedule['month'], json.dumps(schedule))
        )
        self.db_conn.commit()
        print(f"✅ Video schedule created for {schedule['month']}")
        
        return schedule
    
    def get_video_performance(self, video_id):
        """Get video performance metrics"""
        if not self.youtube:
            return None
        
        try:
            request = self.youtube.videos().list(
                part='statistics,snippet',
                id=video_id
            )
            response = request.execute()
            
            if response['items']:
                item = response['items'][0]
                stats = item['statistics']
                snippet = item['snippet']
                
                metrics = {
                    'title': snippet['title'],
                    'views': int(stats.get('viewCount', 0)),
                    'likes': int(stats.get('likeCount', 0)),
                    'comments': int(stats.get('commentCount', 0)),
                    'shares': int(stats.get('shareCount', 0))
                }
                
                return metrics
        except Exception as e:
            print(f"Performance fetch error: {e}")
        
        return None
    
    def close(self):
        """Close database connection"""
        self.cursor.close()
        self.db_conn.close()

# Content templates
VIDEO_TEMPLATES = {
    'demo': {
        'title_template': 'How {feature} Works on mrreadyprep',
        'structure': [
            {'duration': 30, 'section': 'Intro (problem statement)'},
            {'duration': 120, 'section': 'Feature demo (screen recording)'},
            {'duration': 60, 'section': 'Results & benefits'},
            {'duration': 30, 'section': 'CTA & subscribe'}
        ]
    },
    'tutorial': {
        'title_template': 'TOEFL {section}: {strategy} Strategy',
        'structure': [
            {'duration': 30, 'section': 'Intro & problem'},
            {'duration': 180, 'section': 'Strategy breakdown (examples)'},
            {'duration': 120, 'section': 'Live practice walkthrough'},
            {'duration': 60, 'section': 'CTA (link to tool)'}
        ]
    },
    'success_story': {
        'title_template': 'From {starting_score} to {final_score}: Student Success',
        'structure': [
            {'duration': 30, 'section': 'Intro (student name/photo)'},
            {'duration': 120, 'section': 'Interview (challenges, strategy)'},
            {'duration': 60, 'section': 'Results (scores, timeline)'},
            {'duration': 30, 'section': 'CTA (link to blog/upgrade)'}
        ]
    }
}

if __name__ == '__main__':
    manager = VideoContentManager()
    schedule = manager.create_video_schedule()
    manager.close()
