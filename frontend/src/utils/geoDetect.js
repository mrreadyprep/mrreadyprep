/**
 * Geo-detection utility: detects user's country & region for geo-targeting
 * Uses free IP geolocation API with fallback and caching
 */

const GEO_CACHE_KEY = 'mrreadyprep_geo_data';
const GEO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getUserGeo() {
  // Check cache first
  const cached = localStorage.getItem(GEO_CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < GEO_CACHE_TTL) {
      return data;
    }
  }

  try {
    // Try free IP geolocation API (ipapi.co)
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      cache: 'no-store'
    });

    if (!response.ok) throw new Error('Geo API failed');

    const geo = await response.json();

    const geoData = {
      country: geo.country_code || 'US',
      country_name: geo.country_name || 'United States',
      region: geo.region || '',
      city: geo.city || '',
      timezone: geo.timezone || 'UTC',
      latitude: geo.latitude,
      longitude: geo.longitude,
      currency: geo.currency || 'USD',
      language: geo.languages ? geo.languages.split(',')[0] : 'en'
    };

    // Cache result
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({
      data: geoData,
      timestamp: Date.now()
    }));

    return geoData;
  } catch (error) {
    console.warn('Geo-detection failed:', error);

    // Fallback: return default based on browser lang
    return {
      country: 'US',
      country_name: 'United States',
      region: '',
      city: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      latitude: null,
      longitude: null,
      currency: 'USD',
      language: navigator.language?.split('-')[0] || 'en'
    };
  }
}

/**
 * Get currency symbol for user's region
 */
export function getCurrencySymbol(currencyCode) {
  const symbols = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'TRY': '₺',
    'INR': '₹',
    'AUD': 'A$',
    'CAD': 'C$',
    'CNY': '¥'
  };
  return symbols[currencyCode] || '$';
}

/**
 * Get pricing tier for region (for future use)
 */
export function getPricingTierForRegion(country) {
  const tier1 = ['US', 'CA', 'GB', 'AU', 'NZ', 'JP', 'SG', 'HK']; // Premium pricing
  const tier2 = ['IN', 'BR', 'MX', 'ZA', 'TH']; // Mid-tier pricing

  if (tier1.includes(country)) return 'premium';
  if (tier2.includes(country)) return 'mid';
  return 'standard'; // Default tier
}

/**
 * Format location for display
 */
export function formatLocation(geo) {
  if (geo.city && geo.region) {
    return `${geo.city}, ${geo.region}`;
  }
  if (geo.city) return geo.city;
  if (geo.region) return geo.region;
  return geo.country_name || 'International';
}
