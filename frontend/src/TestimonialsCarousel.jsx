import { useState, useEffect } from 'react'

export function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)

  const testimonials = [
    {
      id: 1,
      name: 'Mehmet A.',
      score: 118,
      days: 45,
      quote: 'The video lessons were incredibly clear. I went from 95 to 118 in 45 days!',
      improvement: '+23',
      avatar: '👨‍💼'
    },
    {
      id: 2,
      name: 'Aisha M.',
      score: 115,
      days: 60,
      quote: 'The 20 mock tests felt exactly like the real TOEFL. Best practice I found.',
      improvement: '+22',
      avatar: '👩‍💻'
    },
    {
      id: 3,
      name: 'James L.',
      score: 120,
      days: 35,
      quote: 'Reached my target score in just 35 days. The structured approach really works!',
      improvement: '+25',
      avatar: '👨‍🎓'
    },
    {
      id: 4,
      name: 'Sofia R.',
      score: 117,
      days: 50,
      quote: 'Speaking practice feedback helped me improve my delivery. Highly recommended!',
      improvement: '+24',
      avatar: '👩‍🏫'
    },
    {
      id: 5,
      name: 'Chen W.',
      score: 119,
      days: 42,
      quote: 'The analytics dashboard showed me exactly where to focus. Very effective.',
      improvement: '+26',
      avatar: '👨‍💻'
    }
  ]

  useEffect(() => {
    if (!autoPlay) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [autoPlay, testimonials.length])

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    setAutoPlay(false)
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
    setAutoPlay(false)
  }

  const handleDotClick = (index) => {
    setCurrentIndex(index)
    setAutoPlay(false)
  }

  const testimonial = testimonials[currentIndex]

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #f8f5ff 0%, #fff5f0 100%)',
        borderRadius: '16px',
        padding: '60px 40px',
        maxWidth: '900px',
        margin: '50px auto',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
      }}
      onMouseEnter={() => setAutoPlay(false)}
      onMouseLeave={() => setAutoPlay(true)}
    >
      {/* Decorative background elements */}
      <div
        style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '200px',
          height: '200px',
          background: 'rgba(112, 31, 161, 0.05)',
          borderRadius: '50%',
          zIndex: 0
        }}
      />

      {/* Main content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#701fa1',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '12px'
            }}
          >
            ✨ SUCCESS STORIES
          </div>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: '0 0 16px'
            }}
          >
            Students Who Achieved Their Goals
          </h2>
          <p
            style={{
              fontSize: '16px',
              color: '#666',
              margin: 0,
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}
          >
            Join thousands of students who improved their TOEFL scores with MRReadyPrep
          </p>
        </div>

        {/* Testimonial Card */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '40px',
            marginBottom: '30px',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
            minHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          {/* Stars */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '18px', color: '#ffc107', letterSpacing: '2px' }}>
              ★ ★ ★ ★ ★
            </span>
          </div>

          {/* Quote */}
          <blockquote
            style={{
              fontSize: '20px',
              fontWeight: '500',
              color: '#333',
              margin: '0 0 30px',
              lineHeight: '1.6',
              borderLeft: '4px solid #701fa1',
              paddingLeft: '20px'
            }}
          >
            "{testimonial.quote}"
          </blockquote>

          {/* Author Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                fontSize: '48px',
                lineHeight: '1',
                width: '60px',
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f0f0f0',
                borderRadius: '50%'
              }}
            >
              {testimonial.avatar}
            </div>

            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' }}>
                {testimonial.name}
              </div>

              {/* Score & Stats */}
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  fontSize: '14px',
                  color: '#666'
                }}
              >
                <span>
                  <strong style={{ color: '#701fa1' }}>Score:</strong> {testimonial.score}
                </span>
                <span>•</span>
                <span>
                  <strong style={{ color: '#701fa1' }}>Time:</strong> {testimonial.days} days
                </span>
                <span>•</span>
                <span
                  style={{
                    background: '#e8f5e9',
                    color: '#2e7d32',
                    padding: '0 8px',
                    borderRadius: '4px',
                    fontWeight: '600'
                  }}
                >
                  {testimonial.improvement} points
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Dots */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '20px'
          }}
        >
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              style={{
                width: currentIndex === index ? '32px' : '10px',
                height: '10px',
                borderRadius: '5px',
                border: 'none',
                background: currentIndex === index ? '#701fa1' : '#ddd',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                padding: 0
              }}
              title={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>

        {/* Prev/Next Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '16px'
          }}
        >
          <button
            onClick={handlePrev}
            style={{
              background: 'white',
              border: '1px solid #ddd',
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f5f5f5'
              e.target.style.borderColor = '#701fa1'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white'
              e.target.style.borderColor = '#ddd'
            }}
          >
            ←
          </button>

          <button
            onClick={handleNext}
            style={{
              background: 'white',
              border: '1px solid #ddd',
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f5f5f5'
              e.target.style.borderColor = '#701fa1'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'white'
              e.target.style.borderColor = '#ddd'
            }}
          >
            →
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '24px',
          marginTop: '50px',
          paddingTop: '40px',
          borderTop: '1px solid rgba(0, 0, 0, 0.1)'
        }}
      >
        <StatCard number="10,000+" label="Active Students" />
        <StatCard number="4.9★" label="Average Rating" />
        <StatCard number="+23pts" label="Avg Improvement" />
        <StatCard number="98%" label="Success Rate" />
      </div>
    </div>
  )
}

function StatCard({ number, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: '28px',
          fontWeight: '800',
          color: '#701fa1',
          marginBottom: '8px'
        }}
      >
        {number}
      </div>
      <div style={{ fontSize: '13px', color: '#666', fontWeight: '600' }}>
        {label}
      </div>
    </div>
  )
}
