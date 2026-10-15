'use client'

import { STRIPE_PLANS, type StripePlan } from '@/lib/stripe-plans'
import { trackMetaEvent } from '@/lib/meta-client'

const DEFAULT_CURRENCY = 'USD'

type PlanInput = StripePlan | (string & {})

interface SubscriptionEventOptions {
  plan?: PlanInput
  couponId?: string
  source?: string
  value?: number
  currency?: string
  contentName?: string
  eventId?: string
  /** 'year' reports the yearly price (e.g. $299) instead of the monthly one */
  interval?: 'month' | 'year' | string
}

interface ViewContentEventOptions {
  contentName: string
  contentCategory?: string
  contentIds?: string[]
  value?: number
  currency?: string
  source?: string
}

interface RegistrationEventOptions {
  method: string
  status?: 'success' | 'failure' | string
}

const isStripePlan = (plan?: string): plan is StripePlan => {
  if (!plan) return false
  return Object.prototype.hasOwnProperty.call(STRIPE_PLANS, plan)
}

const titleCase = (input?: string) => {
  if (!input) return undefined
  return input.charAt(0).toUpperCase() + input.slice(1)
}

const cleanObject = <T extends Record<string, unknown>>(obj: T) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && value !== null)
  ) as Partial<T>
}

const buildSubscriptionCustomData = (options: SubscriptionEventOptions = {}) => {
  const planKey = isStripePlan(options.plan) ? options.plan : undefined
  const planDetails = planKey ? STRIPE_PLANS[planKey] : undefined
  const isYearly = options.interval === 'year'
  const value =
    typeof options.value === 'number'
      ? options.value
      : isYearly
        ? planDetails?.yearlyPrice
        : planDetails?.price
  const currency = options.currency || DEFAULT_CURRENCY
  const productId = planDetails?.productId || options.plan
  const baseName = options.contentName || planDetails?.name || titleCase(options.plan) || 'Subscription'
  const contentName = planDetails && !options.contentName
    ? `${baseName} (${isYearly ? 'yearly' : 'monthly'})`
    : baseName

  const contentsEntry = cleanObject({
    id: productId,
    quantity: 1,
    item_price: value,
  })

  return cleanObject({
    value,
    currency,
    content_name: contentName,
    content_category: 'subscription',
    content_type: 'product',
    content_ids: productId ? [productId] : undefined,
    contents: Object.keys(contentsEntry).length ? [contentsEntry] : undefined,
    plan_tier: options.plan,
    billing_interval: planDetails ? (isYearly ? 'year' : 'month') : undefined,
    coupon_id: options.couponId,
    source: options.source,
  })
}

export const trackMetaSubscribedButtonClick = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'SubscribedButtonClick',
    eventId: options.eventId,
    customData: buildSubscriptionCustomData(options),
  })
}

export const trackMetaInitiateCheckout = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'InitiateCheckout',
    eventId: options.eventId,
    customData: buildSubscriptionCustomData(options),
  })
}

export const trackMetaAddPaymentInfo = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'AddPaymentInfo',
    eventId: options.eventId,
    customData: buildSubscriptionCustomData(options),
  })
}

export const trackMetaPurchase = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'Purchase',
    eventId: options.eventId,
    customData: {
      ...buildSubscriptionCustomData(options),
      status: 'success',
    },
  })
}

export const trackMetaViewContent = (options: ViewContentEventOptions) => {
  return trackMetaEvent({
    eventName: 'ViewContent',
    customData: cleanObject({
      content_name: options.contentName,
      content_category: options.contentCategory || 'page',
      content_ids: options.contentIds,
      value: options.value,
      currency: options.value ? options.currency || DEFAULT_CURRENCY : undefined,
      source: options.source,
    }),
  })
}

export const trackMetaCompleteRegistration = (options: RegistrationEventOptions, eventId?: string) => {
  return trackMetaEvent({
    eventName: 'CompleteRegistration',
    eventId,
    customData: cleanObject({
      status: options.status || 'success',
      method: options.method,
    }),
  })
}

export const trackMetaAddToCart = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'AddToCart',
    eventId: options.eventId,
    customData: buildSubscriptionCustomData(options),
  })
}

export const trackMetaStartTrial = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'StartTrial',
    eventId: options.eventId,
    customData: {
      ...buildSubscriptionCustomData(options),
      status: 'trialing',
    },
  })
}
