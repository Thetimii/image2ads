'use client'

/**
 * First-party analytics client.
 * Sends batched events to /api/track, which writes them to the
 * analytics_events / analytics_sessions tables in Supabase.
 *
 * Identity model:
 *  - anonymous_id: persistent per browser (localStorage), links pre-signup
 *    activity to the account once the user logs in.
 *  - session_id: rotates after 30 minutes of inactivity (localStorage).
 */

const ANON_KEY = 'i2a_anonymous_id'
const SESSION_KEY = 'i2a_session_id'
const LAST_ACTIVE_KEY = 'i2a_last_active'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000
const FLUSH_INTERVAL_MS = 5000

interface QueuedEvent {
  event_name: string
  page: string
  properties: Record<string, unknown>
  created_at: string
}

interface SessionMeta {
  id: string
  anonymous_id: string
  user_id?: string
  landing_page?: string
  referrer?: string
  referrer_category?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  fbclid?: string
  ttclid?: string
  scroll_depth?: number
  new_pages?: number
}

let queue: QueuedEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let isNewSession = false
let newPages = 0
let maxScrollDepth = 0

const IDENTIFIED_USER_KEY = 'i2a_identified_user_id'

/**
 * Tie the current anonymous_id to a real user_id as soon as it's known
 * (right after signup/login, or on any authenticated page load). Every
 * subsequent track() call includes it, and the server backfills every
 * earlier session/event row sharing this anonymous_id - so the exact
 * server-side auth-cookie timing at the moment of the signup_completed
 * call no longer matters; the client just says who it is.
 */
export function identify(userId: string) {
  if (typeof window === 'undefined' || !userId) return
  try {
    sessionStorage.setItem(IDENTIFIED_USER_KEY, userId)
  } catch {
    /* ignore */
  }
}

function getIdentifiedUserId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return sessionStorage.getItem(IDENTIFIED_USER_KEY) || undefined
  } catch {
    return undefined
  }
}

/** Buckets a raw referrer URL into a readable source for reporting. */
function categorizeReferrer(referrer: string): string {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (/(^|\.)google\./.test(host)) return 'google'
    if (host === 'chat.openai.com' || host === 'chatgpt.com') return 'chatgpt'
    if (/(^|\.)bing\./.test(host)) return 'bing'
    if (host === 'l.facebook.com' || host === 'facebook.com' || host === 'lm.facebook.com') return 'facebook'
    if (host === 'instagram.com' || host === 'l.instagram.com') return 'instagram'
    if (/(^|\.)tiktok\.com/.test(host)) return 'tiktok'
    if (/(^|\.)reddit\.com/.test(host)) return 'reddit'
    if (/(^|\.)youtube\.com/.test(host)) return 'youtube'
    return host
  } catch {
    return 'other'
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function getAnonymousId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(ANON_KEY)
  if (!id) {
    id = uuid()
    localStorage.setItem(ANON_KEY, id)
  }
  return id
}

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  const now = Date.now()
  const lastActive = parseInt(localStorage.getItem(LAST_ACTIVE_KEY) || '0', 10)
  let id = localStorage.getItem(SESSION_KEY)
  if (!id || now - lastActive > SESSION_TIMEOUT_MS) {
    id = uuid()
    localStorage.setItem(SESSION_KEY, id)
    isNewSession = true
  }
  localStorage.setItem(LAST_ACTIVE_KEY, String(now))
  return id
}

function sessionMeta(): SessionMeta {
  const meta: SessionMeta = {
    id: getSessionId(),
    anonymous_id: getAnonymousId(),
    user_id: getIdentifiedUserId(),
    scroll_depth: maxScrollDepth,
    new_pages: newPages,
  }
  newPages = 0
  if (isNewSession) {
    const params = new URLSearchParams(window.location.search)
    meta.landing_page = window.location.pathname
    meta.referrer = document.referrer || undefined
    meta.referrer_category = categorizeReferrer(document.referrer)
    meta.utm_source = params.get('utm_source') || undefined
    meta.utm_medium = params.get('utm_medium') || undefined
    meta.utm_campaign = params.get('utm_campaign') || undefined
    meta.utm_term = params.get('utm_term') || undefined
    meta.utm_content = params.get('utm_content') || undefined
    meta.fbclid = params.get('fbclid') || undefined
    meta.ttclid = params.get('ttclid') || undefined
    isNewSession = false
  }
  return meta
}

function send(payload: { session: SessionMeta; events: QueuedEvent[] }, useBeacon: boolean) {
  const body = JSON.stringify(payload)
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
    return
  }
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* analytics must never break the app */
  })
}

export function flush(useBeacon = false) {
  if (typeof window === 'undefined' || queue.length === 0) return
  const events = queue
  queue = []
  send({ session: sessionMeta(), events }, useBeacon)
}

/** Track a single event. Safe to call anywhere in client code. */
export function track(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  try {
    getSessionId() // keeps the inactivity window fresh
    queue.push({
      event_name: eventName,
      page: window.location.pathname,
      properties,
      created_at: new Date().toISOString(),
    })
    if (!flushTimer) {
      flushTimer = setInterval(() => flush(), FLUSH_INTERVAL_MS)
    }
    // Conversion-critical events go out immediately
    if (
      ['signup_completed', 'checkout_started', 'payment_completed', 'paywall_viewed'].includes(
        eventName
      )
    ) {
      flush()
    }
  } catch {
    /* never throw from analytics */
  }
}

/** Called by AnalyticsTracker on route changes. */
export function trackPageView(pathname: string) {
  newPages += 1
  maxScrollDepth = 0
  track('page_view', { pathname })
}

/** Record a scroll-depth milestone (25/50/75/100). */
export function trackScrollDepth(depth: number) {
  maxScrollDepth = Math.max(maxScrollDepth, depth)
  track('scroll_depth', { depth })
}

/** Flush synchronously when the page is being closed/hidden. */
export function flushOnHide(timeOnPageSeconds: number) {
  queue.push({
    event_name: 'page_left',
    page: window.location.pathname,
    properties: { seconds_on_page: timeOnPageSeconds, max_scroll_depth: maxScrollDepth },
    created_at: new Date().toISOString(),
  })
  flush(true)
}

/** Keep the session's duration ticking while the tab is visible. */
export function ping() {
  track('ping', {})
}

// ---------------------------------------------------------------
// Ad click-id capture: fbclid/ttclid from the landing URL, kept in
// localStorage so Meta CAPI events can be attributed to the ad even
// when the pixel cookies (_fbc/_fbp) were blocked by the consent banner.
// ---------------------------------------------------------------

const CLICK_IDS_KEY = 'i2a_click_ids'

export function captureClickIds() {
  try {
    const params = new URLSearchParams(window.location.search)
    const fbclid = params.get('fbclid')
    const ttclid = params.get('ttclid')
    if (!fbclid && !ttclid) return
    const existing = JSON.parse(localStorage.getItem(CLICK_IDS_KEY) || '{}')
    localStorage.setItem(
      CLICK_IDS_KEY,
      JSON.stringify({
        ...existing,
        ...(fbclid ? { fbclid, fbclid_ts: Date.now() } : {}),
        ...(ttclid ? { ttclid, ttclid_ts: Date.now() } : {}),
      })
    )
  } catch {
    /* ignore */
  }
}

/** Meta _fbc click-id format, built from the stored fbclid. */
export function getStoredFbc(): string | undefined {
  try {
    const { fbclid, fbclid_ts } = JSON.parse(localStorage.getItem(CLICK_IDS_KEY) || '{}')
    if (!fbclid) return undefined
    return `fb.1.${fbclid_ts || Date.now()}.${fbclid}`
  } catch {
    return undefined
  }
}
