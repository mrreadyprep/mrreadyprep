import { useState, useEffect } from 'react'
import { apiFetch } from '../App'

export default function ReferralPanel({ userId }) {
  const [stats, setStats] = useState(null)
  const [copied, setCopied] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)

  const referralLink = `https://mrreadyprep.com/?ref=${userId}`

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, leaderboardRes] = await Promise.all([
          apiFetch('/api/referral/stats'),
          apiFetch('/api/referral/leaderboard')
        ])

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data)
        }

        if (leaderboardRes.ok) {
          const data = await leaderboardRes.json()
          setLeaderboard(data.leaderboard || [])
        }
      } catch (e) {
        console.error('Failed to fetch referral data:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div style={{ height: '200px' }} />
  }

  return (
    <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 24px' }}>
      {/* Referral Link Section */}
      <div style={{
        background: 'linear-gradient(135deg, #701fa1, #9d3fd8)',
        borderRadius: '16px',
        padding: '32px',
        color: '#fff',
        marginBottom: '40px'
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '24px' }}>
          🎉 Earn $5 per Referral
        </h2>
        <p style={{ margin: '0 0 24px', opacity: 0.9 }}>
          Invite friends. When they upgrade, you get $5 credit toward your subscription.
        </p>

        {/* Link Box */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            fontSize: '12px',
            opacity: 0.8,
            marginBottom: '8px'
          }}>
            Your referral link:
          </div>
          <div style={{
            fontSize: '14px',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            marginBottom: '12px'
          }}>
            {referralLink}
          </div>
          <button
            onClick={copyToClipboard}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s'
            }}
          >
            {copied ? '✓ Copied!' : '📋 Copy Link'}
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '16px',
            marginTop: '24px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                {stats.total_invites}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                Invites Sent
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                {stats.completed_referrals}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                Conversions
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                ${stats.total_earnings.toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                Earnings
              </div>
            </div>
          </div>
        )}
      </div>

      {/* How It Works */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>How It Works</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px'
        }}>
          {[
            { num: '1', title: 'Share Your Link', desc: 'Send your unique referral link to friends' },
            { num: '2', title: 'They Sign Up', desc: 'Friend creates an account via your link' },
            { num: '3', title: 'They Upgrade', desc: 'Friend upgrades to Premium (auto 50% off)' },
            { num: '4', title: 'You Earn $5', desc: 'Get $5 credit toward your subscription' }
          ].map((step, idx) => (
            <div key={idx} style={{
              background: '#f8f9fa',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #e1e4ed'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: '#701fa1',
                color: '#fff',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                marginBottom: '12px'
              }}>
                {step.num}
              </div>
              <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>
                {step.title}
              </h4>
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: '#616473'
              }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          border: '1px solid #e1e4ed'
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>
            🏆 Top Referrers
          </h3>
          <div>
            {leaderboard.slice(0, 5).map((user, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: idx < 4 ? '1px solid #e1e4ed' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#701fa1',
                    color: '#fff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '14px'
                  }}>
                    {user.rank}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>
                      {user.username}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#9ca3af'
                    }}>
                      {user.completed} conversions
                    </div>
                  </div>
                </div>
                <div style={{ fontWeight: '700', color: '#701fa1' }}>
                  ${user.earnings.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      <div style={{ marginTop: '40px', marginBottom: '40px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>FAQ</h3>
        {[
          {
            q: 'What if my friend uses a promo code?',
            a: 'Referral discount (50% off) stacks with other offers. They get the better deal.'
          },
          {
            q: 'How long does my friend have to upgrade?',
            a: '30 days from clicking your link. Upgrade must happen within this window.'
          },
          {
            q: 'Can I reach the top of the leaderboard?',
            a: 'Yes! More referrals = more earnings. Max earnings apply after 10 referrals/month.'
          },
          {
            q: 'How do I use my referral credits?',
            a: 'Credits apply automatically at checkout. $5 credit = half off one month.'
          }
        ].map((item, idx) => (
          <div key={idx} style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600' }}>
              {item.q}
            </h4>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#616473'
            }}>
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
