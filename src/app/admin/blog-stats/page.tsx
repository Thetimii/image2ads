import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { blogPosts } from '@/lib/blog-posts'

export const dynamic = 'force-dynamic'

// Service-role client: blog_post_summary is revoked from anon/authenticated,
// so only a server-side service-role read can see it.
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SummaryRow = {
  landing_page: string
  total_sessions: number
  google_sessions: number | null
  ai_referral_sessions: number | null
  signups: number
}

export default async function BlogStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>
}) {
  const { key } = await searchParams
  const adminKey = process.env.ADMIN_STATS_KEY

  if (!adminKey || key !== adminKey) {
    return <div className="p-10 text-gray-500 text-sm">Not found.</div>
  }

  const { data, error } = await supabaseAdmin.from('blog_post_summary').select('*')
  const rows = (data ?? []) as SummaryRow[]
  const bySlug = new Map(rows.map((r) => [r.landing_page.replace(/^\/blog\//, ''), r]))

  return (
    <div className="min-h-screen py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-gray-900">Blog performance</h1>
        <p className="text-sm text-gray-500 mb-6">
          Views = sessions landing on that post. Numbers come from analytics_sessions, refreshed live.
        </p>
        {error && <p className="text-red-600 mb-4">{error.message}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b border-gray-300 text-gray-500">
                <th className="py-2 pr-4">Post</th>
                <th className="py-2 pr-4">Views</th>
                <th className="py-2 pr-4">From Google</th>
                <th className="py-2 pr-4">From AI answers</th>
                <th className="py-2 pr-4">Signups</th>
              </tr>
            </thead>
            <tbody>
              {blogPosts.map((post) => {
                const r = bySlug.get(post.slug)
                return (
                  <tr key={post.slug} className="border-b border-gray-100 text-gray-800">
                    <td className="py-2 pr-4">{post.title}</td>
                    <td className="py-2 pr-4">{r?.total_sessions ?? 0}</td>
                    <td className="py-2 pr-4">{r?.google_sessions ?? 0}</td>
                    <td className="py-2 pr-4">{r?.ai_referral_sessions ?? 0}</td>
                    <td className="py-2 pr-4">{r?.signups ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
