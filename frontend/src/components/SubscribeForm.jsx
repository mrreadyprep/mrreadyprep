import { useState } from 'react'

export default function SubscribeForm() {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // 'success', 'error', null
  
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !firstName) return
    
    setLoading(true)
    setStatus(null)
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, first_name: firstName })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setStatus('success')
        setEmail('')
        setFirstName('')
        setTimeout(() => setStatus(null), 5000)
      } else {
        setStatus('error')
      }
    } catch (err) {
      console.error('Subscribe error:', err)
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div style={{
      backgroundColor: '#1a2555',
      border: '1px solid #2a3f7f',
      borderRadius: '12px',
      padding: '30px',
      maxWidth: '500px',
      margin: '0 auto'
    }}>
      <h3 style={{
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '12px',
        color: '#fff'
      }}>
        Get blog updates
      </h3>
      
      <p style={{
        fontSize: '14px',
        color: '#aaa',
        marginBottom: '20px'
      }}>
        Join 500+ TOEFL test takers. Get strategies, tips, and updates every week.
      </p>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          style={{
            padding: '10px 12px',
            border: '1px solid #2a3f7f',
            borderRadius: '8px',
            backgroundColor: '#0f1a3f',
            color: '#fff',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
        
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: '10px 12px',
            border: '1px solid #2a3f7f',
            borderRadius: '8px',
            backgroundColor: '#0f1a3f',
            color: '#fff',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
        
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 16px',
            backgroundColor: '#5b8def',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#4a7ed9')}
          onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#5b8def')}
        >
          {loading ? 'Subscribing...' : 'Subscribe'}
        </button>
      </form>
      
      {status === 'success' && (
        <p style={{ fontSize: '14px', color: '#4ade80', marginTop: '12px', textAlign: 'center' }}>
          ✓ Welcome! Check your email for updates.
        </p>
      )}
      
      {status === 'error' && (
        <p style={{ fontSize: '14px', color: '#ff6b6b', marginTop: '12px', textAlign: 'center' }}>
          ✗ Could not subscribe. Try again.
        </p>
      )}
    </div>
  )
}
