import Link from 'next/link'
import type { Metadata } from 'next'
import { blogPosts } from '@/lib/blog-posts'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Guides on AI ad generation, ad formats, and turning product photos into ads.',
}

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen text-gray-800 py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-600 hover:text-blue-800 mb-8 inline-block">
          ← Back to Home
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          Image2Ad Blog
        </h1>
        <p className="text-xl text-gray-700 mb-12">
          Guides on AI ad generation, ad formats, and turning product photos into ads.
        </p>

        <div className="space-y-8">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block p-6 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all"
            >
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">{post.title}</h2>
              <p className="text-gray-600">{post.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
