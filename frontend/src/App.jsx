import { useEffect, useState, useRef, useMemo, Component, lazy, Suspense } from 'react'
// The entire logged-in application (Dashboard, every exam screen, mock tests, vocabulary, forum,
// admin panel -- ~11,000 lines) lives in AppMain.jsx and loads as its own chunk only once a
// visitor actually logs in. Before this split, an anonymous landing-page visitor downloaded and
// parsed all of that too, just to see the marketing page -- this is what shrinks that initial
// bundle. See AppMain.jsx's own header comment for the split boundary / how to keep it in sync.
const LazyApp = lazy(() => import('./AppMain'))
import { useGeoPriceEstimate } from './utils/geoDetect'
import { trackSignup, trackPremiumConversion, trackTestCompletion } from './utils/geoTracking'
import ReviewsSection from './components/ReviewsSection'

// ─── In-progress answer drafts (solo practice only) ───────────────────────────
// "Save & Exit" used to just exit immediately, discarding whatever the student had typed so
// far -- the label promised saving that never actually happened. These persist an in-progress
// (ungraded) exercise's answers to localStorage, keyed by exercise/passage id, so leaving mid-
// exercise and coming back later resumes exactly where the student left off. Only used in solo
// practice mode -- Full Mock Test already has its own session-level answer-preservation via
// FullMockTest's sessionRef + initialAnswers/onAnswersChange, and its own exit confirmation.
const DRAFT_KEY_PREFIX = 'mrp_draft_'
// draftKey() above has no per-account component -- on a shared/lab/family computer, a draft User
// A saved (Save & Exit on a Reading/Writing exercise) used to still be sitting in localStorage,
// keyed only by category+itemId, after User A logged out. User B logging in on the same browser
// and opening that same item would silently see User A's unfinished answer pre-filled into their
// own textarea. Called on every logout/session-expiry AND on every successful login/register (in
// case a prior session ended uncleanly -- browser closed, tab killed -- without going through
// logout() at all) so no draft can ever survive into a different account's session. Found in the
// 34th audit round.
function clearAllDrafts() {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(DRAFT_KEY_PREFIX)) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

// Module-level singleton tracking whether ANY screen currently has in-progress, not-yet-saved
// work (a solo practice exercise mid-attempt via useExitDraft below, or a running Full Mock
// Test). Found live via audit: every one of those screens already warns on an actual
// browser-level navigation (beforeunload, below) if the student tries to close the tab or hit
// refresh -- but the sidebar's own tab switcher (and Settings/Log Out) is a same-page React
// state change, not a browser navigation, so beforeunload never fires for it and clicking any
// other sidebar item silently discarded whatever was in progress with zero warning -- for a
// mock test, up to ~90 minutes of work, directly contradicting the "no going back once you
// start" notice shown on its own intro screen. A plain module-level counter (not React state)
// is enough here since multiple screens never have in-progress work simultaneously in practice,
// and it lets every existing call site opt in for free via the same effect that already manages
// beforeunload, instead of threading a new prop through every exercise component.
let _exitGuardCount = 0
const _exitGuardListeners = new Set()
function _pushExitGuard() { _exitGuardCount++; _exitGuardListeners.forEach(fn => fn(_exitGuardCount > 0)) }
function _popExitGuard() { _exitGuardCount = Math.max(0, _exitGuardCount - 1); _exitGuardListeners.forEach(fn => fn(_exitGuardCount > 0)) }
function useExitGuardActive() {
  const [active, setActive] = useState(_exitGuardCount > 0)
  useEffect(() => {
    _exitGuardListeners.add(setActive)
    setActive(_exitGuardCount > 0)
    return () => _exitGuardListeners.delete(setActive)
  }, [])
  return active
}

// ─── Academic Passage ─────────────────────────────────────────────────────────
// VITE_BACKEND_URL can be set at build time (e.g. in Render's environment variables) to point
// the deployed frontend at its deployed backend. Falls back to localhost for local dev.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
// The hardware-check screens (Adjusting the Volume / Adjusting the Microphone) reference two
// static audio files directly by URL rather than through a backend API response, so they need
// their own base URL mirroring the backend's AUDIO_BASE_URL env var (see main.py) -- once audio
// moved off the backend's own /audio mount and onto object storage (R2), this must point there
// too, e.g. VITE_AUDIO_BASE_URL=https://pub-xxxxxxxx.r2.dev (same bucket URL used server-side).
// Falls back to the backend's own /audio mount, which is correct for local dev.
const AUDIO_BASE_URL = import.meta.env.VITE_AUDIO_BASE_URL || `${BACKEND_URL}/audio`
// Direct-to-R2 URLs (AUDIO_BASE_URL above) can fail for students whose network/ISP can't reach
// Cloudflare R2's edge (seen with TLS/connection errors in production). Every audio file the
// backend returns in an API response is already routed through the backend's own /audio-proxy
// endpoint for this reason. The few files referenced directly by the frontend itself (intro
// narration lines, hwcheck clips) need the same treatment -- use this base instead of
// AUDIO_BASE_URL for those so playback goes through the backend the student already talks to
// successfully, not straight to R2.
const AUDIO_PROXY_BASE_URL = `${BACKEND_URL}/audio-proxy`

// ─── Auth: token storage + an authenticated fetch wrapper ────────────────────────────────────
const AUTH_TOKEN_KEY = 'mrreadyprep_token'

// Wrapped in try/catch like the draft helpers above -- localStorage access can throw (private
// browsing in some browsers, storage full/disabled). getAuthToken() in particular runs on every
// single apiFetch call including the boot-time auth check, so an uncaught throw here used to
// crash the whole app into the generic error-boundary screen with no real recovery path.
function getAuthToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || '' } catch { return '' }
}
function setAuthToken(token) {
  try { localStorage.setItem(AUTH_TOKEN_KEY, token) } catch { /* ignore quota/availability errors */ }
}
function clearAuthToken() {
  try { localStorage.removeItem(AUTH_TOKEN_KEY) } catch { /* ignore */ }
}

// Every call in this file that hits our own backend goes through this instead of the raw
// `fetch` so the logged-in student's session token rides along automatically. On a 401 (missing/
// expired/invalid token) it clears the stale token and reloads, which drops the student back
// onto the login screen instead of leaving them stuck on a broken, half-authenticated page.
// Guards against firing the "session expired" toast + reload more than once if several
// in-flight requests all come back 401 around the same time (e.g. a page with multiple
// simultaneous fetches right as the token expires).
let sessionExpiredHandled = false

function apiFetch(url, options = {}) {
  const token = getAuthToken()
  const headers = { ...(options.headers || {}) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401 && !sessionExpiredHandled) {
      sessionExpiredHandled = true
      clearAuthToken()
      clearAllDrafts()
      // Give the student a reason for the sudden logout (and a beat to read it) instead of an
      // unexplained instant reload -- anything they hadn't already saved (a draft answer, an
      // in-progress mock test) is lost either way, but at least they know why.
      showToast('Your session expired -- please log in again.', 'info')
      setTimeout(() => window.location.reload(), 1500)
    }
    return res
  })
}

// Every error path in this file that reads a failed response's `data.detail` assumed it's always
// a plain string -- true for every HTTPException this backend raises by hand, but NOT true for
// FastAPI's own automatic 422 response when a Pydantic field fails validation (e.g. a username or
// password longer than the backend's max_length): in that case `detail` is an ARRAY of
// {type, loc, msg, ...} objects, not a string. `data.detail || fallback` still passes that array
// straight through as a truthy value, and the call site (new Error(...), setError(...), a toast)
// ends up rendering the literal text "[object Object]" (or, for an Error's message, the array's
// default toString) instead of anything a student could act on. Pulls the first validation
// message out when that's the shape; falls back to the given default for anything else
// (undefined, null, an already-fine string). Found in the 39th audit round.
function extractErrorMessage(data, fallback) {
  const detail = data && data.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length && typeof detail[0] === 'object' && detail[0] && typeof detail[0].msg === 'string') {
    return detail[0].msg
  }
  return fallback
}

// Fires a small, self-dismissing toast in the bottom-right corner instead of a native alert() --
// the browser's built-in alert() blocks the whole page and looks jarring against the rest of the
// app's design, so anything that used to call alert() dispatches this event instead. Same
// no-prop-drilling pattern as requestUpgrade() above: a single <ToastHost /> mounted once inside
// App() listens for it and renders/queues/dismisses the actual toast.
function showToast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('mrreadyprep:toast', { detail: { message, type } }))
}

function ToastHost() {
  const [toasts, setToasts] = useState([])
  useEffect(() => {
    const onToast = (e) => {
      const id = Date.now() + Math.random()
      setToasts(t => [...t, { id, ...e.detail }])
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }
    window.addEventListener('mrreadyprep:toast', onToast)
    return () => window.removeEventListener('mrreadyprep:toast', onToast)
  }, [])
  if (toasts.length === 0) return null
  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#d92d20' : t.type === 'info' ? '#11162d' : '#2ac56c',
          color: '#fff', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>{t.type === 'error' ? '⚠️' : t.type === 'info' ? 'ℹ️' : '✅'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

// A real talking-head video (free-licensed stock footage, one per gender) so the mouth movement
// is genuine, not simulated. Loops while a question plays; pauses (and gently nods, via CSS
// transform on the video element) while the student is recording their answer. Falls back to the
// drawn SVG character above if the video file hasn't been placed in public/talking-videos/ yet.
function TalkingAvatar({ gender, seed = 0, width = 220, height = 220, mode = 'idle' }) {
  const isFemale = gender !== 'male'
  const videoRef = useRef(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const src = isFemale ? '/talking-videos/female.mp4' : '/talking-videos/male.mp4'

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (mode === 'playing') { try { v.currentTime = 0 } catch (e) {} v.play().catch(() => {}) }
    else v.pause()
  }, [mode])

  if (videoFailed) return <DrawnCharacterAvatar gender={gender} seed={seed} width={width} height={height} mode={mode} />

  return (
    <div style={{ width: `${width}px`, height: `${height}px`, maxWidth: '100%', margin: '0 auto' }}>
      <style>{`
        @keyframes toeflVideoNod {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(4px) rotate(1.2deg); }
        }
      `}</style>
      <div style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden', background: '#f2f3f5', animation: mode === 'recording' ? 'toeflVideoNod 1.6s ease-in-out infinite' : 'none' }}>
        <video
          ref={videoRef}
          src={src}
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block', transform: 'scale(2.1) translateY(-6%)', transformOrigin: 'center 20%' }}
        />
      </div>
    </div>
  )
}

// ─── Auth: login / sign up screen ────────────────────────────────────────────
// Set at build time once Google Cloud OAuth credentials exist (VITE_GOOGLE_CLIENT_ID). Until
// then the "Sign in with Google" button simply doesn't render, rather than showing a broken one.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Lazily loads Google Identity Services' script (https://accounts.google.com/gsi/client) at most
// once no matter how many times it's called -- returns a promise that resolves once window.google
// is ready to use. AuthScreen calls this on mount rather than adding the <script> tag directly to
// index.html, so the whole Google Sign-In feature stays a no-op (no network request, no console
// warnings) for any deployment that hasn't set VITE_GOOGLE_CLIENT_ID yet.
let _gisLoadPromise = null
function loadGoogleIdentityServices() {
  if (_gisLoadPromise) return _gisLoadPromise
  _gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.id) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
  return _gisLoadPromise
}

// ─── Analytics: Google Analytics 4 + Microsoft Clarity, gated behind cookie consent ─────────
// Set at build time once a GA4 property exists (VITE_GA_MEASUREMENT_ID). Until then
// CookieConsentBanner below simply doesn't render, and no analytics script is ever loaded.
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || ''
// Clarity project IDs aren't secret (every visitor's page source has this same value embedded
// in the tracking script tag regardless), so unlike GA_MEASUREMENT_ID above this is hardcoded
// rather than routed through a build-time env var -- one less thing to configure per deploy.
const CLARITY_PROJECT_ID = 'y60gpwz1rb'
// Meta (Facebook/Instagram) Pixel, same consent gate as GA4/Clarity below -- without it, ad
// campaigns can only see click counts, not which clicks actually became a signup or a checkout,
// so Meta's delivery system can't optimize toward people likely to convert. Set at build time
// once a Pixel exists (Render env var VITE_META_PIXEL_ID); until then this stays empty and
// loadMetaPixel()/trackPixelEvent() below are no-ops, same pattern as GA_MEASUREMENT_ID.
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || ''
const COOKIE_CONSENT_KEY = 'cookie_consent' // 'accepted' | 'rejected'

let _gaLoaded = false
function loadGoogleAnalytics() {
  if (_gaLoaded || !GA_MEASUREMENT_ID) return
  _gaLoaded = true
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
  window.dataLayer = window.dataLayer || []
  function gtag() { window.dataLayer.push(arguments) }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true })
}

// Session-recording/heatmap tool (mouse movement, clicks, scroll) -- separate product from GA4,
// same consent gate. Loaded the same way Clarity's own "manual install" snippet does it, just
// translated out of an inline <script> tag into JS since this app has no static HTML shell to
// paste one into.
let _clarityLoaded = false
function loadClarity() {
  if (_clarityLoaded || !CLARITY_PROJECT_ID) return
  _clarityLoaded = true
  window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments) }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`
  document.head.appendChild(script)
}

// Meta Pixel base code, translated out of Meta's inline <script> snippet the same way Clarity's
// was above (this app has no static HTML shell to paste either into). fbq('track', 'PageView')
// fires once here on load; CompleteRegistration and InitiateCheckout fire later via
// trackPixelEvent() at the actual signup-success and checkout-start call sites below.
let _metaPixelLoaded = false
function loadMetaPixel() {
  if (_metaPixelLoaded || !META_PIXEL_ID) return
  _metaPixelLoaded = true
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js')
  /* eslint-enable */
  window.fbq('init', META_PIXEL_ID)
  window.fbq('track', 'PageView')
}

// Fires a Meta Pixel conversion event if (and only if) the Pixel is configured and the visitor
// has actually consented (loadMetaPixel only ever runs from the 'accepted' branch below) --
// calling this before/without consent is always a harmless no-op since window.fbq won't exist
// yet, rather than something callers need to guard against individually at each call site.
function trackPixelEvent(eventName, params) {
  if (typeof window !== 'undefined' && window.fbq) window.fbq('track', eventName, params)
}

// Small bottom banner asking for consent before any analytics cookies are set. Only appears
// once (until the user clears site data) and only if a GA4 property is actually configured --
// on deployments without VITE_GA_MEASUREMENT_ID it renders nothing, since there's nothing to
// ask consent for. Accepting loads GA4 immediately; rejecting (or ignoring it) means no
// analytics script ever runs. Mirrors the same accepted-once-then-remembered pattern already
// used for auth/drafts elsewhere in the app (localStorage, not cookies, for our own state).
function CookieConsentBanner() {
  const [choice, setChoice] = useState(() => { try { return localStorage.getItem(COOKIE_CONSENT_KEY) } catch { return null } })

  useEffect(() => {
    if (choice === 'accepted') { loadGoogleAnalytics(); loadClarity(); loadMetaPixel() }
  }, [choice])

  if ((!GA_MEASUREMENT_ID && !CLARITY_PROJECT_ID && !META_PIXEL_ID) || choice) return null

  const respond = (value) => {
    // If localStorage throws (private browsing / storage disabled), still update state so the
    // banner closes instead of getting stuck open forever -- we just won't remember the choice
    // across reloads in that case, which is the best available fallback.
    try { localStorage.setItem(COOKIE_CONSENT_KEY, value) } catch { /* ignore */ }
    setChoice(value)
  }

  return (
    // Anchored to the TOP of the viewport, not the bottom -- ToastHost (below) is bottom-right,
    // and on a narrow/mobile screen this banner's own left:18/right:18 span left it wide enough to
    // overlap and obscure a toast that fired while it was still showing (e.g. a login success/error
    // toast right after a first-time visitor's consent banner appears). Found in the 38th audit
    // round. Nothing else in the app anchors to the top, so this can never collide with anything.
    <div role="region" aria-label="Cookie consent" style={{ position: 'fixed', top: '18px', left: '18px', right: '18px', maxWidth: '380px', margin: '0 auto', zIndex: 9999, backgroundColor: '#fff', color: '#1a1a1a', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 8px 28px rgba(0,0,0,0.25)', border: '1px solid #e1e4ed', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>🍪</span>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a' }}>We value your privacy</span>
      </div>
      <div style={{ fontSize: '12.5px', color: '#616473', lineHeight: '1.6', marginBottom: '14px' }}>
        We use Google Analytics, Microsoft Clarity, and the Meta Pixel to understand how mrreadyprep is used and to measure our advertising. This only sets a cookie if you accept. See our{' '}
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#701fa1', fontWeight: '600' }}>Privacy Policy</a>.
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={() => respond('rejected')} style={{ flex: 1, background: '#f4f6fa', border: '1px solid #e1e4ed', color: '#616473', padding: '9px 0', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Reject</button>
        <button type="button" onClick={() => respond('accepted')} style={{ flex: 1, background: '#701fa1', border: 'none', color: '#fff', padding: '9px 0', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Accept</button>
      </div>
    </div>
  )
}

// The site's default "logged-out" view (shown at "/" before a "Log In" / "Get Started" click
// reveals AuthScreen below). Added because Paddle's automated website-verification crawler
// repeatedly rejected mrreadyprep.com as "restricted by a login wall" -- the root URL used to
// render nothing but a bare credential form, with no visible product/business content for an
// anonymous visitor or crawler to read. Modeled on the structure of competitor TOEFL-prep
// homepages (Magoosh, BestMyTest, TestGlider): hero pitch, skill-by-skill feature breakdown,
// how-it-works, pricing teaser, footer -- all real static content, visible with no login and no
// client-side data fetch (everything here is hard-coded copy, not an API call).
// Small icon set the "Student Success Stories" cards cycle through -- backend rows don't carry an
// icon of their own (nothing meaningful for a visitor to pick), so this just varies the avatar a
// little instead of every card looking identical.
const SUCCESS_STORY_ICONS = ['📸', '✨', '🚀', '🎯', '⭐', '🌟']

// Modal behind the landing page's "+ Share Your Success Story" button. No login required -- see
// the success_stories table/endpoint comments in backend/main.py: this whole page only ever
// renders for signed-out visitors, so there's no account to attach a submission to. Posts
// immediately (no moderation queue); anti-abuse is server-side (length limits, a link filter, and
// a per-IP rate limit -- SUCCESS_STORY_ATTEMPT_MAX in main.py).
function ShareSuccessStoryModal({ onClose, onSubmitted }) {
  const [name, setName] = useState('')
  const [score, setScore] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !submitting) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, submitting])
  const trapRef = useFocusTrap()

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', color: '#1a1a1a' }

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedComment = comment.trim()
    if (trimmedName.length < 2) { setError('Please enter your name.'); return }
    if (trimmedComment.length < 15) { setError('Tell us a bit more about your experience (at least 15 characters).'); return }
    setError('')
    setSubmitting(true)
    apiFetch(`${BACKEND_URL}/api/success-stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmedName, score: score.trim(), comment: trimmedComment }),
    }).then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) { setError(extractErrorMessage(data, 'Could not submit your story. Please try again.')); setSubmitting(false); return }
        onSubmitted(data)
      })
      .catch(() => { setError('Network error -- please check your connection and try again.'); setSubmitting(false) })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,22,45,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, fontFamily: 'sans-serif', padding: '16px' }}>
      <div ref={trapRef} role="dialog" aria-modal="true" aria-label="Share your success story" style={{ background: '#fff', borderRadius: '14px', padding: '28px', maxWidth: '440px', width: '100%' }}>
        <div style={{ fontSize: '17px', fontWeight: '800', color: '#1a1a1a', marginBottom: '4px' }}>Share your success story</div>
        <div style={{ fontSize: '13px', color: '#616473', marginBottom: '18px', lineHeight: '1.5' }}>Posted to this page right away -- no account needed.</div>
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', marginBottom: '4px' }}>Your name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Sarah Chen" style={inputStyle} disabled={submitting} />
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', margin: '14px 0 4px' }}>Your score (optional)</label>
          <input value={score} onChange={(e) => setScore(e.target.value)} maxLength={20} placeholder="e.g. 5.5/6" style={inputStyle} disabled={submitting} />
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#374151', margin: '14px 0 4px' }}>Your experience</label>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} rows={4} placeholder="Tell other students how MRReadyPrep helped you..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} disabled={submitting} />
          {error && <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ flex: 1, background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: '700', color: '#616473', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ flex: 1, background: '#701fa1', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: '700', color: '#fff', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Posting...' : 'Post my story'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// A single real Read in Daily Life question a visitor can answer with no account, right on the
// landing page -- a real notice/sign from our Reading question bank plus its actual comprehension
// question (4 options, instant right/wrong feedback + explanation). Entirely self-contained: no
// backend call, no saved state. The countdown is atmospheric only -- it does not lock the visitor
// out at 0, since the point here is "try the format," not a real timed assessment.
//
// Styled to mirror the actual in-app exam screen (see RIDLQuestion/TestTopBar/TestSubHeader
// above) rather than a generic marketing card: same green top bar + white sub-header, same
// colored-border notice box, same circular radio options -- so what a visitor tries here looks
// exactly like what they'll get after signing up, not a simplified mockup of it.
function LiveDemoSection({ isMobile, purple, onGetStarted }) {
  const DEMO_SECONDS = 25
  const noticeTitle = 'NOTICE: Swimming Pool Closure'
  const noticeText = 'The outdoor swimming pool at Riverside Sports Centre will be closed for maintenance from Monday, July 7 to Wednesday, July 9.\n\nDuring this period, members are welcome to use the indoor pool on the lower ground floor.\n\nWe apologize for any inconvenience.'
  const question = 'What is the purpose of the sign?'
  const options = [
    { key: 'A', text: 'To announce a new sports centre opening', correct: false },
    { key: 'B', text: 'To inform members of a temporary pool closure', correct: true },
    { key: 'C', text: 'To advertise swimming lessons', correct: false },
    { key: 'D', text: 'To notify members of a fee change', correct: false },
  ]
  const explanation = '"To inform members of a temporary pool closure" is correct: the sign\'s purpose is to let members know the outdoor pool is closed for maintenance from July 7-9 and to point them to the indoor pool as an alternative -- it isn\'t announcing a new facility, promoting lessons, or changing fees.'
  // Same teal used for the very first entry in RIDL_BOX_COLORS -- keeps the demo's notice box
  // the same color a real student would see on this same passage inside the app.
  const boxColor = '#127c84'

  const [selected, setSelected] = useState(null)
  const [timeLeft, setTimeLeft] = useState(DEMO_SECONDS)

  useEffect(() => {
    if (selected) return
    if (timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, selected])

  const pick = (opt) => { if (!selected) setSelected(opt) }
  const formatTime = (s) => '0:' + String(Math.max(s, 0)).padStart(2, '0')

  return (
    <div style={{ backgroundColor: '#fff', padding: isMobile ? '48px 20px' : '64px 40px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 10px' }}>
          Try a real question -- no signup needed
        </h2>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', margin: '0 auto 30px', maxWidth: '520px', lineHeight: '1.6' }}>
          This is an actual Read in Daily Life question from our Reading practice, shown exactly as it appears in the real exam interface.
        </p>

        <div style={{ border: '1px solid #e1e4ed', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.08)' }}>
          {/* Top bar -- same green used by the real in-app exam screen's TestTopBar */}
          <div style={{ background: '#2ac56c', padding: isMobile ? '10px 16px' : '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ background: '#fff', color: '#333333', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '12px', fontWeight: '700', fontFamily: 'sans-serif' }}>Exit</span>
            <span style={{ background: '#11162d', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '12px', fontWeight: '700', fontFamily: 'sans-serif' }}>
              {selected ? 'Finish' : 'Next'}
            </span>
          </div>
          {/* Sub-header -- same layout as the real exam's TestSubHeader (section + timer) */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: isMobile ? '10px 16px' : '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <div style={{ fontSize: isMobile ? '11px' : '13px', color: '#1a1a1a' }}>
              <span style={{ fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reading</span>
              <span style={{ color: '#9ca3af', margin: '0 8px' }}>|</span>
              <span>Read in Daily Life</span>
            </div>
            <span style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '700', color: timeLeft <= 5 && !selected ? '#d94040' : '#1a1a1a' }}>
              ⏱ {formatTime(timeLeft)}
            </span>
          </div>

          {/* Body -- same two-column layout as the real RIDLQuestion screen: bordered notice box
              on the left, question + circular radio options on the right. */}
          <div style={{ padding: isMobile ? '20px 16px 28px' : '32px 40px 40px', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', gap: isMobile ? '20px' : '40px', alignItems: 'flex-start', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
              <div style={{ flex: 1, minWidth: 0, maxWidth: isMobile ? '100%' : '360px', width: '100%' }}>
                <div style={{ border: `3px solid ${boxColor}`, borderRadius: '10px', padding: '16px 18px', boxSizing: 'border-box' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', textAlign: 'center', marginBottom: '10px', color: '#1a1a1a' }}>
                    {noticeTitle}
                  </div>
                  <div style={{ fontSize: '14px', lineHeight: '1.75', color: '#1a1a1a', whiteSpace: 'pre-line' }}>
                    {noticeText}
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: '700', color: '#1a1a1a', lineHeight: '1.5' }}>
                  {question}
                </div>
                <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {options.map(opt => {
                    const isPicked = selected?.key === opt.key
                    const showResult = !!selected
                    const isCorrectOpt = opt.correct
                    let dotBorder = isPicked ? '#2ac56c' : '#c0c0c0'
                    let textColor = '#1a1a1a'
                    if (showResult) {
                      if (isCorrectOpt) { dotBorder = '#2ac56c'; textColor = '#1a7a3f' }
                      else if (isPicked) { dotBorder = '#d94040'; textColor = '#a32f2f' }
                    }
                    return (
                      <div key={opt.key} role="radio" aria-checked={isPicked} tabIndex={0}
                        onClick={() => pick(opt)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(opt) } }}
                        style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: selected ? 'default' : 'pointer', padding: '2px 0' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: isPicked ? `6px solid ${dotBorder}` : `1.5px solid ${dotBorder}`, background: '#fff', transition: 'all 0.1s' }} />
                        <span style={{ fontSize: isMobile ? '14px' : '16px', lineHeight: '1.5', color: textColor, fontWeight: showResult && (isCorrectOpt || isPicked) ? '600' : '400' }}>
                          {opt.text}
                          {showResult && isCorrectOpt && <span style={{ fontSize: '11px', color: '#2ac56c', marginLeft: '8px', fontWeight: '700' }}>✓ correct</span>}
                          {showResult && isPicked && !isCorrectOpt && <span style={{ fontSize: '11px', color: '#d94040', marginLeft: '8px', fontWeight: '700' }}>✗ your answer</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {selected && (
                  <div style={{ borderTop: '1px solid #e1e4ed', paddingTop: '16px', marginTop: '2px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: selected.correct ? '#1a7a3f' : '#a32f2f', marginBottom: '6px' }}>
                      {selected.correct ? '✓ Correct!' : '✕ Not quite'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#616473', lineHeight: '1.6' }}>{explanation}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <button type="button" onClick={onGetStarted} style={{ display: 'block', width: '100%', maxWidth: '420px', margin: '24px auto 0', backgroundColor: purple, color: '#fff', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' }}>
            Get more questions free →
          </button>
        )}
      </div>
    </div>
  )
}

function LandingPage({ onGetStarted, onLogIn }) {
  const isMobile = useIsMobile()
  const purple = '#701fa1'
  // "≈ local currency" line next to the USD prices in the pricing teaser below, for visitors
  // outside the US -- see geoDetect.js; resolves to null (no extra line) for US visitors or
  // whenever geo/FX detection fails, never a wrong number.
  const priceEstimate = useGeoPriceEstimate()

  const skills = [
    { icon: '📖', title: 'Reading', desc: 'Academic passages, Read in Daily Life, and Complete the Words drills with instant right/wrong feedback.', pill: 'Instant Right/Wrong Explanations', href: '/toefl-reading-practice/' },
    { icon: '🎧', title: 'Listening', desc: 'Conversations, announcements, and academic talks with note-taking practice, just like the real exam.', pill: 'Official Audio Pacing', href: '/toefl-listening-practice/' },
    { icon: '✍️', title: 'Writing', desc: 'Academic Discussion, Email, and Build-a-Sentence tasks scored instantly by AI against official rubric criteria.', pill: 'Scored in Seconds', href: '/toefl-writing-practice/' },
    { icon: '🎤', title: 'Speaking', desc: 'Interview, Listen & Repeat, and full speaking tasks with AI feedback on delivery, language use, and content.', pill: '0–6.0 Fluency & Delivery Score', href: '/toefl-speaking-practice/' },
  ]

  const steps = [
    { n: '1', title: 'Create a free account', desc: 'Sign up in seconds — no credit card required to get started.' },
    { n: '2', title: 'Practice by skill or take a mock test', desc: 'Drill individual question types or sit a full mock exam under real timing.' },
    { n: '3', title: 'Get instant, AI-powered feedback', desc: 'See your score, mistakes, and personalized feedback the moment you finish.' },
  ]

  // Platform features beyond the four skills themselves -- kept in sync (icon + name) with the
  // actual in-app nav items so a visitor sees the exact same labels here and after signing up:
  // 'Recommended for You' (Adaptive Learning), 'AI Tutor', 'Community', and Badges/Leaderboard
  // (Gamification). Added once these shipped, so the landing page actually advertises them
  // instead of only listing the original four skill areas.
  const platformFeatures = [
    { icon: '🎯', title: 'Adaptive Learning Paths', desc: 'A "Recommended for You" plan built from your real results, so you always know exactly which section to practice next.' },
    { icon: '🤖', title: 'AI Tutor Chat', desc: 'Ask about grammar, strategy, or your weak spots anytime and get instant, expert answers from your personal AI Tutor.' },
    { icon: '💬', title: 'Community Forum', desc: 'Ask questions, share tips, and learn alongside other students preparing for the same exam.' },
    { icon: '🏆', title: 'Streaks, Badges & Leaderboard', desc: 'Keep your daily practice streak alive, earn badges as you hit milestones, and see how you rank against other students.' },
  ]

  // Answers checked against what the product actually does (not just plausible-sounding copy):
  // the 0-6.0/0.5-step scale, the 20 mock tests mirroring real timing, and one-click cancellation
  // from Settings are all real, existing behavior, not aspirational claims.
  const faqs = [
    { q: 'Are the questions aligned with the latest 2026 TOEFL® iBT blueprint?', a: 'Yes. mrreadyprep is built around the current test specifications, including Read in Daily Life, Complete the Words, Academic Discussion, and the updated Speaking task formats.' },
    { q: 'How does the AI scoring work, and what rubric does it use?', a: 'Responses are graded on a 0 to 6.0 scale in 0.5 increments (e.g. 4.5, 5.0, 5.5, 6.0). Beyond the overall band, you get itemized feedback broken down by criteria like grammar, vocabulary, and topic development.' },
    { q: 'What is included in the 20 Full-Length Mock Tests?', a: 'Each of the 20 mock exams mirrors real test timing and section transitions across Reading, Listening, Writing, and Speaking, and ends with a full band report plus a mistake review.' },
    { q: 'How do I cancel my subscription?', a: 'From your account settings, in one click -- no email or support ticket needed. You keep full access until the end of your current billing period.' },
  ]

  const navLinkStyle = { fontSize: '13px', fontWeight: '700', color: '#fff', textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none' }

  // Student Success Stories -- fetched from the backend (real, publicly-submitted rows). Starts
  // empty rather than with invented placeholder names/scores: a visitor can't tell a fabricated
  // testimonial from a real one, so on a fetch failure or before any student has submitted yet,
  // the section below shows an honest "be the first to share" empty state instead of fake results.
  const [stories, setStories] = useState([])
  const [showShareModal, setShowShareModal] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  // Shows the newest 6 stories to start; "Show more" reveals the rest 6 at a time instead of
  // dumping potentially dozens of cards on the page at once.
  const [visibleStoryCount, setVisibleStoryCount] = useState(6)

  useEffect(() => {
    let cancelled = false
    fetch(`${BACKEND_URL}/api/success-stories`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (!cancelled && Array.isArray(data.stories) && data.stories.length > 0) setStories(data.stories) })
      .catch(() => { /* keep the fallback stories above */ })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ width: '100%', minHeight: '100vh', overflowY: 'auto', fontFamily: 'sans-serif', backgroundColor: '#fff' }}>
      {/* Top nav. The Skills/Pricing/FAQ links are plain same-page anchors (#skills etc. --
          scrollMarginTop on each target section keeps it from landing flush under this fixed-
          looking nav bar). Deliberately no "Mock Tests" or "AI Scoring" link here yet -- unlike
          Skills/Pricing/FAQ, neither has its own dedicated section on this page to scroll to, so
          linking to them would just misfire; add a link once (if) those sections exist. */}
      <div style={{ backgroundColor: '#11162d', padding: isMobile ? '14px 18px' : '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ color: '#b67bfb', fontSize: '19px', fontWeight: '800' }}>mrreadyprep</div>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            {[{ href: '#skills', label: 'Skills' }, { href: '/toefl-mock-tests/', label: 'Mock Tests' }, { href: '#pricing', label: 'Pricing' }, { href: '#faq', label: 'FAQ' }].map(link => (
              <a key={link.href} href={link.href} style={{ fontSize: '13px', fontWeight: '600', color: '#c7c9d9', textDecoration: 'none' }}>{link.label}</a>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '18px' }}>
          <button type="button" onClick={onLogIn} style={navLinkStyle}>Log In</button>
          <button type="button" onClick={onGetStarted} style={{ backgroundColor: '#b67bfb', color: '#11162d', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
            Get Started Free
          </button>
        </div>
      </div>

      {/* Hero -- split grid on desktop (text + CTA left, live product mockup right) so a visitor
          sees the actual AI scoring UI instead of just a text claim about it; collapses to a
          single centered column on mobile, where the mockup is hidden to keep the page light. */}
      <div style={{ backgroundColor: '#11162d', padding: isMobile ? '44px 20px 56px' : '64px 40px 80px' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '40px' : '56px', alignItems: 'center' }}>
          {/* Left column: copy + CTA */}
          <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
            <div style={{ fontSize: '10.5px', color: '#b67bfb', letterSpacing: '2px', fontWeight: '700', marginBottom: '14px' }}>ALIGNED WITH THE 2026 TOEFL® iBT FORMAT</div>
            <h1 style={{ color: '#fff', fontSize: isMobile ? '28px' : '38px', fontWeight: '800', lineHeight: '1.25', margin: '0 0 16px' }}>
              Master the TOEFL® iBT with Real Exam Simulations and Instant AI Scoring
            </h1>
            <p style={{ color: '#9ca3af', fontSize: isMobile ? '14px' : '16px', lineHeight: '1.7', margin: '0 0 30px' }}>
              Experience Reading, Listening, Writing, and Speaking with the real exam interface and timing. Get instant scores on a 0–6.0 scale, in 0.5-point increments, graded against official rubric criteria, with detailed feedback to help you reach your target.
            </p>
            <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <button type="button" onClick={onGetStarted} style={{ backgroundColor: '#701fa1', color: '#fff', border: 'none', borderRadius: '10px', padding: '14px 28px', fontSize: '15px', fontWeight: '800', cursor: 'pointer' }}>
                Start Practicing Free
              </button>
              <button type="button" onClick={onLogIn} style={{ backgroundColor: 'transparent', color: '#fff', border: '1px solid #3a3f5c', borderRadius: '10px', padding: '14px 28px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' }}>
                Log In
              </button>
            </div>
            <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '10px' }}>No credit card required</div>
            <div style={{ display: 'flex', justifyContent: isMobile ? 'center' : 'flex-start', gap: isMobile ? '14px' : '22px', flexWrap: 'wrap', marginTop: '28px', fontSize: '12.5px', color: '#b67bfb', fontWeight: '700' }}>
              <span>✓ 20 Full-Length Mock Tests</span>
              <span>✓ Official 0–6.0 Band Scoring</span>
              <span>✓ 100% Free to Start</span>
            </div>
            {/* Leads with the discounted price, not just the feature list, because for a student
                comparing prep options the cheap entry price is itself the hook -- shown right in the
                hero so it's the first thing a visitor sees, not something they discover only after
                digging into Subscribe. Mirrors the same WELCOME50 messaging shown again in the pricing
                section below and on the in-app Subscribe screen (before checkout, not just at Polar's
                payment form) so the offer is consistent everywhere it appears. */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginTop: '22px', backgroundColor: 'rgba(112, 31, 161, 0.15)', border: '2px solid rgba(112, 31, 161, 0.8)', borderRadius: '12px', padding: isMobile ? '14px 18px' : '16px 24px' }}>
              <span style={{ fontSize: '24px' }} aria-hidden="true">🎉</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: isMobile ? '16px' : '18px', color: '#701fa1', fontWeight: '900', letterSpacing: '-0.3px' }}>
                  50% OFF
                </span>
                <span style={{ fontSize: isMobile ? '11px' : '12px', color: '#616473', fontWeight: '600' }}>
                  Your first month
                </span>
              </div>
            </div>
          </div>

          {/* Right column: laptop-framed mockup of the real Writing AI score card -- values match
              the actual 0-6.0 / 0.5-step scale and sub-criteria the product really returns, so this
              is a representative screenshot-style mockup, not an invented UI. Hidden on mobile since
              a static mockup adds weight without much value on a narrow screen where it'd just stack
              below the CTA. */}
          {!isMobile && (
            <div>
              <div style={{ backgroundColor: '#1c2340', borderRadius: '16px', padding: '14px 14px 20px', border: '1px solid #2e355a', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', paddingLeft: '4px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }} />
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }} />
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }} />
                </div>
                <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#701fa1', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Academic Discussion</div>
                    <div style={{ fontSize: '10.5px', color: '#4b5563', lineHeight: '1.6' }}>
                      In my opinion, remote work increases productivity because employees avoid long commutes and can better manage their personal schedules. Although some argue that in-person collaboration is more effective, most tasks today can be...
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f9f8fc', border: '1px solid #e1e4ed', borderRadius: '10px', padding: '12px' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>Total Task Score</div>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: '#701fa1', marginBottom: '10px' }}>5.5 <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '700' }}>/ 6.0</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                      {[
                        { label: 'Development & Coherence', score: '5.5' },
                        { label: 'Grammatical Accuracy', score: '5.0' },
                        { label: 'Academic Vocabulary', score: '6.0' },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '9.5px', color: '#4b5563' }}>
                          <span>{row.label}</span>
                          <span style={{ fontWeight: '800', color: '#1a1a1a', whiteSpace: 'nowrap' }}>{row.score}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '9px', color: '#616473', lineHeight: '1.5', backgroundColor: '#fff', border: '1px solid #e1e4ed', borderRadius: '6px', padding: '8px' }}>
                      "Strong, fluent academic language. Fix 2 preposition errors to reach a full 6.0."
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Skills grid */}
      <div id="skills" style={{ padding: isMobile ? '48px 20px' : '64px 40px', maxWidth: '1000px', margin: '0 auto', scrollMarginTop: '70px' }}>
        <h2 style={{ textAlign: 'center', fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 10px' }}>
          Every section of the TOEFL iBT, covered
        </h2>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', margin: '0 auto 36px', maxWidth: '520px', lineHeight: '1.6' }}>
          Realistic question types for all four skills, drawn from a large question bank so you never run out of fresh practice.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '18px' }}>
          {skills.map(s => (
            <div key={s.title} style={{ border: '1px solid #e1e4ed', borderRadius: '14px', padding: '24px', backgroundColor: '#f9f8fc' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>{s.icon}</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#1a1a1a', marginBottom: '6px' }}>{s.title}</div>
              <div style={{ fontSize: '13px', color: '#616473', lineHeight: '1.6', marginBottom: '12px' }}>{s.desc}</div>
              <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: '700', color: purple, backgroundColor: `${purple}14`, border: `1px solid ${purple}33`, borderRadius: '999px', padding: '4px 10px', marginBottom: '10px' }}>
                {s.pill}
              </div>
              <div>
                <a href={s.href} style={{ fontSize: '12.5px', fontWeight: '700', color: purple, textDecoration: 'none' }}>
                  {s.title} practice details →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive no-login demo -- a single real Complete the Words question a visitor can try
          right on the landing page, no account needed. Self-contained (no backend call): the
          question, correct answer and explanation are hardcoded here, matching the real in-app
          Complete the Words format (fill a blank from 4 options, instant right/wrong feedback).
          A lightweight countdown just for realism -- it doesn't lock the visitor out at 0. */}
      <LiveDemoSection isMobile={isMobile} purple={purple} onGetStarted={onGetStarted} />

      {/* Platform features (Adaptive Learning, AI Tutor, Community, Gamification) -- a separate
          section from the four skills above, since these are cross-cutting platform capabilities
          rather than exam content areas. Purple-tinted cards (vs. the plain grey skill cards)
          so this reads as "extra tools on top of practice" rather than a fifth skill. */}
      <div style={{ backgroundColor: '#f4f6fa', padding: isMobile ? '48px 20px' : '64px 40px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 10px' }}>
            More than just practice questions
          </h2>
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', margin: '0 auto 36px', maxWidth: '560px', lineHeight: '1.6' }}>
            Tools built to keep your prep personalized, motivated, and never lonely.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '18px' }}>
            {platformFeatures.map(f => (
              <div key={f.title} style={{ border: `1px solid ${purple}33`, borderRadius: '14px', padding: '24px', backgroundColor: '#fff' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>{f.icon}</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#1a1a1a', marginBottom: '6px' }}>{f.title}</div>
                <div style={{ fontSize: '13px', color: '#616473', lineHeight: '1.6' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ backgroundColor: '#f4f6fa', padding: isMobile ? '48px 20px' : '64px 40px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 36px' }}>
            How it works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '24px' }}>
            {steps.map(step => (
              <div key={step.n} style={{ textAlign: 'center' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: purple, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '15px', margin: '0 auto 14px' }}>
                  {step.n}
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1a1a1a', marginBottom: '6px' }}>{step.title}</div>
                <div style={{ fontSize: '13px', color: '#616473', lineHeight: '1.6' }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing teaser -- Free plus the same 3 paid plans (1/3/6 month) sold on the actual
          Subscribe screen (SubscribeScreen above), not a made-up single "$50/mo" summary that
          didn't match what a visitor would see after signing up. Prices/features mirrored from
          that screen's plan list so the two never drift out of sync. */}
      <div id="pricing" style={{ padding: isMobile ? '48px 20px' : '64px 40px', maxWidth: '1180px', margin: '0 auto', scrollMarginTop: '70px' }}>
        <h2 style={{ textAlign: 'center', fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 36px' }}>
          Simple pricing
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '16px', alignItems: 'stretch' }}>
          <div style={{ border: '1px solid #e1e4ed', borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#616473', marginBottom: '6px' }}>Free</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#1a1a1a', marginBottom: '14px' }}>$0</div>
            <div style={{ fontSize: '13px', color: '#616473', lineHeight: '1.7', flex: 1 }}>A limited number of items from every practice category, across all four skills. No credit card required.</div>
          </div>
          {[
            { duration: '1 Month', originalPrice: 50, price: 25 },
            { duration: '3 Months', originalPrice: 120, price: 60, isMostPopular: true },
            { duration: '6 Months', originalPrice: 200, price: 100 },
          ].map(plan => (
            <div key={plan.duration} style={{ position: 'relative', border: plan.isMostPopular ? `2px solid ${purple}` : '1px solid #e1e4ed', borderRadius: '14px', padding: '24px', backgroundColor: plan.isMostPopular ? '#f9f8fc' : '#fff', display: 'flex', flexDirection: 'column' }}>
              {plan.isMostPopular && (
                <div style={{ position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)', backgroundColor: purple, color: '#fff', fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Most Popular</div>
              )}
              <div style={{ fontSize: '14px', fontWeight: '700', color: plan.isMostPopular ? purple : '#616473', marginBottom: '6px' }}>{plan.duration}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', textDecoration: 'line-through' }}>${plan.originalPrice}</span>
                <span style={{ fontSize: '28px', fontWeight: '800', color: '#1a1a1a' }}>${plan.price}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: priceEstimate(plan.price) ? '2px' : '14px' }}>${(plan.price / parseInt(plan.duration)).toFixed(2)}/month</div>
              {priceEstimate(plan.price) && (
                <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '14px' }}>{priceEstimate(plan.price)} · billed in USD</div>
              )}
              <div style={{ fontSize: '13px', color: '#616473', lineHeight: '1.7', flex: 1 }}>Full question bank, all 20 full-length mock tests, and AI-based scoring for Writing and Speaking. Cancel anytime.</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <a href="/pricing.html" style={{ fontSize: '13px', fontWeight: '700', color: purple }}>See full pricing details →</a>
        </div>
      </div>

      {/* FAQ -- addresses the purchase hesitations most likely to stop someone right after they've
          seen the price, so it sits directly below Pricing rather than further down the page. */}
      <div id="faq" style={{ backgroundColor: '#f4f6fa', padding: isMobile ? '48px 20px' : '64px 40px', scrollMarginTop: '70px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#1a1a1a', margin: '0 0 36px' }}>
            Frequently asked questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx
              return (
                <div key={item.q} style={{ border: '1px solid #e1e4ed', borderRadius: '12px', backgroundColor: '#fff', overflow: 'hidden' }}>
                  <button type="button" onClick={() => setOpenFaq(isOpen ? null : idx)} aria-expanded={isOpen}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '14px', fontWeight: '700', color: '#1a1a1a' }}>
                    <span>{item.q}</span>
                    <span aria-hidden="true" style={{ flexShrink: 0, color: purple, fontSize: '18px', transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }}>+</span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 20px 18px', fontSize: '13px', color: '#616473', lineHeight: '1.7' }}>
                      {item.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <ReviewsSection />

      {/* Final CTA */}
      <div style={{ backgroundColor: '#11162d', padding: isMobile ? '44px 20px' : '56px 40px', textAlign: 'center' }}>
        <h2 style={{ color: '#fff', fontSize: isMobile ? '22px' : '26px', fontWeight: '800', margin: '0 0 18px' }}>
          Start practicing for free today
        </h2>
        <button type="button" onClick={onGetStarted} style={{ backgroundColor: '#701fa1', color: '#fff', border: 'none', borderRadius: '10px', padding: '14px 30px', fontSize: '15px', fontWeight: '800', cursor: 'pointer' }}>
          Get Started Free
        </button>
      </div>

      {/* Footer */}
      <div style={{ padding: isMobile ? '28px 20px' : '28px 40px', backgroundColor: '#fff', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {[{ href: '/toefl-practice-tests/', label: 'Practice Tests' }, { href: '/toefl-mock-tests/', label: 'Mock Tests' }, { href: '/blog/', label: 'Blog' }, { href: '/pricing.html', label: 'Pricing' }, { href: '/terms.html', label: 'Terms of Service' }, { href: '/privacy.html', label: 'Privacy Policy' }, { href: '/terms.html#refund-policy', label: 'Refund Policy' }].map(link => (
            <a key={link.href} href={link.href} style={{ fontSize: '12px', fontWeight: '700', color: '#616473', textDecoration: 'none' }}>{link.label}</a>
          ))}
        </div>
        <div style={{ fontSize: '10.5px', color: '#9ca3af', lineHeight: '1.6' }}>
          TOEFL® and TOEFL iBT® are registered trademarks of ETS. This site is not endorsed or approved by ETS.<br />
          © 2026 mrreadyprep. All rights reserved.
        </div>
      </div>
    </div>
  )
}

function AuthScreen({ onAuthSuccess, initialMode, onBack }) {
  const isMobile = useIsMobile()
  // "≈ local currency" line next to the USD prices in the "Plans after you sign up" table below
  // -- see geoDetect.js; resolves to null (no extra line) for US visitors or whenever geo/FX
  // detection fails, never a wrong number.
  const priceEstimate = useGeoPriceEstimate()
  // 'login' | 'signup' | 'forgot' (request a reset link) | 'reset' (set a new password, reached
  // via the emailed link's ?reset_token=... query param)
  const [mode, setMode] = useState(initialMode || 'login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('') // success/info messages (green), separate from errors
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)

  // If the page was opened from the "reset your password" email link, jump straight into the
  // reset-password form instead of the normal login screen, and strip the token out of the
  // visible URL so it isn't sitting in the address bar / browser history afterwards.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('reset_token')
    if (token) {
      setResetToken(token)
      setMode('reset')
      params.delete('reset_token')
      const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
      window.history.replaceState({}, '', cleanUrl)
    }
  }, [])

  const inputStyle = { padding: '11px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', boxSizing: 'border-box' }
  const labelStyle = { fontWeight: '600', color: '#616473', fontSize: '12px' }

  const switchMode = (m) => { setMode(m); setError(''); setNotice(''); setAgreeTerms(false) }

  // Sends the ID token Google handed us to the backend, which verifies it and returns a normal
  // mrreadyprep session token -- from this point on a Google sign-in behaves exactly like an
  // email/password login (same token storage, same onAuthSuccess callback).
  const handleGoogleCredential = (response) => {
    setError(''); setNotice(''); setLoading(true)
    fetch(`${BACKEND_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: response.credential }),
    }).then(async res => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(extractErrorMessage(data, 'Google sign-in failed. Please try again.'))
      return data
    }).then(data => {
      clearAllDrafts()
      setAuthToken(data.access_token)
      // Google can either create a brand-new account or log an existing one back in from the
      // exact same button -- is_new_user (set server-side in google_login()) is what actually
      // distinguishes the two, so a returning student signing in isn't miscounted as a new
      // CompleteRegistration for ad-platform reporting.
      if (data.is_new_user) trackPixelEvent('CompleteRegistration')
      onAuthSuccess(data.user, !!data.is_new_user)
    }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }

  // Loads the Google Identity Services script once VITE_GOOGLE_CLIENT_ID is actually set, then
  // initializes it and renders the real Google-branded button into the #google-signin-button div
  // below. Re-runs whenever the login/signup tab toggles (that div gets remounted each time) so
  // the button always ends up in the currently-visible container.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || (mode !== 'login' && mode !== 'signup')) return
    let cancelled = false
    loadGoogleIdentityServices().then(() => {
      if (cancelled || !window.google) return
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential })
      const target = document.getElementById('google-signin-button')
      if (target) {
        target.innerHTML = ''
        window.google.accounts.id.renderButton(target, { theme: 'outline', size: 'large', width: isMobile ? 240 : 320, text: mode === 'signup' ? 'signup_with' : 'signin_with' })
      }
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isMobile])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setNotice('')

    // Found in the 25th audit round, reported live by the user: this form's <input required>/
    // type="email" attributes relied on the BROWSER's own native constraint-validation popup to
    // catch an empty/malformed email or a missing required field -- and that native popup's text
    // ("Please fill out this field", "Please include an '@' in the email address", etc.) is
    // rendered in the *browser's* UI language, not this site's. A Turkish-language browser showed
    // a Turkish popup ("Değer 6 veya daha küçük olmalıdır" on the Settings screen's analogous
    // field) on an otherwise all-English site. The <form> below now has noValidate to stop the
    // browser from ever showing that popup; these explicit checks (plus the ones already below for
    // signup) replace what the native validation used to catch, in the site's own English copy.
    if ((mode === 'login' || mode === 'signup' || mode === 'forgot') && !email.trim()) {
      setError('Please enter your email.'); return
    }
    if ((mode === 'login' || mode === 'signup' || mode === 'forgot') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Please enter a valid email address.'); return
    }
    if (mode === 'login' && !password) {
      setError('Please enter your password.'); return
    }
    // mode === 'reset' has no explicit empty-password check here -- the existing
    // `password.length < 8` check just below already catches an empty password too (0 < 8),
    // with a clearer message than a separate "field is empty" check would add.

    if (mode === 'forgot') {
      setLoading(true)
      fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // .trim() -- the validation just above already checks email.trim() against the format
        // regex, but was sending the raw (possibly whitespace-padded) value here. Harmless for
        // forgot-password specifically (the backend look-up would just find no match and return
        // the same generic "if an account exists" message either way), but kept consistent with
        // the login/signup fix below. Found in the 36th audit round.
        body: JSON.stringify({ email: email.trim() }),
      }).then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(extractErrorMessage(data, 'Something went wrong. Please try again.'))
        setNotice("If an account exists for that email, we've sent a password reset link. Check your inbox.")
      }).catch(err => setError(err.message)).finally(() => setLoading(false))
      return
    }

    if (mode === 'reset') {
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
      setLoading(true)
      fetch(`${BACKEND_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, new_password: password }),
      }).then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(extractErrorMessage(data, 'Something went wrong. Please try again.'))
        setNotice('Your password has been updated. You can now log in below.')
        setPassword(''); setConfirmPassword(''); setMode('login')
      }).catch(err => setError(err.message)).finally(() => setLoading(false))
      return
    }

    if (mode === 'signup') {
      if (!username.trim()) { setError('Please enter a username.'); return }
      if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
      if (password !== confirmPassword) { setError('Passwords do not match.'); return }
      if (!agreeTerms) { setError('Please agree to the Terms of Service and Privacy Policy to continue.'); return }
    }
    setLoading(true)
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    // .trim() on email/username -- validation above checks the trimmed value (e.g.
    // email.trim() against the format regex, username.trim() for non-empty), but this used to
    // send the raw, possibly whitespace-padded state instead. Leading/trailing whitespace is
    // common from mobile autofill or copy-pasting an address out of an email client -- with the
    // untrimmed value actually persisted, a student could pass this validation, register/log in
    // successfully, and then hit confusing "account not found" symptoms on a later login attempt
    // typed without the same stray whitespace (or vice versa), which would look like a backend
    // bug rather than the real cause. Found in the 36th audit round.
    const body = mode === 'login' ? { email: email.trim(), password } : { email: email.trim(), username: username.trim(), password }
    fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async res => {
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(extractErrorMessage(data, 'Something went wrong. Please try again.'))
      return data
    }).then(data => {
      clearAllDrafts()
      setAuthToken(data.access_token)
      // Only fires for an actual new-account signup, not every successful login -- `mode` here is
      // the same value that picked '/api/auth/register' vs '/api/auth/login' above, so this can't
      // drift out of sync with which endpoint was actually called.
      if (mode === 'signup') trackPixelEvent('CompleteRegistration')
      onAuthSuccess(data.user, mode === 'signup')
    }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }

  return (
    // overflowY: auto (not the app shell's usual overflow: hidden) + minHeight instead of a fixed
    // height -- this screen is the one place in the whole app that must stay usable with real,
    // visible page content even when nothing else has run yet (no JS, no auth). The content below
    // (logo + back-link + the login/signup card) can be taller than one viewport on short screens,
    // so it needs to be able to scroll instead of getting clipped by index.html's global
    // `body { overflow: hidden }`.
    //
    // alignItems: 'flex-start' (NOT 'center') is deliberate, not an oversight -- a flex container
    // with align-items:center + overflow:auto has a well-known browser bug: when its content is
    // TALLER than the container, the browser still centers it, which pushes the overflowing top
    // portion into NEGATIVE scroll territory that scrollTop can never reach (scrollTop has no
    // negative values). Confirmed live: on a 669px-tall viewport with 748px of content, scrollTop
    // was permanently stuck at 0 and the top ~40px -- which is exactly the "<- Back to home" link
    // and part of the logo -- was rendered but completely unreachable and unclickable, on every
    // browser, with no way for the visitor to scroll to it. flex-start avoids this entirely: content
    // always starts flush at the top and the full height is reachable by scrolling down. The only
    // cost is that on a viewport taller than the content, it now sits near the top instead of being
    // perfectly vertically centered -- a minor cosmetic tradeoff against a genuinely unusable/
    // unclickable element. Found live-testing the landing-page work, same session it was added in.
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '100vh', width: '100%', fontFamily: 'sans-serif', backgroundColor: '#11162d', boxSizing: 'border-box', padding: '16px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Reached by clicking "Log In"/"Get Started" on LandingPage (the site's actual root view
            now -- see LandingPage above), so this link takes the visitor back there instead of
            leaving them stranded on a bare form with no way out except the browser's back button.
            Also shown for the reset-password deep link (?reset_token=... from the emailed link,
            which lands here directly via AuthGate's initial showAuth=true) -- going "back" from
            there just lands on LandingPage, which is a reasonable fallback either way. */}
        {onBack && (
          <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', padding: 0, marginBottom: '14px', fontSize: '12px', fontWeight: '600', color: '#9ca3af', cursor: 'pointer' }}>
            ← Back to home
          </button>
        )}
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div style={{ color: '#b67bfb', fontSize: '24px', fontWeight: '700' }}>mrreadyprep</div>
          <div style={{ fontSize: '10px', color: '#7b809a', letterSpacing: '1.5px', marginTop: '2px' }}>TOEFL® iBT PREP</div>
        </div>

        <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '26px', boxSizing: 'border-box' }}>
          {(mode === 'login' || mode === 'signup') && (
            <div style={{ display: 'flex', borderRadius: '9px', backgroundColor: '#f4f6fa', padding: '3px', marginBottom: '20px' }}>
              {['login', 'signup'].map(m => (
                <button key={m} type="button" onClick={() => switchMode(m)}
                  style={{ flex: 1, padding: '9px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', backgroundColor: mode === m ? '#701fa1' : 'transparent', color: mode === m ? '#fff' : '#616473' }}>
                  {m === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {mode === 'forgot' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' }}>Reset your password</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>Enter your account email and we'll send you a link to choose a new password.</div>
            </div>
          )}
          {mode === 'reset' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' }}>Choose a new password</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>Enter and confirm a new password for your account.</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            {mode === 'signup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={labelStyle} htmlFor="auth-username">Username</label>
                <input id="auth-username" type="text" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} required maxLength={50} />
              </div>
            )}
            {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={labelStyle} htmlFor="auth-email">Email</label>
                <input id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
              </div>
            )}
            {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={labelStyle} htmlFor="auth-password">{mode === 'reset' ? 'New Password' : 'Password'}</label>
                <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required minLength={mode === 'signup' || mode === 'reset' ? 8 : undefined} maxLength={256} />
              </div>
            )}
            {mode === 'login' && (
              <button type="button" onClick={() => switchMode('forgot')}
                style={{ alignSelf: 'flex-end', background: 'none', border: 'none', padding: 0, marginTop: '-6px', fontSize: '12px', fontWeight: '600', color: '#701fa1', cursor: 'pointer' }}>
                Forgot password?
              </button>
            )}
            {(mode === 'signup' || mode === 'reset') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={labelStyle} htmlFor="auth-confirm-password">Confirm Password</label>
                <input id="auth-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required maxLength={256} />
              </div>
            )}

            {mode === 'signup' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#616473', lineHeight: '1.5', cursor: 'pointer' }}>
                <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} style={{ marginTop: '2px' }} />
                <span>
                  I agree to the{' '}
                  <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: '#701fa1', fontWeight: '600' }}>Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#701fa1', fontWeight: '600' }}>Privacy Policy</a>.
                </span>
              </label>
            )}

            {notice && <div style={{ background: '#edfbf3', color: '#1a7a44', fontSize: '12px', fontWeight: '600', padding: '9px 11px', borderRadius: '7px' }}>{notice}</div>}
            {error && <div style={{ background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: '600', padding: '9px 11px', borderRadius: '7px' }}>{error}</div>}

            <button type="submit" disabled={loading} style={{ backgroundColor: '#701fa1', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '4px' }}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send reset link' : 'Set new password'}
            </button>

            {(mode === 'forgot' || mode === 'reset') && (
              <button type="button" onClick={() => switchMode('login')}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', fontWeight: '600', color: '#616473', cursor: 'pointer', textAlign: 'center' }}>
                ← Back to Log In
              </button>
            )}
          </form>

          {GOOGLE_CLIENT_ID && (mode === 'login' || mode === 'signup') && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#e1e4ed' }} />
                <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: '#e1e4ed' }} />
              </div>
              <div id="google-signin-button" style={{ display: 'flex', justifyContent: 'center' }} />
              {mode === 'signup' && (
                <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '10px', lineHeight: '1.5' }}>
                  By continuing with Google, you agree to our{' '}
                  <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: '#701fa1' }}>Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#701fa1' }}>Privacy Policy</a>.
                </div>
              )}
            </>
          )}
        </div>

        {/* Pricing Table - 3 Columns. Purely informational (the account doesn't exist yet at this
            point, so there's nothing to "choose" here -- real plan selection happens on the
            Subscribe screen, SubscribeScreen above, right after signup). Numbers/features mirrored
            exactly from that screen's plan list -- and from the landing page's own pricing teaser
            -- so all three never drift out of sync again the way this panel silently did before
            (it had shown a flat-out different, stale $50/$70/$120 set of numbers). */}
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '32px 16px', marginTop: '24px', boxSizing: 'border-box', maxWidth: '100%', margin: '24px auto 0', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', marginBottom: '6px' }}>Plans after you sign up</div>
            <div style={{ fontSize: '14px', color: '#9ca3af' }}>Create your free account above, then pick a plan. Cancel anytime.</div>
          </div>
          {/* Always a single stacked column, regardless of viewport width -- this whole screen lives
              inside a fixed 380px-wide card (see the wrapper div a few dozen lines up, used for the
              login form itself), never the full page width. A 3-column `repeat(3, 1fr)` grid here
              squeezed each plan into ~100px, leaving ~70px of actual text room per card -- nowhere
              near enough for "Unlimited practice" / "20 mock tests" to fit on one line, so the list
              text wrapped badly and the cards looked cramped/overflowing even on a wide desktop
              browser window. Found live from a user screenshot. Stacking removes the need for that
              math entirely: every card gets the full ~316px of content width the card padding leaves
              inside a 380px container, which is plenty for every line here to render on one row. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {[
              { duration: '1 Month', originalPrice: 50, price: 25 },
              { duration: '3 Months', originalPrice: 120, price: 60, isMostPopular: true },
              { duration: '6 Months', originalPrice: 200, price: 100 },
            ].map(plan => (
              <div key={plan.duration} style={{ position: 'relative', border: plan.isMostPopular ? '2px solid #701fa1' : '1.5px solid #e1e4ed', borderRadius: '10px', padding: '16px 18px', boxSizing: 'border-box', backgroundColor: plan.isMostPopular ? '#f9f3fd' : '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                {plan.isMostPopular && (
                  <div style={{ position: 'absolute', top: '-10px', left: '18px', backgroundColor: '#701fa1', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px' }}>MOST POPULAR</div>
                )}
                <div style={{ minWidth: '120px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', marginBottom: '6px' }}>{plan.duration}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#9ca3af', textDecoration: 'line-through' }}>${plan.originalPrice}</span>
                    <span style={{ fontSize: '24px', fontWeight: '800', color: '#701fa1' }}>${plan.price}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af' }}>${(plan.price / parseInt(plan.duration)).toFixed(2)}/month</div>
                  {priceEstimate(plan.price) && (
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{priceEstimate(plan.price)} · billed in USD</div>
                  )}
                </div>
                <ul style={{ fontSize: '12px', color: '#616473', lineHeight: '1.8', paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                  <li>✓ Unlimited practice</li>
                  <li>✓ 20 mock tests</li>
                  <li>✓ AI feedback</li>
                  <li>✓ Progress tracking</li>
                </ul>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '24px', backgroundColor: '#f0e8ff', border: '1px solid #d4c5e2', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', color: '#6b5b95' }}>🎉 <strong style={{ color: '#701fa1', fontSize: '14px' }}>50% OFF</strong> automatically applied to your first month!</div>
          </div>
        </div>

        {/* Sample Question Demo (Quick Flavor) */}
        <div style={{ backgroundColor: '#fff', borderRadius: '14px', padding: '24px', marginTop: '14px', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', marginBottom: '4px' }}>Try a sample question</div>
            <div style={{ fontSize: '12px', color: '#9ca3af' }}>No login required</div>
          </div>
          <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e1e4ed', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#616473', lineHeight: '1.6', marginBottom: '8px' }}>
              <strong>Reading:</strong> Which word is closest in meaning to <em>"expedite"</em>?
            </div>
            <div style={{ fontSize: '12px', color: '#616473', marginBottom: '6px', paddingLeft: '12px', borderLeft: '3px solid #701fa1' }}>
              A) Slow down &nbsp; B) <strong style={{ color: '#2ac56c' }}>Speed up</strong> &nbsp; C) Explore &nbsp; D) Verify
            </div>
          </div>
          <button onClick={() => { alert('Explore the full app with dozens more practice questions ready to solve!') }} style={{ width: '100%', backgroundColor: '#11162d', color: '#fff', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>See More Samples</button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '18px', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[{ href: '/toefl-practice-tests/', label: 'Practice Tests' }, { href: '/toefl-mock-tests/', label: 'Mock Tests' }, { href: '/blog/', label: 'Blog' }, { href: '/terms.html', label: 'Terms of Service' }, { href: '/privacy.html', label: 'Privacy Policy' }, { href: '/terms.html#refund-policy', label: 'Refund Policy' }].map(link => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '11px', fontWeight: '700', color: '#1a1a1a', textDecoration: 'none', backgroundColor: '#fff', padding: '7px 14px', borderRadius: '999px' }}>
              {link.label}
            </a>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '10px', color: '#7b809a', lineHeight: '1.5', padding: '0 10px' }}>
          TOEFL® and TOEFL iBT® are registered trademarks of ETS. This site is not endorsed or approved by ETS.
        </div>
      </div>
    </div>
  )
}

// The app shell (sidebar + main content) is a fixed desktop layout with no CSS media queries
// anywhere in the codebase -- this hook is the seam that lets a handful of the highest-traffic
// spots (the app shell/nav, the Dashboard) adapt at narrow widths without a full rewrite of every
// one of the 100+ inline-styled screens. Tracks window width live so rotating a phone/resizing a
// window updates the layout immediately, not just on load.
function useIsMobile(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= breakpoint)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}

// Catches any uncaught render-time error anywhere in the tree (e.g. a stray undefined access
// deep in one of the exam components) and shows a recoverable screen instead of a blank white
// page — which is what React does by default when an error escapes with no boundary in place.
class ExamErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, hadInProgressExam: false }
  }
  static getDerivedStateFromError() {
    // Captured right here (synchronously, the instant React catches the error) rather than read
    // live in render: by the time this boundary re-renders, React has already unmounted the
    // crashed subtree and run its effects' cleanup functions, which would have already popped
    // _exitGuardCount back toward 0 (see _pushExitGuard/_popExitGuard) — reading it in render
    // would almost always see 0 and wrongly call every crash "safe," including ones that happen
    // mid-Full-Mock-Test where sessionRef is memory-only and a reload truly discards the attempt.
    return { hasError: true, hadInProgressExam: _exitGuardCount > 0 }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Uncaught error in exam UI:', error, info)
  }
  render() {
    if (this.state.hasError) {
      const lostProgress = this.state.hadInProgressExam
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#f2f3f5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', zIndex: 999, padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '44px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a1a', marginBottom: '8px' }}>Something went wrong</div>
          <div style={{ fontSize: '13px', color: '#616473', marginBottom: '20px', maxWidth: '420px' }}>
            {lostProgress
              ? "This screen hit an unexpected error while you had an exam in progress. Unfortunately reloading will lose your current attempt — sorry about that. Reload to get back to the dashboard and start again."
              : "This screen hit an unexpected error. Your progress up to this point wasn't lost — reload to pick back up from the dashboard."}
          </div>
          <button onClick={() => window.location.reload()} style={{ background: '#701fa1', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 26px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

// Gates the whole app behind login. On mount, if a token is already saved, it's verified against
// /api/auth/me (so a stale/expired token drops the student back to the login screen instead of
// showing a broken app); otherwise the login/signup screen renders immediately.
function AuthGate() {
  const [authState, setAuthState] = useState('checking') // 'checking' | 'out' | 'in'
  // Whether to show AuthScreen (the login/signup form) instead of LandingPage. Defaults to true
  // only when the URL already carries a ?reset_token=... (the "set a new password" email link
  // points straight at "/") -- AuthScreen itself is what reads and consumes that token (see its
  // own useEffect), so a visitor arriving that way must land directly on AuthScreen, not on
  // LandingPage with no obvious way to reach the reset form.
  const [showAuth, setShowAuth] = useState(() => new URLSearchParams(window.location.search).has('reset_token'))
  const [authMode, setAuthMode] = useState('login')
  // Set true only when AuthScreen/Google sign-in reports this was a brand-new account (not a
  // returning login) -- passed down to App so it can show the one-time onboarding screen. Stays
  // false (and onboarding never shows) on every ordinary login or page refresh.
  const [justSignedUp, setJustSignedUp] = useState(false)

  useEffect(() => {
    let cancelled = false
    const token = getAuthToken()
    if (!token) { setAuthState('out'); return }
    apiFetch(`${BACKEND_URL}/api/auth/me`)
      .then(res => { if (!res.ok) throw new Error(); return res.json() })
      .then(() => { if (!cancelled) setAuthState('in') })
      .catch(() => { if (!cancelled) { clearAuthToken(); setAuthState('out') } })
    return () => { cancelled = true }
  }, [])

  // Consumes the "verify your email" link's ?verify_token=... query param regardless of whether
  // the student is currently logged in or out (register already logs them straight in, so this
  // link is most often clicked while already authenticated elsewhere) -- the endpoint itself
  // doesn't require auth, it just needs the token. Strips the token from the visible URL either
  // way so it isn't sitting in the address bar / browser history afterwards.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('verify_token')
    if (!token) return
    params.delete('verify_token')
    const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
    window.history.replaceState({}, '', cleanUrl)
    apiFetch(`${BACKEND_URL}/api/auth/verify-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => showToast(ok ? (data.message || 'Your email has been verified.') : (extractErrorMessage(data, 'This verification link is invalid or has expired.')), ok ? 'success' : 'error'))
      .catch(() => showToast('Could not verify your email right now.', 'error'))
  }, [])

  // Mounted here (above the checking/out/in branches) rather than just inside App() so a toast
  // fired by the verify-email effect above -- which can run before login finishes checking, or
  // while logged out entirely -- always has a listener to actually render it.
  return (
    <>
      <ToastHost />
      <CookieConsentBanner />
      {authState === 'checking' && <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#11162d' }} />}
      {authState === 'out' && (
        showAuth
          ? <AuthScreen initialMode={authMode} onBack={() => setShowAuth(false)} onAuthSuccess={(user, isSignup) => { if (isSignup) setJustSignedUp(true); setAuthState('in') }} />
          : <LandingPage
              onGetStarted={() => { setAuthMode('signup'); setShowAuth(true) }}
              onLogIn={() => { setAuthMode('login'); setShowAuth(true) }}
            />
      )}
      {authState === 'in' && (
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#11162d' }} />}>
          <LazyApp justSignedUp={justSignedUp} />
        </Suspense>
      )}
    </>
  )
}

// NOTE: declared directly as `export default function ...` (rather than a separate
// `export default AppWithErrorBoundary` statement below) -- with App.jsx and AppMain.jsx
// importing from each other (App.jsx lazy-loads AppMain.jsx; AppMain.jsx statically imports
// shared helpers back from App.jsx), Rollup's bundler mis-compiled the indirect default-export
// binding into a bogus double call (`AppWithErrorBoundary()()`) that crashed the app on load in
// production. Exporting the function declaration directly sidesteps that.
export default function AppWithErrorBoundary() {
  return (
    <ExamErrorBoundary>
      <AuthGate />
    </ExamErrorBoundary>
  )
}


// Shared with AppMain.jsx (the lazy-loaded logged-in app) -- these utilities are used by both
// the public landing/auth screens above and the logged-in app, so they stay here and get
// imported by name rather than duplicated in both files.
export { AUTH_TOKEN_KEY, BACKEND_URL, DRAFT_KEY_PREFIX, _exitGuardCount, _exitGuardListeners, _popExitGuard, _pushExitGuard, apiFetch, clearAllDrafts, clearAuthToken, extractErrorMessage, getAuthToken, sessionExpiredHandled, showToast, trackPixelEvent, useExitGuardActive, useIsMobile }

// ─────────────────────────────────────────────────────────────────────────────
// 🌍 GA4 + GEO ANALYTICS TRACKING
// ─────────────────────────────────────────────────────────────────────────────
// Auto-track user signup/login with location data

// NOTE: this runs once at module load (not inside a React component), so it must be a plain
// function call, not a useEffect -- calling a hook outside a component/render has no dispatcher
// and crashes the whole app on load (this is what broke production after the GA4 rollout).
(function trackSignupOnLoad() {
  const userId = localStorage.getItem('user_id');
  const isNewSignup = sessionStorage.getItem('is_new_signup');

  if (userId && isNewSignup === 'true') {
    // Track signup on successful registration
    trackSignup(userId).catch(err => console.warn('[Track] Signup error:', err));
    sessionStorage.removeItem('is_new_signup');
  }
})();
// Premium subscription tracking
const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function(key, value) {
  originalSetItem.apply(this, arguments);
  
  if (key === 'premium_plan_purchased') {
    const userId = localStorage.getItem('user_id');
    const planType = value; // 'monthly', '3months', '6months'
    const prices = { 'monthly': 50, '3months': 70, '6months': 120 };
    if (userId) {
      trackPremiumConversion(userId, planType, prices[planType] || 50);
    }
  }
  
  if (key === 'test_completed') {
    const testData = JSON.parse(value);
    const userId = localStorage.getItem('user_id');
    if (userId && testData.score !== undefined) {
      trackTestCompletion(userId, testData.type || 'unknown', testData.score);
    }
  }
};
