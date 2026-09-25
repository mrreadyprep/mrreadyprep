# Email Nurture Campaign Service
import os
from datetime import datetime, timedelta
import sendgrid
from sendgrid.helpers.mail import Mail
import psycopg2

sg = sendgrid.SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))

EMAIL_TEMPLATES = {
    'welcome': {
        'subject': 'Welcome to mrreadyprep — Here\'s your free access 🎓',
        'html': '''
            <h2>Welcome to mrreadyprep</h2>
            <p>You've just unlocked access to 20 full-length TOEFL practice tests + AI feedback.</p>
            <h3>What makes mrreadyprep different:</h3>
            <ul>
                <li>Mock tests match the 2026 adaptive format</li>
                <li>AI scoring is instant (same rubric ETS uses)</li>
                <li>Pricing is $25/month (way below Magoosh's $109)</li>
            </ul>
            <a href="https://mrreadyprep.com/practice/reading">Start with free Reading practice</a>
            <p>Questions? Reply to this email.</p>
        '''
    },
    'reading_tip': {
        'subject': 'The #1 thing students get wrong on Reading',
        'html': '''
            <h2>Master Reading: Academic Passages</h2>
            <p>Most students lose points on inference questions because they don't recognize discourse patterns.</p>
            <h3>The Strategy:</h3>
            <ol>
                <li>Read the question first (know what to look for)</li>
                <li>Find the paragraph mentioned</li>
                <li>Read 1 sentence before & after for context</li>
                <li>Eliminate wrong answers (find contradictions)</li>
            </ol>
            <a href="https://mrreadyprep.com/practice/reading">Try 3 free Reading passages</a>
        '''
    },
    'success_story': {
        'subject': '"I went from 71 to 108 in 10 weeks"',
        'html': '''
            <h2>Student Success Story: Priya</h2>
            <p><strong>Starting score:</strong> 71<br><strong>Final score:</strong> 108<br><strong>Time:</strong> 10 weeks</p>
            <blockquote>
                "I stopped studying everything and focused on my weakest skill—inference in Reading. Then I adapted my speaking approach. The adaptive format on mrreadyprep matched the real test perfectly."
            </blockquote>
            <p><strong>Key tactic:</strong> 30-minute daily practice + streak tracker</p>
            <a href="https://mrreadyprep.com/blog/priya-success-story">Read Priya's full story</a>
        '''
    },
    'speaking_pain': {
        'subject': 'Why your Speaking scores are stuck',
        'html': '''
            <h2>3 Reasons Your Speaking Plateaued</h2>
            <ol>
                <li><strong>No feedback on hesitations</strong> — you can't hear your own pauses</li>
                <li><strong>Inconsistent grading</strong> — different sources grade differently</li>
                <li><strong>No motivation</strong> — hard to stay consistent without progress</li>
            </ol>
            <h3>How mrreadyprep fixes it:</h3>
            <ul>
                <li>AI scoring shows exact hesitation points</li>
                <li>Consistent ETS-aligned rubric</li>
                <li>Streak counter + leaderboard = motivation</li>
            </ul>
            <a href="https://mrreadyprep.com/demo">See the demo</a>
        '''
    },
    'offer': {
        'subject': 'First month 50% off (ends Friday)',
        'html': '''
            <h2>Limited Offer: 50% Off First Month</h2>
            <p>If you've tested mrreadyprep's free tier, you know it works.</p>
            <h3>Premium includes:</h3>
            <ul>
                <li>All 20 mock tests (not just 3)</li>
                <li>Unlimited Writing/Speaking scoring</li>
                <li>Daily streak + leaderboard</li>
                <li>Community Q&A access</li>
            </ul>
            <h2 style="color: #701fa1;">$12.50 this month (normally $25)</h2>
            <a href="https://mrreadyprep.com/upgrade?promo=FIRSTMONTH50" 
               style="background: #701fa1; color: white; padding: 12px 24px; border-radius: 8px;">
               Upgrade Now
            </a>
            <p><small>Offer ends Friday at midnight</small></p>
        '''
    },
    'comparison': {
        'subject': 'How mrreadyprep stacks up vs Magoosh & ETS',
        'html': '''
            <h2>Comparison: mrreadyprep vs Competitors</h2>
            <table border="1" cellpadding="10" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <th>Feature</th>
                    <th>mrreadyprep</th>
                    <th>Magoosh</th>
                    <th>ETS Official</th>
                </tr>
                <tr>
                    <td>Monthly Price</td>
                    <td>$25</td>
                    <td>$109</td>
                    <td>$49/test</td>
                </tr>
                <tr>
                    <td>Mock Tests</td>
                    <td>20</td>
                    <td>5</td>
                    <td>2</td>
                </tr>
                <tr>
                    <td>Adaptive Format (2026)</td>
                    <td>✅</td>
                    <td>❌</td>
                    <td>✅</td>
                </tr>
                <tr>
                    <td>Instant AI Scoring</td>
                    <td>✅</td>
                    <td>❌</td>
                    <td>❌</td>
                </tr>
            </table>
            <a href="https://mrreadyprep.com/blog/mrreadyprep-vs-magoosh">Read full comparison</a>
        '''
    },
    'last_chance': {
        'subject': 'Closing out the free tier tomorrow',
        'html': '''
            <h2>Your Free Access Expires Tomorrow</h2>
            <p>If you've been using mrreadyprep, upgrade before Friday.</p>
            <p>After that, free access resets (fresh questions, but limited mocks).</p>
            <h3>Last chance for 50% off first month:</h3>
            <a href="https://mrreadyprep.com/upgrade?promo=LASTCHANCE" 
               style="background: #701fa1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
               Upgrade Now
            </a>
            <p>Questions? Reply here or visit <a href="https://mrreadyprep.com/help">Help Center</a></p>
        '''
    }
}

def send_email(to_email, template_key, variables=None):
    """Send templated email via SendGrid"""
    try:
        template = EMAIL_TEMPLATES.get(template_key)
        if not template:
            print(f"Template {template_key} not found")
            return False
        
        message = Mail(
            from_email='team@mrreadyprep.com',
            to_emails=to_email,
            subject=template['subject'],
            html_content=template['html']
        )
        
        sg.send(message)
        return True
    except Exception as e:
        print(f"Email error: {e}")
        return False

def send_campaign_emails():
    """Send emails to users based on signup date"""
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cursor = conn.cursor()
    
    # Get all users and their signup dates
    cursor.execute('''
        SELECT id, email, created_at FROM users WHERE is_premium = false
    ''')
    
    users = cursor.fetchall()
    
    for user_id, email, signup_date in users:
        days_since_signup = (datetime.utcnow() - signup_date).days
        
        # Determine which email to send
        if days_since_signup == 0:
            send_email(email, 'welcome')
        elif days_since_signup == 2:
            send_email(email, 'reading_tip')
        elif days_since_signup == 5:
            send_email(email, 'success_story')
        elif days_since_signup == 8:
            send_email(email, 'speaking_pain')
        elif days_since_signup == 11:
            send_email(email, 'offer')
        elif days_since_signup == 15:
            send_email(email, 'comparison')
        elif days_since_signup == 21:
            send_email(email, 'last_chance')
    
    cursor.close()
    conn.close()

# Schedule this to run daily via Celery or cron
if __name__ == '__main__':
    send_campaign_emails()
    print("Campaign emails sent")
