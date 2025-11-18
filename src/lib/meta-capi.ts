import crypto from 'node:crypto'

const META_PIXEL_ID = process.env.META_PIXEL_ID
const META_CAPI_ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || process.env.access_token_capi
const META_CAPI_API_VERSION = process.env.META_CAPI_API_VERSION || 'v19.0'
const META_CAPI_TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE

export type MetaEventName =
  | 'PageView'
  | 'ViewContent'
  | 'SubscribedButtonClick'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Purchase'
  | 'CompleteRegistration'
  | 'SubscribedButtonClick'
  | string

type MetaUserData = {
  email?: string
  phone?: string
  firstName?: string
  lastName?: string
  city?: string
  state?: string
  country?: string
  zip?: string
  county?: string
  gender?: string
  externalId?: string
  clientUserAgent?: string
  ipAddress?: string
  fbp?: string
  fbc?: string
}

export interface MetaEventInput {
  eventName: MetaEventName
  eventSourceUrl: string
  actionSource?: 'website' | 'app' | 'phone_call' | 'chat' | string
  eventId?: string
  eventTime?: number
  customData?: Record<string, unknown>
  attributionData?: Record<string, unknown>
  originalEventData?: Record<string, unknown>
  userData?: MetaUserData
}

const hashValue = (value?: string) => {
  if (!value) return undefined
  const normalized = value.trim().toLowerCase()
  if (!normalized) return undefined
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

const buildUserData = (data?: MetaUserData) => {
  if (!data) return undefined

  const userData: Record<string, unknown> = {}

  const emailHash = hashValue(data.email)
  if (emailHash) userData.em = [emailHash]

  const phoneHash = hashValue(data.phone)
  if (phoneHash) userData.ph = [phoneHash]

  const fnHash = hashValue(data.firstName)
  if (fnHash) userData.fn = fnHash

  const lnHash = hashValue(data.lastName)
  if (lnHash) userData.ln = lnHash

  const cityHash = hashValue(data.city)
  if (cityHash) userData.ct = cityHash

  const stateHash = hashValue(data.state)
  if (stateHash) userData.st = stateHash

  const zipHash = hashValue(data.zip)
  if (zipHash) userData.zp = zipHash

  const countryHash = hashValue(data.country)
  if (countryHash) userData.country = countryHash

  const countyHash = hashValue(data.county)
  if (countyHash) userData.region = countyHash

  const genderHash = hashValue(data.gender)
  if (genderHash) userData.ge = genderHash

  const externalIdHash = hashValue(data.externalId)
  if (externalIdHash) userData.external_id = [externalIdHash]

  if (data.clientUserAgent) {
    userData.client_user_agent = data.clientUserAgent
  }

  if (data.ipAddress) {
    userData.client_ip_address = data.ipAddress
  }

  if (data.fbp) {
    userData.fbp = data.fbp
  }

  if (data.fbc) {
    userData.fbc = data.fbc
  }

  return Object.keys(userData).length ? userData : undefined
}

export async function sendMetaEvent(input: MetaEventInput) {
  if (!META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN) {
    console.warn('[MetaCAPI] Missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN, skipping event:', input.eventName)
    return { success: false, reason: 'missing_config' }
  }

  const eventTime = input.eventTime || Math.floor(Date.now() / 1000)

  const body = {
    data: [
      {
        event_name: input.eventName,
        event_time: eventTime,
        event_source_url: input.eventSourceUrl,
        action_source: input.actionSource || 'website',
        event_id: input.eventId,
        user_data: buildUserData(input.userData),
        custom_data: input.customData,
        attribution_data: input.attributionData,
        original_event_data: input.originalEventData,
      },
    ],
    test_event_code: META_CAPI_TEST_EVENT_CODE || undefined,
  }

  const url = `https://graph.facebook.com/${META_CAPI_API_VERSION}/${META_PIXEL_ID}/events?access_token=${META_CAPI_ACCESS_TOKEN}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorResponse = await response.text()
      console.error('[MetaCAPI] Failed to send event:', input.eventName, errorResponse)
      return { success: false, reason: 'request_failed', details: errorResponse }
    }

    const result = await response.json()
    return { success: true, result }
  } catch (error) {
    console.error('[MetaCAPI] Error sending event:', input.eventName, error)
    return { success: false, reason: 'exception', details: (error as Error).message }
  }
}
