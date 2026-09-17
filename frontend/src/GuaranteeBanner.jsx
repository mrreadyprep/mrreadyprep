export function GuaranteeBanner() {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%)',
        border: '2px solid #ffc107',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '30px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 4px 12px rgba(255, 193, 7, 0.2)',
        maxWidth: '1200px',
        margin: '0 auto 30px'
      }}
    >
      <div style={{ fontSize: '32px', lineHeight: '1' }}>🎯</div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: '16px',
            fontWeight: '700',
            color: '#856404',
            marginBottom: '4px'
          }}
        >
          5-Point Score Guarantee
        </div>
        <div
          style={{
            fontSize: '14px',
            color: '#7a5c00',
            lineHeight: '1.4'
          }}
        >
          Study with MRReadyPrep for 60+ days and improve your score by 5+ points, or we'll refund 100% of your subscription. No questions asked.
        </div>
      </div>

      <div
        style={{
          fontSize: '28px',
          cursor: 'pointer',
          opacity: '0.6',
          transition: 'opacity 0.2s',
          lineHeight: '1'
        }}
        onMouseEnter={(e) => (e.target.style.opacity = '1')}
        onMouseLeave={(e) => (e.target.style.opacity = '0.6')}
        onClick={() => {
          // TODO: Scroll to FAQ or open modal with details
          console.log('Guarantee banner clicked')
        }}
        title="Learn more about our guarantee"
      >
        ℹ️
      </div>
    </div>
  )
}
