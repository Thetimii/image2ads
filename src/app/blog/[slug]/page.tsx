import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { blogPosts, getBlogPost } from '@/lib/blog-posts'

const SITE_URL = 'https://www.image2ad.com'

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url: `${SITE_URL}/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: post.title,
        description: post.description,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        author: { '@id': `${SITE_URL}/#organization` },
        publisher: { '@id': `${SITE_URL}/#organization` },
        mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
      },
      {
        '@type': 'FAQPage',
        mainEntity: post.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: { '@type': 'Answer', text: faq.a },
        })),
      },
    ],
  }

  return (
    <div className="min-h-screen text-gray-800 py-16 px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto">
        <Link href="/blog" className="text-blue-600 hover:text-blue-800 mb-8 inline-block">
          ← Back to Blog
        </Link>

        <h1 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          {post.title}
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          Published {new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="prose prose-lg max-w-none">
          {post.sections.map((section) => (
            <section key={section.heading} className="mb-10">
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">{section.heading}</h2>
              <p className="text-gray-800 font-medium mb-4">{section.summary}</p>
              {section.paragraphs?.map((para, i) => (
                <p key={i} className="text-gray-700 mb-4">{para}</p>
              ))}
              {section.list && (
                <ul className="text-gray-700 mb-4 space-y-1 list-disc pl-5">
                  {section.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          <section className="mt-16">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {post.faqs.map((faq) => (
                <div key={faq.q}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{faq.q}</h3>
                  <p className="text-gray-700">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {post.relatedSlugs && post.relatedSlugs.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Keep reading</h2>
              <ul className="space-y-2 list-disc pl-5">
                {post.relatedSlugs.map((slug) => {
                  const related = getBlogPost(slug)
                  if (!related) return null
                  return (
                    <li key={slug}>
                      <Link href={`/blog/${related.slug}`} className="text-blue-600 hover:text-blue-800">
                        {related.title}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>

        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
          <Link
            href="/signup"
            className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold px-8 py-3 rounded-xl hover:scale-105 transition-transform"
          >
            Try Image2Ad Free →
          </Link>
        </div>
      </div>
    </div>
  )
}
