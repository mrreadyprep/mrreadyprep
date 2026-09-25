/**
 * Geo-detection utility: detects user's country & region for geo-targeting
 * Uses free IP geolocation API with fallback and caching
 */
import { useState, useEffect } from 'react';

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
    'CNY': '¥',
    'BRL': 'R$',
    'MXN': 'MX$',
    'ZAR': 'R',
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

// ─── Regional price estimate (display only) ───────────────────────────────────
// Pricing is charged in USD only -- Polar.sh's checkout is the actual source of truth for what
// a student pays (see the comment on SubscribeScreen's price block in App.jsx). Everything below
// is purely an informational "≈ local currency" line next to the real USD price, so a visitor
// outside the US isn't left mentally converting $60 into their own currency. Live exchange rates
// (not a hardcoded table) so this never silently drifts stale the way a fixed rate would --
// falls back to showing nothing at all if the rate lookup fails, never a wrong number.
const FX_CACHE_KEY = 'mrreadyprep_fx_rates';
const FX_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours -- FX moves slowly enough that this is
// plenty fresh for a "roughly how much is this" line, while keeping the free API call rare.

async function getExchangeRates() {
  const cached = localStorage.getItem(FX_CACHE_KEY);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < FX_CACHE_TTL) return data;
    } catch {
      // fall through to a fresh fetch
    }
  }

  try {
    // Free, keyless, CORS-friendly FX API -- no account/API key needed, matches the
    // no-dependency style of the ipapi.co geo lookup above.
    const response = await fetch('https://open.er-api.com/v6/latest/USD', {
      method: 'GET',
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('FX API failed');
    const json = await response.json();
    const rates = json.rates;
    if (!rates || typeof rates !== 'object') throw new Error('FX API returned no rates');

    localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ data: rates, timestamp: Date.now() }));
    return rates;
  } catch (error) {
    console.warn('Exchange rate fetch failed:', error);
    return null;
  }
}

// Rounds a converted amount to something that reads like an estimate, not a falsely precise
// number (a live rate times a price shouldn't come out as "≈ ₺1,222.43"). JPY conventionally
// has no minor unit; everything else rounds to whole units, and larger amounts round to the
// nearest 5 so they don't look like a real, fixed price point.
function roundForDisplay(amount) {
  if (amount >= 100) return Math.round(amount / 5) * 5;
  return Math.round(amount);
}

function formatEstimatedPrice(usdAmount, geo, rates) {
  if (!geo || !rates) return null;
  const currency = geo.currency;
  if (!currency || currency === 'USD') return null; // US visitors already see the real currency
  const rate = rates[currency];
  if (!rate || !Number.isFinite(rate)) return null;

  const converted = roundForDisplay(usdAmount * rate);
  const symbol = getCurrencySymbol(currency);
  return `≈ ${symbol}${converted.toLocaleString('en-US')}`;
}

// React hook: resolves the visitor's country + live FX rates once (both already cached/throttled
// above), then hands back a formatter `estimate(usdAmount)` that returns a string like
// "≈ ₺2,930" or null. Callers render the estimate line only when this returns non-null, so a
// failed geo/FX lookup (or a US visitor, who has nothing to convert) just means no extra line --
// never a broken or misleading one. Used by the three places a price is shown: the landing page
// pricing teaser, the sign-up screen's pricing table, and the real Subscribe/checkout screen.
export function useGeoPriceEstimate() {
  const [geo, setGeo] = useState(null);
  const [rates, setRates] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const geoData = await getUserGeo();
      if (cancelled) return;
      setGeo(geoData);
      if (!geoData || geoData.currency === 'USD') return; // nothing to convert, skip the FX call
      const rateData = await getExchangeRates();
      if (!cancelled) setRates(rateData);
    })();
    return () => { cancelled = true };
  }, []);

  return (usdAmount) => formatEstimatedPrice(usdAmount, geo, rates);
}
