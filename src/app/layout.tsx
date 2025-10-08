import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Script from "next/script";
import CookieBanner from "@/components/CookieBanner";
import AuthDebug from "@/components/AuthDebug";
import { TutorialProvider } from "@/contexts/TutorialContext";
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
        {/* Meta Pixel Code */}
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '1317994616486123');
              
              // Check for cookie consent before tracking
              const cookieConsent = localStorage.getItem('cookieConsent');
              if (cookieConsent === 'accepted') {
                fbq('track', 'PageView');
              } else if (cookieConsent === 'declined') {
                fbq('consent', 'revoke');
              }
              // If no consent yet, wait for user decision
            `,
          }}
        />
        
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
        
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            height="1" 
            width="1" 
            style={{display: 'none'}}
            src="https://www.facebook.com/tr?id=1317994616486123&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>
      <body className={`${poppins.variable} antialiased`}>
        <TutorialProvider>
          {children}
          <CookieBanner />
          <AuthDebug />
        </TutorialProvider>
      </body>
    </html>
  );
}
// Force rebuild Sat Sep 13 17:06:03 CEST 2025
