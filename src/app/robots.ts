import type { MetadataRoute } from 'next'

const SITE_URL = 'https://www.image2ad.com'

export default function robots(): MetadataRoute.Robots {
  const disallow = ['/dashboard', '/billing', '/folders', '/auth', '/api']

  return {
    rules: [
      // Default: allow general crawling of public marketing pages, keep
      // authenticated/app routes out of the index.
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
      // Explicitly welcome AI answer engines - some crawlers are cautious
      // by default and skip sites that don't name them.
      { userAgent: 'GPTBot', allow: '/', disallow },
      { userAgent: 'ChatGPT-User', allow: '/', disallow },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow },
      { userAgent: 'ClaudeBot', allow: '/', disallow },
      { userAgent: 'Claude-Web', allow: '/', disallow },
      { userAgent: 'anthropic-ai', allow: '/', disallow },
      { userAgent: 'PerplexityBot', allow: '/', disallow },
      { userAgent: 'Perplexity-User', allow: '/', disallow },
      { userAgent: 'Google-Extended', allow: '/', disallow },
      { userAgent: 'CCBot', allow: '/', disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
