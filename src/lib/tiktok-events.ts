/**
 * TikTok Events API Client
 * Server-side event tracking for better conversion accuracy
 */

const TIKTOK_PIXEL_ID = 'D3VK89RC77U93U3TBGGG'
const TIKTOK_API_VERSION = 'v1.3'
const TIKTOK_API_ENDPOINT = `https://business-api.tiktok.com/open_api/${TIKTOK_API_VERSION}/event/track/`

interface TikTokEventParams {
  event: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'CompleteRegistration' | 'Purchase' | 'Search'
  event_id?: string
  event_time: number
  user: {
    email?: string
    phone?: string
    external_id?: string
    ip?: string
    user_agent?: string
  }
  properties?: {
    value?: number
    currency?: string
    content_id?: string
    content_type?: string
    content_name?: string
    search_string?: string
  }
  page: {
    url: string
  }
}

/**
 * Send event to TikTok Events API
 */
export async function sendTikTokEvent(params: TikTokEventParams) {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN

  if (!accessToken) {
    console.warn('[TikTok Events API] Access token not configured, skipping event:', params.event)
    return
  }

  try {
    const payload = {
      pixel_code: TIKTOK_PIXEL_ID,
      event: params.event,
      event_id: params.event_id || `${params.event}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: params.event_time.toString(),
      context: {
        user: params.user,
        page: params.page,
      },
      properties: params.properties || {},
    }

    console.log('[TikTok Events API] Sending event:', params.event)

    const response = await fetch(TIKTOK_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        pixel_code: TIKTOK_PIXEL_ID,
        event: params.event,
        event_id: payload.event_id,
        timestamp: payload.timestamp,
        context: payload.context,
        properties: payload.properties,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[TikTok Events API] Error:', error)
      return
    }

    const result = await response.json()
    console.log('[TikTok Events API] Success:', result)
    return result
  } catch (error) {
    console.error('[TikTok Events API] Exception:', error)
  }
}

/**
 * Track user registration/signup
 */
export async function trackCompleteRegistration(params: {
  email: string
  userId: string
  ip?: string
  userAgent?: string
  url: string
}) {
  return sendTikTokEvent({
    event: 'CompleteRegistration',
    event_time: Math.floor(Date.now() / 1000),
    user: {
      email: params.email,
      external_id: params.userId,
      ip: params.ip,
      user_agent: params.userAgent,
    },
    page: {
      url: params.url,
    },
  })
}

/**
 * Track page view with content
 */
export async function trackViewContent(params: {
  email?: string
  userId?: string
  contentId?: string
  contentName?: string
  value?: number
  currency?: string
  ip?: string
  userAgent?: string
  url: string
}) {
  return sendTikTokEvent({
    event: 'ViewContent',
    event_time: Math.floor(Date.now() / 1000),
    user: {
      email: params.email,
      external_id: params.userId,
      ip: params.ip,
      user_agent: params.userAgent,
    },
    properties: {
      content_id: params.contentId,
      content_name: params.contentName,
      value: params.value,
      currency: params.currency || 'USD',
    },
    page: {
      url: params.url,
    },
  })
}

/**
 * Track subscription purchase
 */
export async function trackPurchase(params: {
  email: string
  userId: string
  value: number
  currency?: string
  contentId: string
  contentName: string
  ip?: string
  userAgent?: string
  url: string
}) {
  return sendTikTokEvent({
    event: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    user: {
      email: params.email,
      external_id: params.userId,
      ip: params.ip,
      user_agent: params.userAgent,
    },
    properties: {
      value: params.value,
      currency: params.currency || 'USD',
      content_id: params.contentId,
      content_name: params.contentName,
      content_type: 'subscription',
    },
    page: {
      url: params.url,
    },
  })
}

/**
 * Track checkout initiation
 */
export async function trackInitiateCheckout(params: {
  email: string
  userId: string
  value: number
  currency?: string
  contentName: string
  ip?: string
  userAgent?: string
  url: string
}) {
  return sendTikTokEvent({
    event: 'InitiateCheckout',
    event_time: Math.floor(Date.now() / 1000),
    user: {
      email: params.email,
      external_id: params.userId,
      ip: params.ip,
      user_agent: params.userAgent,
    },
    properties: {
      value: params.value,
      currency: params.currency || 'USD',
      content_name: params.contentName,
      content_type: 'subscription',
    },
    page: {
      url: params.url,
    },
  })
}
