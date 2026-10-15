// Marketing-tracking consent (Meta pixel etc.)
//
// - Explicit choice always wins (Accept / Decline / custom toggles).
// - No choice yet: visitors from countries with opt-in cookie law
//   (EU/EEA, UK, Switzerland) are NOT tracked until they accept.
//   Everyone else (US, CA, AU, NZ, ...) is tracked by default and can
//   still decline via the banner (opt-out model).
// - Unknown country => treated as opt-in (safe default).
//
// The visitor's country comes from the `i2a_cc` cookie set by middleware
// from Vercel's geo header.

const OPT_IN_COUNTRIES = new Set([
  // EU
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // EEA + UK + CH
  'IS', 'LI', 'NO', 'GB', 'UK', 'CH',
])

export const COUNTRY_COOKIE = 'i2a_cc'

export function requiresOptIn(country?: string | null): boolean {
  if (!country) return true
  return OPT_IN_COUNTRIES.has(country.toUpperCase())
}

function readCountryCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const hit = document.cookie.split(/; */).find((c) => c.startsWith(`${COUNTRY_COOKIE}=`))
  return hit ? decodeURIComponent(hit.split('=')[1] || '') : undefined
}

/** Can we fire marketing pixels (Meta/TikTok browser events) for this visitor? */
export function marketingAllowed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const consent = localStorage.getItem('cookieConsent')
    if (consent === 'accepted') return true
    if (consent === 'declined') return false
    if (consent === 'customized') {
      const prefs = JSON.parse(localStorage.getItem('cookiePreferences') || '{}')
      return prefs?.marketing === true
    }
  } catch {
    // storage blocked - fall through to geo default
  }
  return !requiresOptIn(readCountryCookie())
}

/** Has the visitor explicitly opted out? (server-side events respect this too) */
export function marketingDeclined(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const consent = localStorage.getItem('cookieConsent')
    if (consent === 'declined') return true
    if (consent === 'customized') {
      const prefs = JSON.parse(localStorage.getItem('cookiePreferences') || '{}')
      return prefs?.marketing !== true
    }
  } catch {}
  return false
}
