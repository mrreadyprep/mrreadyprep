import { useState } from 'react'

export function PricingPage({ onUpgrade, onBack, hasPremium, userEmail }) {
  const billingOptions = {
    '1month': {
      duration: '1 Month',
      price: 50,
      monthlyPrice: 50,
      period: '/month',
      popular: false
    },
    '3months': {
      duration: '3 Months',
      price: 120,
      monthlyPrice: 40,
      period: '/month (billed $120 for 3 months)',
      popular: true
    },
    '6months': {
      duration: '6 Months',
      price: 200,
      monthlyPrice: 33.33,
      period: '/month (billed $200 for 6 months)',
      popular: false
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
      <div style={{ maxWidth: '1200px', margin: '0 auto 50px', textAlign: 'center' }}>
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
          margin: '0 0 30px',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          Get unlimited access to all TOEFL practice materials and 20 full-length mock tests.
        </p>

        {/* WELCOME50 Promo Banner */}
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '14px 20px',
          marginBottom: '40px',
          display: 'inline-block',
          fontSize: '14px',
          fontWeight: '600',
          color: '#856404'
        }}>
          🎉 Use code <strong>WELCOME50</strong> at checkout for 50% off
        </div>
      </div>

      {/* Billing Options - 3 Columns */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '30px',
        marginBottom: '50px'
      }}>
        {Object.entries(billingOptions).map(([key, option]) => (
          <div
            key={key}
            style={{
              background: 'white',
              borderRadius: '12px',
              border: option.popular ? '2px solid #701fa1' : '1px solid #e0e0e0',
              padding: '40px 28px',
              boxShadow: option.popular
                ? '0 8px 24px rgba(112, 31, 161, 0.15)'
                : '0 2px 8px rgba(0,0,0,0.05)',
              position: 'relative',
              transform: option.popular ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.3s ease'
            }}
          >
            {/* Popular Badge */}
            {option.popular && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#701fa1',
                color: 'white',
                padding: '4px 16px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Best Value
              </div>
            )}

            {/* Duration */}
            <h3 style={{
              fontSize: '22px',
              fontWeight: '700',
              margin: '0 0 16px',
              color: '#1a1a1a'
            }}>
              {option.duration}
            </h3>

            {/* Price */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '42px',
                fontWeight: '800',
                color: '#701fa1',
                marginBottom: '4px'
              }}>
                ${option.price}
              </div>
              <div style={{
                fontSize: '13px',
                color: '#666',
                marginBottom: '8px'
              }}>
                ${option.monthlyPrice.toFixed(2)}{option.period}
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => handleUpgrade(key)}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#701fa1',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '28px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#5a1a7f'
                e.target.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#701fa1'
                e.target.style.transform = 'translateY(0)'
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
                    padding: '12px 0',
                    fontSize: '14px',
                    color: '#333',
                    borderTop: idx === 0 ? '1px solid #f0f0f0' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <span style={{
                    color: '#701fa1',
                    fontSize: '18px',
                    marginTop: '-2px',
                    flexShrink: 0
                  }}>
                    ✓
                  </span>
                  <span>{feature}</span>
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
        borderRadius: '12px',
        padding: '40px 30px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          marginBottom: '30px',
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
        margin: '60px auto 0',
        textAlign: 'center',
        borderTop: '1px solid #eee',
        paddingTop: '40px'
      }}>
        <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
          Need help? Contact us at <strong>support@mrreadyprep.com</strong>
        </p>
      </div>
    </div>
  )
}

function FAQ({ question, answer }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ marginBottom: '20px', borderBottom: '1px solid #f0f0f0', paddingBottom: '20px' }}>
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
        <span style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>
          {question}
        </span>
        <span style={{ fontSize: '20px', color: '#701fa1' }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <p style={{
          fontSize: '14px',
          color: '#666',
          marginTop: '12px',
          marginBottom: 0
        }}>
          {answer}
        </p>
      )}
    </div>
  )
}
