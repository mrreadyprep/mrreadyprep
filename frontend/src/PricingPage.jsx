import { useState } from 'react'

export function PricingPage({ onUpgrade, onBack, hasPremium, userEmail }) {
  const billingOptions = {
    '1month': {
      duration: '1 Month',
      price: 50,
      monthlyPrice: 50,
      period: '/month',
      popular: false,
      savings: null
    },
    '3months': {
      duration: '3 Months',
      price: 70,
      monthlyPrice: 23.33,
      period: '/month',
      popular: true,
      savings: 'Save $80'
    },
    '6months': {
      duration: '6 Months',
      price: 120,
      monthlyPrice: 20,
      period: '/month',
      popular: false,
      savings: 'Save $180'
    }
  }

  const premiumFeatures = [
    'Instant feedback on Writing and Speaking',
    'Unlimited part exams & full mock tests',
    'Full access to all practice content',
    'AI scoring for Writing & Speaking (detailed analysis)',
    'My Progress: track improvement over time',
    'Detailed score history & mistake review',
    'Cancel anytime'
  ]

  const handleUpgrade = (billingPeriod) => {
    onUpgrade('premium', billingPeriod)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #f0e8ff 100%)',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto 60px', textAlign: 'center' }}>
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
          fontSize: '48px',
          fontWeight: '800',
          color: '#1a1a1a',
          margin: '0 0 20px'
        }}>
          Simple, Transparent Pricing
        </h1>

        <p style={{
          fontSize: '18px',
          color: '#666',
          margin: '0 0 40px',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: '1.6'
        }}>
          Get unlimited access to all TOEFL practice materials, AI-powered feedback, and 20 full-length mock tests.
        </p>

        {/* WELCOME50 Promo Banner - BIG AND BOLD */}
        <div style={{
          background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
          border: '3px solid #ff9800',
          borderRadius: '12px',
          padding: '24px 40px',
          marginBottom: '60px',
          display: 'inline-block',
          fontSize: '18px',
          fontWeight: '700',
          color: '#d84315',
          boxShadow: '0 8px 24px rgba(255, 152, 0, 0.3)'
        }}>
          🎉 Use code <strong>WELCOME50</strong> at checkout for 50% off your first month!
        </div>
      </div>

      {/* Billing Options - 3 Columns BIG */}
      <div style={{
        maxWidth: '1300px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '40px',
        marginBottom: '70px'
      }}>
        {Object.entries(billingOptions).map(([key, option]) => (
          <div
            key={key}
            style={{
              background: 'white',
              borderRadius: '16px',
              border: option.popular ? '3px solid #701fa1' : '2px solid #e0e0e0',
              padding: '50px 36px',
              boxShadow: option.popular
                ? '0 20px 60px rgba(112, 31, 161, 0.25)'
                : '0 4px 12px rgba(0,0,0,0.08)',
              position: 'relative',
              transform: option.popular ? 'scale(1.08)' : 'scale(1)',
              transition: 'all 0.3s ease'
            }}
          >
            {/* Popular Badge */}
            {option.popular && (
              <div style={{
                position: 'absolute',
                top: '-18px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #701fa1 0%, #9c27b0 100%)',
                color: 'white',
                padding: '8px 24px',
                borderRadius: '25px',
                fontSize: '13px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                boxShadow: '0 4px 15px rgba(112, 31, 161, 0.4)'
              }}>
                ⭐ Best Value
              </div>
            )}

            {/* Duration */}
            <h3 style={{
              fontSize: '28px',
              fontWeight: '800',
              margin: '0 0 20px',
              color: '#1a1a1a'
            }}>
              {option.duration}
            </h3>

            {/* Price - HUGE */}
            <div style={{ marginBottom: '32px' }}>
              <div style={{
                fontSize: '72px',
                fontWeight: '900',
                color: '#701fa1',
                lineHeight: '1',
                marginBottom: '8px'
              }}>
                ${option.price}
              </div>
              <div style={{
                fontSize: '16px',
                color: '#666',
                marginBottom: '12px',
                fontWeight: '600'
              }}>
                ${option.monthlyPrice.toFixed(2)}{option.period}
              </div>
              
              {/* Savings Badge */}
              {option.savings && (
                <div style={{
                  background: '#e8f5e9',
                  color: '#2e7d32',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '700',
                  textAlign: 'center'
                }}>
                  {option.savings}
                </div>
              )}
            </div>

            {/* CTA Button - BIGGER */}
            <button
              onClick={() => handleUpgrade(key)}
              style={{
                width: '100%',
                padding: '18px 20px',
                borderRadius: '10px',
                border: 'none',
                background: option.popular 
                  ? 'linear-gradient(135deg, #701fa1 0%, #9c27b0 100%)'
                  : '#701fa1',
                color: 'white',
                fontSize: '17px',
                fontWeight: '700',
                cursor: 'pointer',
                marginBottom: '32px',
                transition: 'all 0.3s',
                boxShadow: option.popular 
                  ? '0 8px 20px rgba(112, 31, 161, 0.3)'
                  : 'none'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-4px)'
                e.target.style.boxShadow = '0 12px 30px rgba(112, 31, 161, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = option.popular 
                  ? '0 8px 20px rgba(112, 31, 161, 0.3)'
                  : 'none'
              }}
            >
              Upgrade to Premium
            </button>

            {/* Features List */}
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              {premiumFeatures.map((feature, idx) => (
                <li
                  key={idx}
                  style={{
                    padding: '14px 0',
                    fontSize: '15px',
                    color: '#333',
                    borderTop: idx === 0 ? '2px solid #f0f0f0' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <span style={{
                    color: '#4caf50',
                    fontSize: '20px',
                    marginTop: '-2px',
                    flexShrink: 0,
                    fontWeight: 'bold'
                  }}>
                    ✓
                  </span>
                  <span style={{ fontWeight: '500' }}>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '16px',
        padding: '50px 40px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: '800',
          marginBottom: '40px',
          textAlign: 'center',
          color: '#1a1a1a'
        }}>
          Frequently Asked Questions
        </h2>

        <FAQ
          question="Can I cancel anytime?"
          answer="Yes! Cancel your subscription anytime from your account settings. No questions asked."
        />

        <FAQ
          question="What if I don't see improvement?"
          answer="Study with MRReadyPrep for 60+ days. If you don't improve your score, we'll refund 100% of your subscription cost."
        />

        <FAQ
          question="Can I switch billing plans?"
          answer="Yes, you can upgrade or downgrade your plan anytime. Changes take effect immediately."
        />

        <FAQ
          question="Do you offer student discounts?"
          answer="Yes! Email us at support@mrreadyprep.com with your student ID for an exclusive discount."
        />

        <FAQ
          question="What payment methods do you accept?"
          answer="We accept all major credit cards (Visa, Mastercard, American Express). We use secure payment processing."
        />
      </div>

      {/* Footer Info */}
      <div style={{
        maxWidth: '1000px',
        margin: '70px auto 0',
        textAlign: 'center',
        borderTop: '2px solid #eee',
        paddingTop: '50px'
      }}>
        <p style={{ fontSize: '16px', color: '#666', margin: 0 }}>
          Need help? Contact us at <strong>support@mrreadyprep.com</strong>
        </p>
      </div>
    </div>
  )
}

function FAQ({ question, answer }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ marginBottom: '24px', borderBottom: '2px solid #f0f0f0', paddingBottom: '24px' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a1a' }}>
          {question}
        </span>
        <span style={{ fontSize: '24px', color: '#701fa1', fontWeight: 'bold' }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <p style={{
          fontSize: '15px',
          color: '#666',
          marginTop: '16px',
          marginBottom: 0,
          lineHeight: '1.6'
        }}>
          {answer}
        </p>
      )}
    </div>
  )
}
