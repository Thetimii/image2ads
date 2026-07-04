export interface MetaClientEventPayload {
  eventName: string
  eventSourceUrl?: string
  actionSource?: string
  customData?: Record<string, unknown>
  eventId?: string
  eventTime?: number
  userData?: Record<string, unknown>
  attributionData?: Record<string, unknown>
  originalEventData?: Record<string, unknown>
}

const shouldSendMetaEvent = () => {
  if (typeof window === 'undefined') return false
  const consent = localStorage.getItem('cookieConsent')
  // If the user has explicitly declined tracking, skip
  if (consent === 'declined') return false
  return true
}

// Mirror Meta conversion events into our first-party analytics
// (analytics_events in Supabase) so the funnel is queryable per user.
const META_TO_ANALYTICS: Record<string, string> = {
  SubscribedButtonClick: 'upgrade_button_clicked',
  InitiateCheckout: 'checkout_started',
  AddPaymentInfo: 'payment_info_added',
  Purchase: 'purchase_confirmed_client',
  StartTrial: 'trial_started_client',
  ViewContent: 'content_viewed',
}

export async function trackMetaEvent(payload: MetaClientEventPayload) {
  const analyticsName = META_TO_ANALYTICS[payload.eventName]
  if (analyticsName) {
    import('@/lib/analytics')
      .then(({ track }) => track(analyticsName, payload.customData ?? {}))
      .catch(() => {})
  }

  if (!shouldSendMetaEvent()) return

  try {
    // Fall back to the fbclid captured on landing when the _fbc cookie is
    // missing (e.g. consent banner not accepted), so Meta can still
    // attribute the conversion to the ad click.
    let fbcFallback: string | undefined
    try {
      const hasFbcCookie = document.cookie.split(/; */).some((c) => c.startsWith('_fbc='))
      if (!hasFbcCookie) {
        const { getStoredFbc } = await import('@/lib/analytics')
        fbcFallback = getStoredFbc()
      }
    } catch {}

    await fetch('/api/meta-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        eventSourceUrl: payload.eventSourceUrl || (typeof window !== 'undefined' ? window.location.href : undefined),
        actionSource: payload.actionSource || 'website',
        userData: {
          ...(fbcFallback ? { fbc: fbcFallback } : {}),
          ...payload.userData,
        },
      }),
    })
  } catch (error) {
    console.error('[MetaCAPI] Failed to send event', payload.eventName, error)
  }
}
