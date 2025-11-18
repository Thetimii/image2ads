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
  const value = typeof options.value === 'number' ? options.value : planDetails?.price
  const currency = options.currency || DEFAULT_CURRENCY
  const productId = planDetails?.productId || options.plan
  const contentName = options.contentName || planDetails?.name || titleCase(options.plan) || 'Subscription'

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
    coupon_id: options.couponId,
    source: options.source,
  })
}

export const trackMetaSubscribedButtonClick = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'SubscribedButtonClick',
    customData: buildSubscriptionCustomData(options),
  })
}

export const trackMetaInitiateCheckout = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'InitiateCheckout',
    customData: buildSubscriptionCustomData(options),
  })
}

export const trackMetaAddPaymentInfo = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'AddPaymentInfo',
    customData: buildSubscriptionCustomData(options),
  })
}

export const trackMetaPurchase = (options: SubscriptionEventOptions) => {
  return trackMetaEvent({
    eventName: 'Purchase',
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

export const trackMetaCompleteRegistration = (options: RegistrationEventOptions) => {
  return trackMetaEvent({
    eventName: 'CompleteRegistration',
    customData: cleanObject({
      status: options.status || 'success',
      method: options.method,
    }),
  })
}
