import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Script from "next/script";
import CookieBanner from "@/components/CookieBanner";
import AuthDebug from "@/components/AuthDebug";
import MetaPixel from "@/components/MetaPixel";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { Toaster } from 'sonner';
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

const SITE_URL = "https://www.image2ad.com";
const SITE_DESCRIPTION =
  "Image2Ad turns plain product photos into ready-to-use ads. Upload a photo, and AI generates professional ad images, video, and music in about 10-15 seconds - no designer needed.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Image2Ad - Turn Product Photos Into Ads With AI",
    template: "%s | Image2Ad",
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: '/favicon.ico',
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Image2Ad",
    title: "Image2Ad - Turn Product Photos Into Ads With AI",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Image2Ad - Turn Product Photos Into Ads With AI",
    description: SITE_DESCRIPTION,
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Image2Ad",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.ico`,
      sameAs: [
        "https://www.instagram.com/image2ad",
        "https://www.facebook.com/Image2ad",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Image2Ad",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "Image2Ad",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      offers: {
        "@type": "Offer",
        price: "9.99",
        priceCurrency: "USD",
      },
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Organization/WebSite/SoftwareApplication schema for AI answer engines + search */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />

        {/* Meta Pixel with Advanced Matching */}
        <MetaPixel />

        {/* Hotjar Tracking Code */}
        <Script
          id="hotjar"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(h,o,t,j,a,r){
                  h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                  h._hjSettings={hjid:6539375,hjsv:6};
                  a=o.getElementsByTagName('head')[0];
                  r=o.createElement('script');r.async=1;
                  r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                  a.appendChild(r);
              })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `,
          }}
        />
      </head>
      <body className={`${poppins.variable} antialiased`}>
        <TutorialProvider>
          {children}
          <CookieBanner />
          <AuthDebug />
          <Toaster position="top-right" richColors closeButton />
          <Analytics />
          <AnalyticsTracker />
        </TutorialProvider>
      </body>
    </html>
  );
}
// Force rebuild Sat Sep 13 17:06:03 CEST 2025
