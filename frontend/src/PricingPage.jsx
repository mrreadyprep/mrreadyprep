import { useState } from 'react'

export function PricingPage({ onUpgrade, onBack, hasPremium, userEmail }) {
  const [selectedPlan, setSelectedPlan] = useState('annual')
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromo, setAppliedPromo] = useState(null)

  const validPromoCodes = ['SAVE50', 'HALF2024', 'EARLYBIRD']
  const promoDiscount = 0.5 // 50% off

  const plans = {
    free: {
      name: 'Free',
      monthlyPrice: 0,
      annualPrice: 0,
      discount: null,
      features: [
        '5 practice questions per day',
        '1 full mock test (read-only)',
        'Basic progress tracking',
        'Mobile app access'
      ],
      cta: 'Current Plan',
      ctaDisabled: true,
      popular: false,
      description: 'Get started with TOEFL prep'
    },
    pro: {
      name: 'Pro',
      monthlyPrice: 40,
      annualPrice: 480,
      discount: 50,
      features: [
        'Unlimited practice questions',
        '20 full mock tests',
        'Detailed score analytics',
        'Video lesson library',
        'AI-powered explanations',
        'Speaking/Writing feedback',
        'Ad-free experience',
        '5-point score guarantee'
      ],
      cta: 'Upgrade to Pro',
      popular: true,
      description: 'Most popular choice'
    },
    proplus: {
      name: 'Pro Plus',
      monthlyPrice: 50,
      annualPrice: 600,
      discount: 50,
      features: [
        'Everything in Pro, plus:',
        'Priority email support (24hr response)',
        'Weekly 1-on-1 coaching call',
        'Personalized study plan',
        'Access to community forum',
        'Advanced practice insights',
        'Early access to new features'
      ],
      cta: 'Upgrade to Pro Plus',
      popular: false,
      description: 'Premium support & coaching'
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

  const getPriceDisplay = (plan) => {
    if (plan.monthlyPrice === 0) return '$0'

    if (selectedPlan === 'monthly') {
      const originalPrice = plan.monthlyPrice
      const discountedPrice = getDiscountedPrice(originalPrice)
      
      if (appliedPromo && discountedPrice != originalPrice) {
        return (
          <div>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#701fa1' }}>
              ${discountedPrice}/month
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', textDecoration: 'line-through' }}>
              ${originalPrice}/month
            </div>
          </div>
        )
      }
      return `$${originalPrice}/month`
    }

    const originalAnnual = plan.annualPrice
    const discountedAnnual = getDiscountedPrice(originalAnnual)
    const monthlyEquivalent = (discountedAnnual / 12).toFixed(2)
    const originalMonthly = (originalAnnual / 12).toFixed(2)

    return (
      <>
        <div style={{ fontSize: '28px', fontWeight: '800', color: '#701fa1' }}>
          ${discountedAnnual}
        </div>
        {appliedPromo && discountedAnnual != originalAnnual ? (
          <>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', textDecoration: 'line-through' }}>
              ${originalAnnual} (${originalMonthly}/month)
            </div>
            <div style={{ fontSize: '13px', color: '#2ac56c', marginTop: '2px', fontWeight: '600' }}>
              ${monthlyEquivalent}/month billed annually
            </div>
          </>
        ) : (
          <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
            ${monthlyEquivalent}/month billed annually
          </div>
        )}
      </>
    )
  }

  const handleUpgrade = (planName) => {
    if (planName === 'free') return
    onUpgrade(planName, selectedPlan === 'monthly' ? 'monthly' : 'annual')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #f0e8ff 100%)',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{ maxWidth: '1000px', margin: '0 auto 50px', textAlign: 'center' }}>
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
          Get unlimited access to all TOEFL practice materials, personalized coaching, and guaranteed score improvement.
        </p>

        {/* Score Guarantee Banner */}
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '30px',
          display: 'inline-block'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#856404' }}>
            🎯 <strong>5-Point Score Guarantee:</strong> Improve 5+ points or get 100% refund
          </div>
        </div>

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
              placeholder="Enter code (e.g. SAVE50)"
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
              ✓ Code applied: {appliedPromo} (50% off)
            </div>
          )}
        </div>

        {/* Billing Toggle */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '40px' }}>
          <button
            onClick={() => setSelectedPlan('monthly')}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: selectedPlan === 'monthly' ? '2px solid #701fa1' : '1px solid #ddd',
              background: selectedPlan === 'monthly' ? '#f3e8ff' : 'white',
              color: selectedPlan === 'monthly' ? '#701fa1' : '#666',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            Monthly Billing
          </button>
          <button
            onClick={() => setSelectedPlan('annual')}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: selectedPlan === 'annual' ? '2px solid #701fa1' : '1px solid #ddd',
              background: selectedPlan === 'annual' ? '#f3e8ff' : 'white',
              color: selectedPlan === 'annual' ? '#701fa1' : '#666',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            Annual Billing (Save 50%)
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        marginBottom: '50px'
      }}>
        {Object.entries(plans).map(([key, plan]) => (
          <div
            key={key}
            style={{
              background: 'white',
              borderRadius: '12px',
              border: plan.popular ? '2px solid #701fa1' : '1px solid #e0e0e0',
              padding: '32px 24px',
              position: 'relative',
              transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
              boxShadow: plan.popular
                ? '0 10px 40px rgba(112, 31, 161, 0.15)'
                : '0 2px 8px rgba(0,0,0,0.05)',
              transition: 'all 0.3s ease'
            }}
          >
            {/* Popular Badge */}
            {plan.popular && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#701fa1',
                color: 'white',
                padding: '4px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Most Popular
              </div>
            )}

            {/* Plan Name */}
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              margin: '0 0 8px',
              color: '#1a1a1a'
            }}>
              {plan.name}
            </h3>

            {/* Description */}
            <p style={{
              fontSize: '13px',
              color: '#666',
              margin: '0 0 20px'
            }}>
              {plan.description}
            </p>

            {/* Price */}
            <div style={{ marginBottom: '24px' }}>
              {typeof getPriceDisplay(plan) === 'string' ? (
                <div style={{ fontSize: '24px', fontWeight: '800', color: '#701fa1' }}>
                  {getPriceDisplay(plan)}
                </div>
              ) : (
                getPriceDisplay(plan)
              )}
            </div>

            {/* Discount Badge */}
            {plan.discount && selectedPlan === 'annual' && (
              <div style={{
                background: '#e8f5e9',
                color: '#2e7d32',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                Save {plan.discount}% with annual billing
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={() => handleUpgrade(key)}
              disabled={plan.ctaDisabled}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: 'none',
                background: plan.ctaDisabled ? '#f0f0f0' : '#701fa1',
                color: plan.ctaDisabled ? '#999' : 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: plan.ctaDisabled ? 'not-allowed' : 'pointer',
                marginBottom: '24px',
                transition: 'all 0.2s'
              }}
            >
              {plan.cta}
            </button>

            {/* Features List */}
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0
            }}>
              {plan.features.map((feature, idx) => (
                <li
                  key={idx}
                  style={{
                    padding: '10px 0',
                    fontSize: '14px',
                    color: '#333',
                    borderTop: idx === 0 ? '1px solid #f0f0f0' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span style={{ color: '#701fa1', fontSize: '18px' }}>✓</span>
                  {feature}
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
          question="What about the 5-point guarantee?"
          answer="Study with MRReadyPrep for 60+ days. If you don't improve 5+ points on the actual TOEFL exam, we'll refund 100% of your subscription cost."
        />

        <FAQ
          question="Can I switch plans?"
          answer="Yes, you can upgrade or downgrade your plan anytime. Changes take effect immediately."
        />

        <FAQ
          question="Do you offer student discounts?"
          answer="Yes! Email us at support@mrreadyprep.com with your student ID for an exclusive discount."
        />

        <FAQ
          question="What payment methods do you accept?"
          answer="We accept all major credit cards (Visa, Mastercard, American Express). We use Polar for secure payment processing."
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
          Need help? Contact us at <strong>support@mrreadyprep.com</strong> or check our <a href="#" style={{ color: '#701fa1', textDecoration: 'none' }}>FAQ</a>
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
