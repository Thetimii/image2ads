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

export async function trackMetaEvent(payload: MetaClientEventPayload) {
  if (!shouldSendMetaEvent()) return

  try {
    await fetch('/api/meta-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        eventSourceUrl: payload.eventSourceUrl || (typeof window !== 'undefined' ? window.location.href : undefined),
        actionSource: payload.actionSource || 'website',
      }),
    })
  } catch (error) {
    console.error('[MetaCAPI] Failed to send event', payload.eventName, error)
  }
}
