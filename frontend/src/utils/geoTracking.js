import { getUserGeo, getCurrencySymbol, getPricingTierForRegion, formatLocation } from './geoDetect';

/**
 * Track user events with geo-location data
 * Sends to backend + GA4
 */
export async function trackGeoEvent(eventType, userId, additionalData = {}) {
  try {
    const geo = await getUserGeo();
    const countryCode = geo.country;

    // Send to backend
    const response = await fetch('https://api.mrreadyprep.com/api/events/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: eventType,
        user_id: userId,
        country_code: countryCode,
        additional_data: {
          country_name: geo.country_name,
          city: geo.city,
          region: geo.region,
          ...additionalData
        }
      })
    }).catch(err => console.warn('[GeoTrack] Backend error:', err));

    // Send to GA4
    if (window.gtag) {
      window.gtag('event', eventType, {
        'user_id': userId,
        'country': countryCode,
        'country_name': geo.country_name,
        'city': geo.city,
        ...additionalData
      });
    }

    console.log(`[GEO-TRACK] ${eventType} | ${geo.country} (${geo.country_name})`);
  } catch (error) {
    console.error('[GeoTrack] Error:', error);
  }
}

// ─── Convenience tracking functions ───────────────────────────────────────────

export async function trackSignup(userId) {
  trackGeoEvent('signup', userId, { event_category: 'engagement' });
}

export async function trackPremiumConversion(userId, planType, amount) {
  trackGeoEvent('premium_conversion', userId, {
    event_category: 'conversion',
    plan_type: planType,
    amount: amount
  });
}

export async function trackTestCompletion(userId, testType, score) {
  trackGeoEvent('test_complete', userId, {
    event_category: 'engagement',
    test_type: testType,
    score: score
  });
}

export async function trackFeatureUsage(userId, feature) {
  trackGeoEvent('feature_usage', userId, {
    event_category: 'engagement',
    feature: feature
  });
}

// ─── Re-export geo utilities ───────────────────────────────────────────────────

export { getUserGeo, getCurrencySymbol, getPricingTierForRegion, formatLocation };
