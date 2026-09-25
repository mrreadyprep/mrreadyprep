// GA4 Analytics Setup with Event Tracking
import { getAnalytics, logEvent } from "firebase/analytics"
import { initializeApp } from "firebase/app"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_GA_API_KEY,
  authDomain: "mrreadyprep.firebaseapp.com",
  projectId: "mrreadyprep",
  storageBucket: "mrreadyprep.appspot.com",
  messagingSenderId: import.meta.env.VITE_GA_SENDER_ID,
  appId: import.meta.env.VITE_GA_APP_ID,
  measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID
}

let analytics = null

try {
  const app = initializeApp(firebaseConfig)
  analytics = getAnalytics(app)
} catch (e) {
  console.error('Analytics init error:', e)
}

export function trackEvent(eventName, eventParams = {}) {
  if (!analytics) return
  try {
    logEvent(analytics, eventName, eventParams)
  } catch (e) {
    console.error(`Event tracking error (${eventName}):`, e)
  }
}

export const trackingEvents = {
  // Signup Funnel
  signupStart: (source = 'organic') => trackEvent('signup_start', { source }),
  signupComplete: (method = 'email') => trackEvent('signup_complete', { method }),
  
  // Practice Funnel
  practiceStart: (skillType) => {
    trackEvent('practice_start', { skill_type: skillType })
    sessionStorage.setItem('practice_start_time', Date.now())
  },
  practiceComplete: (skillType, score, questions) => {
    const startTime = sessionStorage.getItem('practice_start_time')
    const timeSpent = startTime ? Math.round((Date.now() - startTime) / 1000) : 0
    trackEvent('practice_complete', {
      skill_type: skillType,
      score: Math.round(score),
      questions_attempted: questions,
      time_spent_seconds: timeSpent
    })
    sessionStorage.removeItem('practice_start_time')
  },
  
  // Mock Test Funnel
  mockTestStart: () => {
    trackEvent('mock_test_start', {})
    sessionStorage.setItem('mock_start_time', Date.now())
  },
  mockTestSubmit: (reading, listening, writing, speaking) => {
    const startTime = sessionStorage.getItem('mock_start_time')
    const totalTime = startTime ? Math.round((Date.now() - startTime) / 60000) : 0
    const totalScore = reading + listening + writing + speaking
    
    trackEvent('mock_test_submit', {
      reading_score: reading,
      listening_score: listening,
      writing_score: writing,
      speaking_score: speaking,
      total_score: totalScore,
      time_spent_minutes: totalTime
    })
    
    trackEvent('purchase', {
      value: 0, // Mock test is free for registered users
      currency: 'USD',
      items: [{
        item_id: 'mock_test',
        item_name: 'Full Mock Test',
        quantity: 1
      }]
    })
    
    sessionStorage.removeItem('mock_start_time')
  },
  
  // Upgrade Funnel
  upgradePrompt: (context = 'dashboard') => trackEvent('upgrade_prompt', { context }),
  upgradeStart: (plan = 'monthly') => trackEvent('upgrade_start', { plan }),
  upgradeComplete: (plan, price) => {
    trackEvent('purchase', {
      value: price,
      currency: 'USD',
      items: [{
        item_id: `plan_${plan}`,
        item_name: plan === 'monthly' ? 'Monthly Plan' : '6-Month Plan',
        price: price,
        quantity: 1
      }]
    })
  },
  
  // Engagement
  reviewSubmitted: (score) => trackEvent('review_submitted', { rating: score }),
  streakMilestone: (days) => trackEvent('streak_milestone', { days }),
  communityPostCreated: (category = 'general') => trackEvent('community_post_created', { category }),
  
  // Page Views (auto-tracked but can add custom)
  pageView: (pageName) => trackEvent('page_view', { page_name: pageName }),
  
  // Error Tracking
  errorOccurred: (errorMsg, component) => trackEvent('error', { 
    error_message: errorMsg,
    component 
  }),
  
  // Feature Usage
  featureUsed: (featureName) => trackEvent('feature_used', { feature: featureName }),
  videoWatched: (videoId, duration) => trackEvent('video_watch', { 
    video_id: videoId,
    duration_seconds: duration 
  })
}

// Track page navigation
export function initPageTracking() {
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', () => {
      const page = window.location.hash.slice(1) || 'home'
      trackingEvents.pageView(page)
    })
  }
}
