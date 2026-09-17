import { useState } from 'react'

export function PricingPage({ onUpgrade, onBack, hasPremium, userEmail }) {
  const [billingPeriod, setBillingPeriod] = useState('1month')
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState(null)

  const validPromoCodes = ['SAVE50', 'HALF2024', 'EARLYBIRD', 'WELCOME50']
  const promoDiscount = 0.5 // 50% off

  const plans = {
    free: {
      name: 'Free',
      price: 0,
      cta: 'Current Plan',
      ctaDisabled: true,
      popular: false,
      description: 'Get started with TOEFL prep',
      features: [
        'Limited practice items from every category',
        'Reading, Listening, Writing, Speaking practice',
        'No credit card required'
      ]
    },
    premium: {
      name: 'Premium',
      prices: {
        '1month': 50,
        '3months': 120,
        '6months': 200
      },
      cta: 'Upgrade to Premium',
      popular: true,
      description: 'Unlimited access',
      features: [
        'Instant feedback on Writing and Speaking',
        'Unlimited part exams & full mock tests',
        'Full access to all practice content',
        'AI scoring for Writing & Speaking (detailed analysis)',
        'My Progress: track improvement over time',
        'Detailed score history & mistake review',
        'Cancel anytime'
      ]
    }
  }

  const handleApplyPromo = () => {
    const code = promoCode.toUpperCase().trim()
    if (validPromoCodes.includes(code)) {
      setAppliedPromo(code)
    } else {
      setAppliedPromo(null)
      alert('Invalid promo code')
    }
  }

  const getDiscountedPrice = (originalPrice) => {
    if (!appliedPromo) return originalPrice
    return (originalPrice * (1 - promoDiscount)).toFixed(2)
  }

  const getPremiumPrice = () => {
    const originalPrice = plans.premium.prices[billingPeriod]
    const discountedPrice = getDiscountedPrice(originalPrice)
    
    let periodLabel = ''
    if (billingPeriod === '1month') periodLabel = '/month'
    else if (billingPeriod === '3months') periodLabel = ' for 3 months'
    else if (billingPeriod === '6months') periodLabel = ' for 6 months'

    if (appliedPromo && discountedPrice != originalPrice) {
      return (
        <div>
          <div style={{ fontSize: '36px', fontWeight: '800', color: '#701fa1' }}>
            ${discountedPrice}
          </div>
          <div style={{ fontSize: '13px', color: '#999', marginTop: '4px', textDecoration: 'line-through' }}>
            ${originalPrice}{periodLabel}
          </div>
          <div style={{ fontSize: '12px', color: '#2ac56c', marginTop: '6px', fontWeight: '600' }}>
            50% OFF
          </div>
        </div>
      )
    }

    return (
      <div style={{ fontSize: '36px', fontWeight: '800', color: '#701fa1' }}>
        ${originalPrice}{periodLabel}
      </div>
    )
  }

  const handleUpgrade = (planName) => {
    if (planName === 'free') return
    onUpgrade(planName, billingPeriod)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #f0e8ff 100%)',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{ maxWidth: '1100px', margin: '0 auto 50px', textAlign: 'center' }}>
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            background: 'white',
            border: '1px solid #e0e0e0',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          ← Back
        </button>

        <h1 style={{
          fontSize: '42px',
          fontWeight: '700',
          color: '#1a1a1a',
          margin: '0 0 16px'
        }}>
          Upgrade to Premium
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          margin: '0 0 40px',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          Get unlimited access to all TOEFL practice materials and 20 full-length mock tests.
        </p>

        {/* Promo Code Section */}
        <div style={{
          background: '#f0e8ff',
          border: '2px solid #701fa1',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '30px',
          maxWidth: '400px',
          margin: '0 auto 30px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#701fa1', marginBottom: '12px' }}>
            Have a promo code? 🎉
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="e.g. WELCOME50"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApplyPromo()}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={handleApplyPromo}
              style={{
                padding: '10px 16px',
                background: '#701fa1',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Apply
            </button>
          </div>
          {appliedPromo && (
            <div style={{ fontSize: '12px', color: '#2ac56c', marginTop: '8px', fontWeight: '600' }}>
              ✓ Applied: {appliedPromo}
            </div>
          )}
        </div>

        {/* Billing Period Toggle */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setBillingPeriod('1month')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: billingPeriod === '1month' ? '2px solid #701fa1' : '1px solid #ddd',
              background: billingPeriod === '1month' ? '#f3e8ff' : 'white',
              color: billingPeriod === '1month' ? '#701fa1' : '#666',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            1 Month
          </button>
          <button
            onClick={() => setBillingPeriod('3months')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: billingPeriod === '3months' ? '2px solid #701fa1' : '1px solid #ddd',
              background: billingPeriod === '3months' ? '#f3e8ff' : 'white',
              color: billingPeriod === '3months' ? '#701fa1' : '#666',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            3 Months
          </button>
          <button
            onClick={() => setBillingPeriod('6months')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: billingPeriod === '6months' ? '2px solid #701fa1' : '1px solid #ddd',
              background: billingPeriod === '6months' ? '#f3e8ff' : 'white',
              color: billingPeriod === '6months' ? '#701fa1' : '#666',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            6 Months
          </button>
        </div>
      </div>

      {/* Pricing Cards - Side by Side */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '30px',
        marginBottom: '50px'
      }}>
        {/* Free Plan */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            padding: '40px 28px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <h3 style={{
            fontSize: '22px',
            fontWeight: '700',
            margin: '0 0 12px',
            color: '#1a1a1a'
          }}>
            {plans.free.name}
          </h3>

          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: '0 0 24px'
          }}>
            {plans.free.description}
          </p>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#701fa1' }}>
              $0
            </div>
          </div>

          <button
            disabled={true}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#f0f0f0',
              color: '#999',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'not-allowed',
              marginBottom: '28px'
            }}
          >
            Current Plan
          </button>

          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            flex: 1
          }}>
            {plans.free.features.map((feature, idx) => (
              <li
                key={idx}
                style={{
                  padding: '12px 0',
                  fontSize: '14px',
                  color: '#333',
                  borderTop: idx === 0 ? '1px solid #f0f0f0' : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <span style={{ color: '#701fa1', fontSize: '18px', flexShrink: 0 }}>✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Premium Plan */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            border: '2px solid #701fa1',
            padding: '40px 28px',
            position: 'relative',
            boxShadow: '0 10px 40px rgba(112, 31, 161, 0.15)',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{
            position: 'absolute',
            top: '-14px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#701fa1',
            color: 'white',
            padding: '6px 18px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Most Popular
          </div>

          <h3 style={{
            fontSize: '22px',
            fontWeight: '700',
            margin: '0 0 12px',
            color: '#1a1a1a'
          }}>
            {plans.premium.name}
          </h3>

          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: '0 0 24px'
          }}>
            {plans.premium.description}
          </p>

          <div style={{ marginBottom: '24px' }}>
            {getPremiumPrice()}
          </div>

          <button
            onClick={() => handleUpgrade('premium')}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#701fa1',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '28px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#5a1680'}
            onMouseLeave={(e) => e.target.style.background = '#701fa1'}
          >
            {plans.premium.cta}
          </button>

          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            flex: 1
          }}>
            {plans.premium.features.map((feature, idx) => (
              <li
                key={idx}
                style={{
                  padding: '12px 0',
                  fontSize: '14px',
                  color: '#333',
                  borderTop: idx === 0 ? '1px solid #f0f0f0' : 'none',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}
              >
                <span style={{ color: '#701fa1', fontSize: '18px', flexShrink: 0 }}>✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer Info */}
      <div style={{
        maxWidth: '1000px',
        margin: '60px auto 0',
        textAlign: 'center',
        borderTop: '1px solid #eee',
        paddingTop: '40px'
      }}>
        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
          Questions? Email <strong>support@mrreadyprep.com</strong>
        </p>
      </div>
    </div>
  )
}
