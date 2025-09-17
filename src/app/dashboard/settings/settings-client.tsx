'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import DashboardLayout from '@/components/DashboardLayout'

interface SettingsClientProps {
  user: User
  profile: Profile
}

export default function SettingsClient({ user, profile }: SettingsClientProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [formData, setFormData] = useState({
    fullName: profile.full_name || '',
    email: user.email || '',
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const router = useRouter()
  const supabase = createClient()

  // Function to determine plan display name based on subscription_id (which now contains product ID)
  const getPlanDisplayName = () => {
    if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
      // Check if subscription_id contains a product ID
      if (profile.subscription_id) {
        switch (profile.subscription_id.toLowerCase()) {
          case 'starter':
          case 'prod_t2wztl6zmyzqda': // Stripe product ID for starter
            return 'Starter Plan'
          case 'pro':
          case 'prod_t2x00jxheiyfr4': // Stripe product ID for pro
            return 'Pro Plan'
          case 'business':
          case 'prod_t2x1ll9q9hicqr': // Stripe product ID for business
            return 'Business Plan'
          default:
            return 'Subscribed Plan' // Fallback for old subscription IDs
        }
      }
      return 'Subscribed Plan'
    }
    return 'Free Plan'
  }

  const getSubscriptionStatus = () => {
    if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
      return 'Active'
    } else if (profile.subscription_status === 'canceled' || profile.subscription_status === 'cancelled') {
      return 'Cancelled'
    }
    return 'Free Plan'
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    
    try {
      // Update profile in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: formData.fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) {
        console.error('Error updating profile:', error)
        alert('Failed to update profile. Please try again.')
      } else {
        alert('Profile updated successfully!')
        // Refresh the page to show updated data
        router.refresh()
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('An error occurred while updating your profile.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('Passwords do not match')
      return
    }

    setIsUpdating(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })
      
      if (error) throw error
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      alert('Password updated successfully')
    } catch (error) {
      console.error('Error updating password:', error)
      alert('Error updating password')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      // TODO: Implement account deletion API call
      setTimeout(() => {
        setIsDeleting(false)
        setShowDeleteConfirm(false)
        router.push('/')
      }, 2000)
    } catch (error) {
      console.error('Error deleting account:', error)
      setIsDeleting(false)
    }
  }

  return (
    <DashboardLayout user={user} profile={profile}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-600">
            Manage your account information, security, and preferences.
          </p>
        </div>

        <div>
          {/* Profile Information */}
          <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Profile Information</h2>
              <p className="text-sm text-gray-600">Update your personal information.</p>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter your email"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isUpdating ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Updating...</span>
                    </div>
                  ) : (
                    'Update Profile'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Change Password</h2>
              <p className="text-sm text-gray-600">Update your password to keep your account secure.</p>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="p-6 space-y-6">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  id="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="Enter new password"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  placeholder="Confirm new password"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdating || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isUpdating ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Updating...</span>
                    </div>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Account Information */}
          <div className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Account Information</h2>
              <p className="text-sm text-gray-600">View your account details and subscription status.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Account ID</span>
                <span className="text-sm text-gray-900 font-mono">{user.id.slice(0, 8)}...</span>
              </div>
              
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Member Since</span>
                <span className="text-sm text-gray-900">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Subscription Status</span>
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                  (profile.subscription_status === 'active' || profile.subscription_status === 'trialing')
                    ? 'bg-green-100 text-green-800' 
                    : (profile.subscription_status === 'canceled' || profile.subscription_status === 'cancelled')
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {getSubscriptionStatus()}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Plan Type</span>
                <span className={`text-sm px-2 py-1 rounded-full ${
                  (profile.subscription_status === 'active' || profile.subscription_status === 'trialing')
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {getPlanDisplayName()}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-3">
                <span className="text-sm font-medium text-gray-600">Available Credits</span>
                <span className="text-sm text-gray-900 font-semibold">{profile.credits}</span>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
            <div className="p-6 border-b border-red-200 bg-red-50">
              <h2 className="text-lg font-semibold text-red-900 mb-1">Danger Zone</h2>
              <p className="text-sm text-red-700">These actions cannot be undone.</p>
            </div>
            
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">Delete Account</h3>
                  <p className="text-sm text-gray-600">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="ml-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Account</h3>
                <p className="text-gray-600 text-sm">
                  Are you sure you want to delete your account? This will permanently remove all your data, including folders, images, and generated ads.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isDeleting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Deleting...</span>
                    </div>
                  ) : (
                    'Delete Account'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}