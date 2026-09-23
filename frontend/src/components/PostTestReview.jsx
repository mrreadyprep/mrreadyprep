import React, { useState, useEffect } from 'react';

// Same pattern as App.jsx's BACKEND_URL -- a bare '/api/...' fetch resolves against this
// frontend's own Vercel domain (mrreadyprep.com), not the backend, since there's no rewrite
// proxying /api/* to api.mrreadyprep.com.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// Must match App.jsx's AUTH_TOKEN_KEY -- the backend's /api/reviews/submit requires a logged-in
// user (get_current_user), so the request needs the same Bearer token App.jsx attaches via its
// own apiFetch() wrapper. That wrapper lives in App.jsx and isn't exported, so this component
// reads the token itself under the exact same localStorage key.
const AUTH_TOKEN_KEY = 'mrreadyprep_token';

export default function PostTestReview({ isOpen, onClose, courseType = 'all_sections' }) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [course, setCourse] = useState(courseType);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCourse(courseType);
  }, [courseType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    if (reviewText.trim() && reviewText.trim().length < 10) {
      setError('Review must be at least 10 characters');
      return;
    }
    if (reviewText.trim().length > 2000) {
      setError('Review cannot exceed 2000 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      let authToken = '';
      try { authToken = localStorage.getItem(AUTH_TOKEN_KEY) || ''; } catch { /* ignore */ }

      if (!authToken) {
        setError('Please log in to submit a review.');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/reviews/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          rating: parseInt(rating),
          title: title.trim(),
          review_text: reviewText.trim(),
          course: course,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        // Reset form
        setTitle('');
        setReviewText('');
        setRating(5);
        // Auto-close after 3 seconds
        setTimeout(() => {
          onClose();
          setSubmitted(false);
        }, 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Could not submit review. Please try again.');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      console.error('Error submitting review:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Styles
  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  };

  const modalStyle = {
    backgroundColor: 'white',
    borderRadius: '16px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
    animation: 'slideUp 0.3s ease',
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, #701fa1 0%, #5a1684 100%)',
    color: 'white',
    padding: '40px 30px',
    borderRadius: '16px 16px 0 0',
    textAlign: 'center',
  };

  const headerTitleStyle = {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '8px',
  };

  const headerSubtitleStyle = {
    fontSize: '14px',
    opacity: 0.9,
  };

  const bodyStyle = {
    padding: '40px 30px',
    maxHeight: '60vh',
    overflowY: 'auto',
  };

  const formGroupStyle = {
    marginBottom: '25px',
  };

  const labelStyle = {
    display: 'block',
    fontWeight: '600',
    fontSize: '14px',
    marginBottom: '10px',
    color: '#1f2937',
  };

  const ratingOptionsStyle = {
    display: 'flex',
    gap: '10px',
    justifyContent: 'space-between',
  };

  const ratingBtnStyle = (selected) => ({
    flex: 1,
    padding: '12px',
    textAlign: 'center',
    border: selected ? 'none' : '2px solid #e5e7eb',
    background: selected ? 'linear-gradient(135deg, #701fa1 0%, #5a1684 100%)' : 'white',
    color: selected ? 'white' : '#6b7280',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '16px',
    transition: 'all 0.2s',
  });

  const inputStyle = {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontFamily: 'inherit',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const textareaStyle = {
    ...inputStyle,
    resize: 'vertical',
    minHeight: '100px',
  };

  const charCountStyle = {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '5px',
  };

  const selectStyle = {
    ...inputStyle,
  };

  const errorStyle = {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '20px',
    border: '1px solid #fecaca',
  };

  const successStyle = {
    backgroundColor: '#dcfce7',
    color: '#166534',
    padding: '20px',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
    fontWeight: '600',
  };

  const footerStyle = {
    padding: '30px',
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    gap: '12px',
  };

  const btnStyle = (isPrimary) => ({
    flex: 1,
    padding: '12px 20px',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: isPrimary
      ? 'linear-gradient(135deg, #701fa1 0%, #5a1684 100%)'
      : '#f3f4f6',
    color: isPrimary ? 'white' : '#374151',
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={headerTitleStyle}>Great Job! 🎉</div>
          <div style={headerSubtitleStyle}>Help other students by sharing your experience</div>
        </div>

        <div style={bodyStyle}>
          {submitted ? (
            <div style={successStyle}>
              ✓ Your review has been submitted! Thank you 🙏
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div style={errorStyle}>{error}</div>}

              {/* Rating */}
              <div style={formGroupStyle}>
                <label style={labelStyle}>How would you rate this practice session?</label>
                <div style={ratingOptionsStyle}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      style={ratingBtnStyle(rating === num)}
                      onClick={() => setRating(num)}
                    >
                      {num}⭐
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div style={formGroupStyle}>
                <label style={labelStyle}>Title (required)</label>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="e.g., Loved the speaking section"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  required
                />
                <div style={charCountStyle}>{title.length} / 100</div>
              </div>

              {/* Review Text */}
              <div style={formGroupStyle}>
                <label style={labelStyle}>Your review (optional)</label>
                <textarea
                  style={textareaStyle}
                  placeholder="What did you like? What would you recommend to other students?"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  maxLength={2000}
                />
                <div style={charCountStyle}>{reviewText.length} / 2000</div>
              </div>

              {/* Course Selection */}
              <div style={formGroupStyle}>
                <label style={labelStyle}>Which section did you practice?</label>
                <select
                  style={selectStyle}
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                >
                  <option value="all_sections">All Sections</option>
                  <option value="reading">Reading</option>
                  <option value="listening">Listening</option>
                  <option value="writing">Writing</option>
                  <option value="speaking">Speaking</option>
                </select>
              </div>

              {/* Footer Buttons */}
              <div style={footerStyle}>
                <button
                  type="button"
                  style={btnStyle(false)}
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Skip
                </button>
                <button
                  type="submit"
                  style={{
                    ...btnStyle(true),
                    opacity: isSubmitting ? 0.7 : 1,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
