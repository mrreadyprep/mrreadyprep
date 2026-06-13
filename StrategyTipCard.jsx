import { useState, useEffect } from 'react';

const SECTIONS = ['Reading', 'Listening', 'Speaking', 'Writing'];

function pickSectionForToday() {
  const day = new Date().getDate();
  return SECTIONS[day % SECTIONS.length];
}

export default function StrategyTipCard() {
  const [section, setSection] = useState(pickSectionForToday());
  const [tip, setTip] = useState('');
  const [loading, setLoading] = useState(true);

  async function fetchTip(targetSection) {
    setLoading(true);
    setSection(targetSection);
    try {
      const res = await fetch('/api/daily-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: targetSection }),
      });
      const data = await res.json();
      setTip(data.tip || 'Could not load a tip right now. Try refreshing.');
    } catch (err) {
      setTip('Could not load a tip right now. Try refreshing.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTip(pickSectionForToday());
  }, []);

  function handleRefresh() {
    const random = SECTIONS[Math.floor(Math.random() * SECTIONS.length)];
    fetchTip(random);
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            background: '#F3E8FF',
            color: '#6D28D9',
            fontSize: '12px',
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: '8px',
          }}
        >
          {section}
        </span>
        <button
          onClick={handleRefresh}
          aria-label="Get a new tip"
          disabled={loading}
          style={{
            background: 'transparent',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading ? 'default' : 'pointer',
            color: '#6b7280',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              transform: loading ? 'rotate(360deg)' : 'none',
              transition: loading ? 'transform 1s linear' : 'none',
              animation: loading ? 'spin 1s linear infinite' : 'none',
              fontSize: '14px',
              lineHeight: 1,
            }}
          >
            ↻
          </span>
        </button>
      </div>

      <p
        style={{
          fontSize: '13px',
          color: '#6b7280',
          margin: 0,
          fontWeight: 600,
        }}
      >
        Today's strategy tip
      </p>

      <p
        style={{
          fontSize: '15px',
          lineHeight: 1.6,
          margin: 0,
          minHeight: '72px',
          color: '#111827',
        }}
      >
        {loading ? 'Loading a fresh TOEFL 2026 strategy tip...' : tip}
      </p>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
