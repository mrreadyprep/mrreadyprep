import React, { useState, useEffect } from 'react';

// Same pattern as App.jsx's BACKEND_URL: a bare '/api/...' fetch resolves against
// mrreadyprep.com (this frontend's own Vercel domain), not the backend, since there's no
// rewrite proxying /api/* to api.mrreadyprep.com. Without this prefix the requests below
// silently fail (caught and swallowed) and the section is stuck showing zeros forever.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export default function ReviewsSection() {
  const [stats, setStats] = useState({
    average_rating: 0,
    total_reviews: 0,
    five_star_count: 0,
    four_star_count: 0,
    display_text: '',
  });
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch aggregate stats
        const statsRes = await fetch(`${BACKEND_URL}/api/reviews/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // Fetch top reviews (4-5 stars for landing page)
        const reviewsRes = await fetch(`${BACKEND_URL}/api/reviews/list?course=all_sections&limit=3`);
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setReviews(reviewsData.reviews || []);
        }
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const renderStars = (rating) => {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  };

  const courseNameMap = {
    'all_sections': 'All Sections',
    'reading': 'Reading',
    'listening': 'Listening',
    'writing': 'Writing',
    'speaking': 'Speaking',
  };

  const containerStyle = {
    backgroundColor: '#f9fafb',
    padding: '80px 20px',
    textAlign: 'center',
  };

  const contentStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const headingStyle = {
    fontSize: '36px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '16px',
  };

  const subheadingStyle = {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '60px',
    maxWidth: '600px',
    margin: '0 auto 60px',
  };

  const statsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '24px',
    marginBottom: '80px',
  };

  const statCardStyle = {
    background: 'linear-gradient(135deg, #701fa1 0%, #5a1684 100%)',
    color: 'white',
    padding: '30px 20px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(112, 31, 161, 0.15)',
  };

  const statNumberStyle = {
    fontSize: '40px',
    fontWeight: '700',
    display: 'block',
    marginBottom: '8px',
  };

  const statLabelStyle = {
    fontSize: '13px',
    opacity: 0.9,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const reviewsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    marginBottom: '60px',
  };

  const reviewCardStyle = {
    background: 'white',
    padding: '28px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    textAlign: 'left',
    border: '1px solid #e5e7eb',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  };

  const reviewCardHoverStyle = {
    ...reviewCardStyle,
    boxShadow: '0 8px 20px rgba(112, 31, 161, 0.1)',
    transform: 'translateY(-4px)',
  };

  const reviewHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  };

  const reviewUserStyle = {
    fontWeight: '600',
    fontSize: '14px',
    color: '#1f2937',
  };

  const reviewRatingStyle = {
    color: '#fbbf24',
    fontSize: '14px',
    fontWeight: '600',
  };

  const reviewCourseStyle = {
    fontSize: '12px',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '10px',
  };

  const reviewTitleStyle = {
    fontWeight: '600',
    fontSize: '15px',
    marginBottom: '8px',
    color: '#1f2937',
  };

  const reviewTextStyle = {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6',
  };

  const ctaButtonStyle = {
    background: 'linear-gradient(135deg, #701fa1 0%, #5a1684 100%)',
    color: 'white',
    padding: '14px 40px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(112, 31, 161, 0.3)',
  };

  const ctaButtonHoverStyle = {
    ...ctaButtonStyle,
    boxShadow: '0 6px 16px rgba(112, 31, 161, 0.4)',
    transform: 'translateY(-2px)',
  };

  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredBtn, setHoveredBtn] = useState(false);

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>
          <p style={{ color: '#9ca3af' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <h2 style={headingStyle}>⭐ Student Success Stories</h2>
        <p style={subheadingStyle}>
          See how our students are acing the TOEFL iBT and share your results to inspire the community
        </p>

        {/* Stats Grid */}
        <div style={statsGridStyle}>
          <div style={statCardStyle}>
            <span style={statNumberStyle}>{stats.average_rating.toFixed(1)}</span>
            <span style={statLabelStyle}>Average Rating</span>
          </div>
          <div style={statCardStyle}>
            <span style={statNumberStyle}>{stats.total_reviews}+</span>
            <span style={statLabelStyle}>Student Reviews</span>
          </div>
          <div style={statCardStyle}>
            <span style={statNumberStyle}>
              {stats.total_reviews > 0
                ? Math.round((stats.five_star_count / stats.total_reviews) * 100)
                : 0}
              %
            </span>
            <span style={statLabelStyle}>5-Star Ratings</span>
          </div>
        </div>

        {/* Reviews Grid */}
        {reviews.length > 0 && (
          <div style={reviewsGridStyle}>
            {reviews.map((review, idx) => (
              <div
                key={idx}
                style={hoveredCard === idx ? reviewCardHoverStyle : reviewCardStyle}
                onMouseEnter={() => setHoveredCard(idx)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div style={reviewHeaderStyle}>
                  <div style={reviewUserStyle}>{review.username}</div>
                  <div style={reviewRatingStyle}>{renderStars(review.rating)}</div>
                </div>
                <div style={reviewCourseStyle}>
                  {courseNameMap[review.course] || (review.course || 'all_sections').toUpperCase()}
                </div>
                <div style={reviewTitleStyle}>{review.title}</div>
                <div style={reviewTextStyle}>{review.review_text}</div>
              </div>
            ))}
          </div>
        )}

        {/* CTA Button */}
        <button
          style={hoveredBtn ? ctaButtonHoverStyle : ctaButtonStyle}
          onMouseEnter={() => setHoveredBtn(true)}
          onMouseLeave={() => setHoveredBtn(false)}
          onClick={() => {
            // Scroll to pricing or redirect to dashboard
            const pricingSection = document.getElementById('pricing');
            if (pricingSection) {
              pricingSection.scrollIntoView({ behavior: 'smooth' });
            }
          }}
        >
          + Share Your Success Story
        </button>
      </div>
    </div>
  );
}
