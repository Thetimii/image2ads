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

            // Skip if already sent
            if (reminders.reminder_15min) continue

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

            // Check if it's been at least 15 minutes (and less than 24 hours to avoid spamming old users)
            if (diffInMinutes >= 15 && diffInMinutes < 1440) {
                console.log(`Sending 15min reminder to ${profile.email} (First gen: ${Math.round(diffInMinutes)} mins ago)`)

                // Send Email
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

                // Update profile
                await supabase
                    .from('profiles')
                    .update({
                        email_reminders_sent: {
                            ...reminders,
                            reminder_15min: new Date().toISOString()
                        }
                    })
                    .eq('id', profile.id)

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
