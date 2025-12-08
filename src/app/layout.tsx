import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Script from "next/script";
import CookieBanner from "@/components/CookieBanner";
import AuthDebug from "@/components/AuthDebug";
import MetaPixel from "@/components/MetaPixel";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { Toaster } from 'sonner';
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Image 2 Ads",
  description: "Turn Plain Product Photos into Stunning Ads",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
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
        </TutorialProvider>
      </body>
    </html>
  );
}
// Force rebuild Sat Sep 13 17:06:03 CEST 2025
