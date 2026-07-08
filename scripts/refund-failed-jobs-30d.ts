// One-off backfill: refund credits for jobs that failed in the last 30 days,
// before the refund_credit RPC existed. Safe to re-run - the query excludes
// already-refunded rows (refunded_at IS NOT NULL), and refund_credit() has
// its own idempotency guard as a second layer.
//
// Usage:
//   npx tsx scripts/refund-failed-jobs-30d.ts --dry-run   (default, no writes)
//   npx tsx scripts/refund-failed-jobs-30d.ts --execute   (actually refunds)
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function run() {
  const execute = process.argv.includes('--execute')

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local or shell exports).')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, user_id, credits_used, created_at, error_message')
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .is('refunded_at', null)

  if (error) {
    console.error('Failed to query jobs:', error.message)
    process.exit(1)
  }

  if (!jobs || jobs.length === 0) {
    console.log('No unrefunded failed jobs found in the last 30 days. Nothing to do.')
    return
  }

  const byUser = new Map<string, number>()
  let totalCredits = 0
  for (const job of jobs) {
    const amount = job.credits_used ?? 1
    totalCredits += amount
    byUser.set(job.user_id, (byUser.get(job.user_id) ?? 0) + amount)
  }

  console.log(`Found ${jobs.length} failed job(s) across ${byUser.size} user(s), totaling ${totalCredits} credit(s).`)
  console.log('')
  for (const [userId, credits] of byUser.entries()) {
    console.log(`  user ${userId}: +${credits} credit(s)`)
  }
  console.log('')

  if (!execute) {
    console.log('Dry run only - no changes made. Re-run with --execute to actually refund these credits.')
    return
  }

  console.log('Executing refunds...')
  let refunded = 0
  let skipped = 0
  for (const job of jobs) {
    const { data: didRefund, error: refundError } = await supabase.rpc('refund_credit', {
      job_uuid: job.id
    })
    if (refundError) {
      console.error(`  job ${job.id}: refund_credit error - ${refundError.message}`)
      continue
    }
    if (didRefund) {
      refunded++
    } else {
      skipped++ // already refunded by a concurrent run or the live failure path
    }
  }

  console.log(`Done. Refunded ${refunded} job(s), skipped ${skipped} (already refunded).`)
}

run()
