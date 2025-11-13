import { createClient } from '@/lib/supabase/server'

/**
 * Check if user's trial has expired and update their status accordingly
 * Returns the updated profile or null if no changes needed
 */
export async function checkAndUpdateTrialExpiration(userId: string) {
  const supabase = await createClient()

  // Get user profile
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status, trial_end_at, plan, credits')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    console.error('Error fetching profile for trial check:', error)
    return null
  }

  // Only check if user is currently in trial
  if (profile.subscription_status !== 'trialing') {
    return null
  }

  // Check if trial has expired
  if (profile.trial_end_at) {
    const trialEndDate = new Date(profile.trial_end_at)
    const now = new Date()

    if (now > trialEndDate) {
      console.log(`Trial expired for user ${userId}, reverting to free plan`)

      // Update user to free plan
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'free',
          plan: 'free',
          trial_end_at: null,
          // Keep remaining credits or reset to 3 (you can choose)
          // credits: 3, // Uncomment to reset to 3 free credits
        })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating expired trial:', updateError)
        return null
      }

      return {
        ...updatedProfile,
        trialExpired: true,
      }
    }
  }

  return null
}

/**
 * Get trial status information for display
 */
export async function getTrialStatus(userId: string) {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status, trial_end_at, plan')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return null
  }

  if (profile.subscription_status !== 'trialing' || !profile.trial_end_at) {
    return null
  }

  const trialEndDate = new Date(profile.trial_end_at)
  const now = new Date()
  const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const hoursRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60))

  return {
    isActive: now < trialEndDate,
    endDate: trialEndDate,
    daysRemaining: Math.max(0, daysRemaining),
    hoursRemaining: Math.max(0, hoursRemaining),
  }
}
