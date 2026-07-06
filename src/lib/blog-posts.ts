export interface BlogSection {
  heading: string
  // Answer-first summary: 40-60 words, front-loaded conclusion, high fact
  // density. This is the paragraph AI engines are most likely to quote.
  summary: string
  // Supporting paragraphs after the summary.
  paragraphs?: string[]
  list?: string[]
}

export interface BlogFaq {
  q: string
  a: string
}

export interface BlogPost {
  slug: string
  title: string
  description: string // 150-160 chars, used for meta description + card excerpt
  publishedAt: string // ISO date
  updatedAt: string
  sections: BlogSection[]
  faqs: BlogFaq[]
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'how-to-turn-product-photos-into-ads-with-ai',
    title: 'How to Turn a Product Photo Into a Professional Ad Using AI',
    description:
      'A step-by-step guide to converting a plain product photo into a ready-to-run ad using AI image generation - no designer or editing software required.',
    publishedAt: '2026-07-06',
    updatedAt: '2026-07-06',
    sections: [
      {
        heading: 'The short answer',
        summary:
          'The core takeaway is: upload a product photo to an AI ad generator, describe the scene or style you want, and the AI produces a finished ad image in 10-15 seconds. Tools like Image2Ad handle background, lighting, and composition automatically - no design software or editing skill is required.',
      },
      {
        heading: 'Step 1: Start with a clean product photo',
        summary:
          'A usable source photo needs three things: even lighting, a product that fills most of the frame, and minimal background clutter. Phone photos work fine - professional studio lighting is not required, but harsh shadows and blurry focus reduce output quality.',
        paragraphs: [
          'AI image models edit and re-contextualize what they can clearly see. A photo taken in bright, indirect light (near a window, or outdoors in shade) gives the model a clean edge to work with when replacing the background or adjusting the scene.',
        ],
      },
      {
        heading: 'Step 2: Describe the ad you want in plain language',
        summary:
          'Specific prompts outperform vague ones. "Product on a marble countertop with soft morning light and a blurred kitchen background" produces a more usable result than "nice background" - the more concrete the description, the more the output matches the intent.',
        list: [
          'Name the surface or setting (marble countertop, wooden table, outdoor patio)',
          'Name the lighting (soft morning light, studio lighting, golden hour)',
          'Name the mood if relevant (minimal, bold, luxury, playful)',
        ],
      },
      {
        heading: 'Step 3: Choose a model tier for the level of detail you need',
        summary:
          'Standard models (like Image2Ad\'s nano-banana) suit quick social posts and testing variations. Higher-tier models (nano-banana-pro) produce sharper detail and higher resolution output, better suited for a hero product shot or a paid ad campaign where quality is scrutinized closely.',
      },
      {
        heading: 'Step 4: Export in the right format for the platform',
        summary:
          'Instagram Stories and TikTok need a 9:16 vertical image; Facebook and Google Display Ads generally use 1:1 square or 1.91:1 landscape. Generating directly in the target aspect ratio avoids cropping that cuts off the product or text.',
      },
      {
        heading: 'Step 5: Generate variations instead of manually editing',
        summary:
          'If the first result is close but not right, regenerating with an adjusted prompt is faster and cheaper than manual retouching. AI ad tools are built for iteration - unlimited variations until the ad matches what you had in mind.',
      },
    ],
    faqs: [
      {
        q: 'Do I need Photoshop or design experience to make an AI ad?',
        a: 'No. AI ad generators like Image2Ad handle the entire design process - background, lighting, and composition - from a text prompt and a product photo. No editing software is required.',
      },
      {
        q: 'How long does it take to generate an ad from a photo?',
        a: 'Generation typically takes 10-15 seconds per image with standard AI models. Higher-quality "pro" models may take slightly longer due to higher resolution output.',
      },
      {
        q: 'What image formats do I need for different ad platforms?',
        a: 'Instagram Stories and TikTok use a 9:16 vertical format. Facebook and Google Ads typically use 1:1 square or 1.91:1 landscape. Generating directly in the correct aspect ratio avoids cropping issues.',
      },
      {
        q: 'Can AI match my existing brand style?',
        a: 'Yes - describing your brand colors, fonts, and style preferences in the prompt lets the AI generate on-brand output. Being specific in the prompt produces more consistent results than generic descriptions.',
      },
    ],
  },
  {
    slug: 'ai-ad-generator-vs-designer-agency',
    title: 'AI Ad Generator vs. Hiring a Designer or Agency: Cost and Speed Compared',
    description:
      'A direct comparison of AI ad generation versus hiring a freelance designer or agency, covering cost per ad, turnaround time, and when each option makes sense.',
    publishedAt: '2026-07-06',
    updatedAt: '2026-07-06',
    sections: [
      {
        heading: 'The short answer',
        summary:
          'AI ad generation costs roughly $0.05-$0.50 per image and delivers results in seconds; a freelance designer typically charges $25-$150 per ad and takes 1-3 days; an agency charges $500-$5,000+ per campaign with a 1-2 week turnaround. AI is faster and cheaper for volume and testing; agencies still lead for large brand campaigns requiring original creative direction.',
      },
      {
        heading: 'Cost per ad',
        summary:
          'On a subscription plan, AI-generated ads cost a fraction of a dollar per image once credits are amortized across a monthly plan - for example, Image2Ad\'s Pro plan is $19.99/month for 200 credits, roughly $0.10 per standard image. A freelance designer\'s per-ad rate rarely drops below $25, and agencies price by project or retainer, not per image.',
      },
      {
        heading: 'Turnaround time',
        summary:
          'AI generates an image in 10-15 seconds, meaning dozens of variations can be tested within a single sitting. A freelance designer typically returns a first draft in 1-3 business days, plus revision rounds. An agency campaign timeline runs 1-2 weeks or longer for concepting, drafts, and approval cycles.',
      },
      {
        heading: 'Where a human designer or agency still wins',
        summary:
          'Original brand concepts, complex multi-element campaign creative, and video with custom storytelling still benefit from human creative direction. AI ad tools are strongest for rapid iteration on a known product photo, not for building a brand identity from nothing.',
        list: [
          'New brand identity or logo design: human designer',
          'High-volume product ad variations for testing: AI generator',
          'Complex narrative video campaigns: agency or specialized studio',
          'Quick social posts and A/B test creative: AI generator',
        ],
      },
      {
        heading: 'A common hybrid approach',
        summary:
          'Many small businesses use AI to generate the bulk of everyday ad variations and reserve a designer or agency for flagship campaigns and brand guideline work. This keeps recurring ad-creative costs low without giving up human input on the highest-stakes creative.',
      },
    ],
    faqs: [
      {
        q: 'Is an AI ad generator cheaper than a freelance designer?',
        a: 'Yes, typically by a wide margin. AI-generated ads cost roughly $0.10-$0.50 per image on a subscription plan, compared to $25-$150 per ad from a freelance designer.',
      },
      {
        q: 'How much faster is AI ad generation than hiring a designer?',
        a: 'AI generates an image in 10-15 seconds. A freelance designer typically takes 1-3 business days for a first draft, and an agency campaign can take 1-2 weeks or more.',
      },
      {
        q: 'Should I use AI or an agency for a new brand launch?',
        a: 'For establishing a new brand identity or complex campaign concepts, a human designer or agency is generally still the better fit. AI ad generators excel at fast, high-volume variations on an existing product and brand style.',
      },
    ],
  },
  {
    slug: 'ad-image-sizes-formats-guide',
    title: 'Ad Image Sizes and Formats for Facebook, Instagram, TikTok, and Google Ads',
    description:
      'A reference guide to the correct image dimensions and aspect ratios for Facebook, Instagram, TikTok, and Google Ads campaigns.',
    publishedAt: '2026-07-06',
    updatedAt: '2026-07-06',
    sections: [
      {
        heading: 'The short answer',
        summary:
          'Instagram and TikTok primarily use a 9:16 vertical format (1080x1920px) for Stories and Reels. Facebook Feed ads use 1:1 square (1080x1080px) or 4:5 vertical. Google Display Ads commonly use 1.91:1 landscape (1200x628px) or 1:1 square. Matching the native aspect ratio avoids automatic cropping that can cut off product or text.',
      },
      {
        heading: 'Instagram',
        summary:
          'Instagram Feed posts use 1:1 square (1080x1080px) or 4:5 vertical (1080x1350px) for maximum vertical space in-feed. Instagram Stories and Reels use 9:16 vertical (1080x1920px) full-screen format.',
        list: [
          'Feed post: 1:1 (1080x1080px) or 4:5 (1080x1350px)',
          'Stories / Reels: 9:16 (1080x1920px)',
        ],
      },
      {
        heading: 'Facebook',
        summary:
          'Facebook Feed ads perform best at 1:1 square (1080x1080px) or 4:5 vertical, since both formats occupy more vertical space on mobile feeds than a landscape image. Facebook Stories ads use the same 9:16 vertical format as Instagram Stories.',
        list: [
          'Feed ad: 1:1 (1080x1080px) or 4:5 (1080x1350px)',
          'Stories ad: 9:16 (1080x1920px)',
        ],
      },
      {
        heading: 'TikTok',
        summary:
          'TikTok ads are full-screen vertical video or image at 9:16 (1080x1920px). Content designed for horizontal or square formats gets letterboxed and loses impact in TikTok\'s native feed experience.',
      },
      {
        heading: 'Google Ads',
        summary:
          'Google Display Network ads commonly use 1.91:1 landscape (1200x628px), 1:1 square (1200x1200px), or 300x250px for smaller display placements. Google Search ads do not use images directly, but Performance Max campaigns require all three formats.',
        list: [
          'Landscape: 1.91:1 (1200x628px)',
          'Square: 1:1 (1200x1200px)',
          'Small display: 300x250px',
        ],
      },
      {
        heading: 'Generating the right format from the start',
        summary:
          'AI ad generators that support aspect-ratio selection at generation time (square, landscape, portrait) avoid the quality loss and awkward cropping that comes from resizing a single image after the fact for multiple platforms.',
      },
    ],
    faqs: [
      {
        q: 'What image size does Instagram Stories use?',
        a: 'Instagram Stories use a 9:16 vertical aspect ratio at 1080x1920 pixels.',
      },
      {
        q: 'What is the best image format for a Facebook feed ad?',
        a: '1:1 square (1080x1080px) or 4:5 vertical (1080x1350px) both perform well, since they occupy more vertical space on mobile feeds than a landscape image.',
      },
      {
        q: 'Does TikTok support square or landscape ads?',
        a: 'TikTok is built for 9:16 full-screen vertical content. Square or landscape content gets letterboxed and performs worse in TikTok\'s native feed.',
      },
      {
        q: 'What image sizes does Google Ads require?',
        a: 'Google Display and Performance Max campaigns commonly require 1.91:1 landscape (1200x628px), 1:1 square (1200x1200px), and a smaller 300x250px display size.',
      },
    ],
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug)
}
