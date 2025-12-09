import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/brevo'

export const runtime = 'nodejs'

// Prevent this route from being cached
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        // Verify cron secret if needed (optional for now, but good practice)
        // const authHeader = req.headers.get('authorization')
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //   return new NextResponse('Unauthorized', { status: 401 })
        // }

        const supabase = await createClient()

        // 1. Find candidates for 15-minute reminder
        // - Free plan
        // - Has generated at least one image (we'll check jobs table)
        // - Has NOT received reminder_15min
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, email, full_name, email_reminders_sent, subscription_status')
            .or('subscription_status.is.null,subscription_status.eq.free')
            .not('email', 'is', null)

        if (profilesError) {
            console.error('Error fetching profiles:', profilesError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ message: 'No profiles found' })
        }

        console.log(`Checking ${profiles.length} profiles for reminders...`)

        let sentCount = 0

        for (const profile of profiles) {
            const reminders = (profile.email_reminders_sent as any) || {}

            // Check if user has generated anything
            const { data: jobs, error: jobsError } = await supabase
                .from('jobs')
                .select('created_at')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: true })
                .limit(1)

            if (jobsError || !jobs || jobs.length === 0) continue

            const firstJobTime = new Date(jobs[0].created_at)
            const now = new Date()
            const diffInMinutes = (now.getTime() - firstJobTime.getTime()) / 1000 / 60

            // 1. 15 Minute Reminder (Window: 15m - 59m)
            if (diffInMinutes >= 15 && diffInMinutes < 60 && !reminders.reminder_15min) {
                console.log(`Sending 15min reminder to ${profile.email}`)
                await sendEmail({
                    to: [{ email: profile.email, name: profile.full_name || undefined }],
                    subject: 'Your 50% discount is still available (ending soon)',
                    htmlContent: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1>Your 50% discount is ending soon!</h1>
              <p>Hi ${profile.full_name || 'there'},</p>
              <p>We noticed you started creating with Image2Ad but haven't unlocked the full power of Pro yet.</p>
              <p>Your <strong>50% discount</strong> is still available for a limited time.</p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
                <h2 style="color: #7c3aed; margin: 0;">Unlock Pro for only CHF 9.50</h2>
                <p style="margin-top: 10px;">Get 200 ad-ready images, 4K quality, and AI video generation.</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://image2ad.com'}/billing?promo=pro20limited" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 10px;">Claim 50% Off Now</a>
              </div>

              <p>Don't miss out on creating professional ads in seconds.</p>
              <p>Best,<br/>The Image2Ad Team</p>
            </div>
          `
                })
                await supabase.from('profiles').update({
                    email_reminders_sent: { ...reminders, reminder_15min: new Date().toISOString() }
                }).eq('id', profile.id)
                sentCount++
            }

            // 2. 1 Hour Reminder (Window: 60m - 23h 59m)
            else if (diffInMinutes >= 60 && diffInMinutes < 1440 && !reminders.reminder_1h) {
                console.log(`Sending 1h reminder to ${profile.email}`)
                await sendEmail({
                    to: [{ email: profile.email, name: profile.full_name || undefined }],
                    subject: 'Did you forget something? 🎨',
                    htmlContent: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1>Did you forget something?</h1>
              <p>Hi ${profile.full_name || 'there'},</p>
              <p>You're so close to creating amazing professional ads.</p>
              <p>With <strong>Image2Ad Pro</strong>, you get:</p>
              <ul>
                <li>✨ <strong>200 Ad-Ready Images</strong> per month</li>
                <li>🎥 <strong>AI Video Generation</strong> for engaging ads</li>
                <li>🖼️ <strong>4K Ultra-HD Quality</strong> exports</li>
                <li>🚀 <strong>Priority Generation</strong> speed</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://image2ad.com'}/billing?promo=pro20limited" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Unlock Pro Features (-50%)</a>
              </div>

              <p>Best,<br/>The Image2Ad Team</p>
            </div>
          `
                })
                await supabase.from('profiles').update({
                    email_reminders_sent: { ...reminders, reminder_1h: new Date().toISOString() }
                }).eq('id', profile.id)
                sentCount++
            }

            // 3. 24 Hour Reminder (Window: 24h - 48h)
            else if (diffInMinutes >= 1440 && diffInMinutes < 2880 && !reminders.reminder_24h) {
                console.log(`Sending 24h reminder to ${profile.email}`)
                await sendEmail({
                    to: [{ email: profile.email, name: profile.full_name || undefined }],
                    subject: 'Last chance: 50% off expires today ⏳',
                    htmlContent: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1>Last chance! ⏳</h1>
              <p>Hi ${profile.full_name || 'there'},</p>
              <p>This is it. Your special <strong>50% discount</strong> on Image2Ad Pro is expiring today.</p>
              <p>Don't let this offer slip away. Upgrade now to get 200 images, 4K quality, and video generation for just <strong>CHF 9.50</strong>.</p>
              
              <div style="background-color: #fff1f2; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; border: 1px solid #fda4af;">
                <h2 style="color: #be123c; margin: 0;">Offer Expires Today</h2>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://image2ad.com'}/billing?promo=pro20limited" style="display: inline-block; background-color: #be123c; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 15px;">Claim Last Chance Offer</a>
              </div>

              <p>Best,<br/>The Image2Ad Team</p>
            </div>
          `
                })
                await supabase.from('profiles').update({
                    email_reminders_sent: { ...reminders, reminder_24h: new Date().toISOString() }
                }).eq('id', profile.id)
                sentCount++
            }
        }

        return NextResponse.json({
            success: true,
            sent: sentCount,
            checked: profiles.length
        })

    } catch (error) {
        console.error('Error in send-reminders cron:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
