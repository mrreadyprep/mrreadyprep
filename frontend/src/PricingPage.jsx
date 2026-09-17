import { useState } from 'react'

export function PricingPage({ onUpgrade, onBack, hasPremium, userEmail }) {
  const [selectedPlan, setSelectedPlan] = useState('annual')

  const plans = {
    oneMonth: {
      name: '1 Month',
      monthlyPrice: 50,
      annualPrice: 50,
      discount: null,
      features: [
        'Unlimited access to all Reading Practice (Complete Words, Read in Daily Life, Academic Passage)',
        'Unlimited access to all Listening Practice (Choose Response, Conversation, Announcement, Academic Talk)',
        'Unlimited access to all Writing Practice (Build Sentence, Write Email, Academic Discussion)',
        'Unlimited access to all Speaking Practice (Listen & Repeat, Take Interview)',
        'All 20 Full Mock Tests (instead of just Test 1)',
        'Unlimited "practice one section" random mock drills',
        'Detailed progress analytics & score tracking',
        'AI feedback on all reading, listening, writing & speaking answers',
        'Score history & detailed mistake review',
        'Cancel anytime'
      ],
      cta: 'Choose Plan',
      ctaDisabled: false,
      popular: false,
      description: 'One month of full access'
    },
    threeMonths: {
      name: '3 Months',
      monthlyPrice: 70,
      annualPrice: 70,
      discount: null,
      features: [
        'Unlimited access to all Reading Practice (Complete Words, Read in Daily Life, Academic Passage)',
        'Unlimited access to all Listening Practice (Choose Response, Conversation, Announcement, Academic Talk)',
        'Unlimited access to all Writing Practice (Build Sentence, Write Email, Academic Discussion)',
        'Unlimited access to all Speaking Practice (Listen & Repeat, Take Interview)',
        'All 20 Full Mock Tests (instead of just Test 1)',
        'Unlimited "practice one section" random mock drills',
        'Detailed progress analytics & score tracking',
        'AI feedback on all reading, listening, writing & speaking answers',
        'Score history & detailed mistake review',
        'Cancel anytime'
      ],
      cta: 'Choose Plan',
      ctaDisabled: false,
      popular: true,
      description: 'Best value plan'
    },
    sixMonths: {
      name: '6 Months',
      monthlyPrice: 120,
      annualPrice: 120,
      discount: null,
      features: [
        'Unlimited access to all Reading Practice (Complete Words, Read in Daily Life, Academic Passage)',
        'Unlimited access to all Listening Practice (Choose Response, Conversation, Announcement, Academic Talk)',
        'Unlimited access to all Writing Practice (Build Sentence, Write Email, Academic Discussion)',
        'Unlimited access to all Speaking Practice (Listen & Repeat, Take Interview)',
        'All 20 Full Mock Tests (instead of just Test 1)',
        'Unlimited "practice one section" random mock drills',
        'Detailed progress analytics & score tracking',
        'AI feedback on all reading, listening, writing & speaking answers',
        'Score history & detailed mistake review',
        'Cancel anytime'
      ],
      cta: 'Choose Plan',
      ctaDisabled: false,
      popular: false,
      description: 'Extended access for serious prep'
    }
  }

  const getPriceDisplay = (plan) => {
    return (
      <div style={{ fontSize: '28px', fontWeight: '800', color: '#701fa1' }}>
        ${plan.monthlyPrice}
      </div>
    )
  }

  const handleUpgrade = (planName) => {
    onUpgrade(planName, 'monthly')
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
          Unlock Premium
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          margin: '0 0 30px',
          maxWidth: '600px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          Get unlimited access to all TOEFL practice materials, AI feedback on every answer, and comprehensive progress tracking.
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
                MOST POPULAR
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
              {getPriceDisplay(plan)}
            </div>

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
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  <span style={{ color: '#701fa1', fontSize: '18px', marginTop: '2px', flexShrink: 0 }}>✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Free Plan Comparison */}
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto 50px',
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
          What's Included Free
        </h2>

        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '20px',
          lineHeight: '1.6'
        }}>
          Start your TOEFL prep for free with access to:
        </p>

        <ul style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ color: '#701fa1', fontSize: '18px', marginTop: '2px', flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: '14px', color: '#333' }}>5 practice questions per day</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ color: '#701fa1', fontSize: '18px', marginTop: '2px', flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: '14px', color: '#333' }}>1 full mock test (read-only)</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ color: '#701fa1', fontSize: '18px', marginTop: '2px', flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: '14px', color: '#333' }}>Basic progress tracking</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ color: '#701fa1', fontSize: '18px', marginTop: '2px', flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: '14px', color: '#333' }}>900 vocabulary words with flashcards</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ color: '#701fa1', fontSize: '18px', marginTop: '2px', flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: '14px', color: '#333' }}>16 TOEFL guides & tips</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ color: '#701fa1', fontSize: '18px', marginTop: '2px', flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: '14px', color: '#333' }}>Mobile app access</span>
          </li>
        </ul>
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
          question="Which plan should I choose?"
          answer="Choose 3 Months if you're seriously preparing. Most students need 6-12 weeks to see significant improvement. Choose 6 Months if you want extended access to practice and refine your skills."
        />

        <FAQ
          question="Do you offer discounts?"
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
