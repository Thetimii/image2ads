// Server-only email sanity check used at signup.
// 1) strict-ish syntax, 2) known throwaway domains, 3) the domain must have
// MX records (i.e. it can actually receive mail). DNS outages fail OPEN so a
// resolver hiccup never blocks a real customer.

export type EmailCheck =
  | { ok: true; email: string }
  | { ok: false; reason: 'format' | 'disposable' | 'no_mail_server'; message: string }

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i

// Common disposable / throwaway inbox providers.
const DISPOSABLE = new Set([
  '10minutemail.com', '10minutemail.net', '20minutemail.com', 'anonaddy.me', 'burnermail.io',
  'byom.de', 'dispostable.com', 'dropmail.me', 'emailondeck.com', 'fakeinbox.com', 'fakemail.net',
  'getairmail.com', 'getnada.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamailblock.com', 'harakirimail.com', 'inboxbear.com', 'inboxkitten.com', 'mail.tm',
  'mail-temp.com', 'mailcatch.com', 'maildrop.cc', 'mailinator.com', 'mailinator.net',
  'mailnesia.com', 'mailpoof.com', 'mintemail.com', 'moakt.com', 'mohmal.com', 'mytemp.email',
  'nada.email', 'sharklasers.com', 'spam4.me', 'spamgourmet.com', 'temp-mail.io', 'temp-mail.org',
  'tempail.com', 'tempmail.com', 'tempmail.dev', 'tempmail.net', 'tempmailo.com', 'tempr.email',
  'throwawaymail.com', 'trashmail.com', 'trashmail.de', 'trashmail.net', 'yopmail.com',
  'yopmail.fr', 'yopmail.net', 'emailfake.com', 'tmail.ws', 'tmpmail.org', 'tmpmail.net',
  'mailto.plus', 'fexpost.com', 'fexbox.org', 'rover.info', 'chitthi.in', 'mailbox.in.ua',
  'cuvox.de', 'dayrep.com', 'einrot.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com',
  'rhyta.com', 'superrito.com', 'teleworm.us', 'armyspy.com', 'grr.la', 'pokemail.net',
  'spambox.us', 'luxusmail.org', 'minuteinbox.com', 'emltmp.com', 'vomoto.com', 'tempinbox.com',
])

type DohAnswer = { type: number; data: string }
type DohResponse = { Status: number; Answer?: DohAnswer[] }

const DOH_ENDPOINTS = [
  'https://cloudflare-dns.com/dns-query',
  'https://dns.google/resolve',
]

// MX lookup over DNS-over-HTTPS (works the same everywhere, incl. Vercel).
// Returns true/false when the answer is definitive, null when inconclusive.
async function lookupMx(domain: string): Promise<boolean | null> {
  for (const base of DOH_ENDPOINTS) {
    try {
      const res = await fetch(`${base}?name=${encodeURIComponent(domain)}&type=MX`, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      })
      if (!res.ok) continue
      const json = (await res.json()) as DohResponse
      if (json.Status === 3) return false // NXDOMAIN - domain doesn't exist
      if (json.Status !== 0) continue // SERVFAIL etc. - try next resolver
      const mx = (json.Answer || []).filter((a) => a.type === 15)
      // No MX, or a "null MX" (RFC 7505: exchange ".") => can't receive mail
      return mx.some((a) => {
        const host = a.data.trim().split(/\s+/)[1]
        return !!host && host !== '.'
      })
    } catch {
      // timeout / network - try next resolver
    }
  }
  return null
}

async function hasMailServer(domain: string): Promise<boolean> {
  const result = await lookupMx(domain)
  if (result === null) {
    // Resolver trouble: don't punish the user.
    console.warn('[email-check] MX lookup inconclusive for', domain)
    return true
  }
  return result
}

export async function checkEmail(raw: string): Promise<EmailCheck> {
  const email = (raw || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.includes('..')) {
    return { ok: false, reason: 'format', message: 'Please enter a valid email address.' }
  }
  const domain = email.split('@')[1]
  const parentDomain = domain.split('.').slice(-2).join('.')
  if (DISPOSABLE.has(domain) || DISPOSABLE.has(parentDomain)) {
    return {
      ok: false,
      reason: 'disposable',
      message: 'Throwaway email addresses aren’t supported. Please use your real email.',
    }
  }
  if (!(await hasMailServer(domain))) {
    return {
      ok: false,
      reason: 'no_mail_server',
      message: `“${domain}” can’t receive email. Please check the address for typos.`,
    }
  }
  return { ok: true, email }
}
