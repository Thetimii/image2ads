'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MetaPixel() {
  useEffect(() => {
    // Initialize pixels with user data if available
    const initPixelsWithUserData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check cookie consent
      const cookieConsent = localStorage.getItem('cookieConsent')
      
      // META PIXEL
      if (typeof window !== 'undefined' && (window as any).fbq) {
        const fbq = (window as any).fbq
        
        if (cookieConsent === 'accepted') {
          // If user is logged in, send their email for advanced matching
          if (user?.email) {
            console.log('[MetaPixel] Initializing with advanced matching for user:', user.email)
            // Re-init with user data - pixel hashes this automatically
            fbq('init', '1317994616486123', {
              em: user.email, // Email will be hashed by Meta automatically
            })
          }
          
          // Track PageView
          fbq('track', 'PageView')
        } else if (cookieConsent === 'declined') {
          fbq('consent', 'revoke')
        }
      }
      
      // TIKTOK PIXEL
      if (typeof window !== 'undefined' && (window as any).ttq) {
        const ttq = (window as any).ttq
        
        if (cookieConsent === 'accepted') {
          console.log('[TikTokPixel] Tracking PageView')
          ttq.page()
        } else if (cookieConsent === 'declined') {
          console.log('[TikTokPixel] Cookie consent declined')
          ttq.disableCookie()
        }
      }
    }

    // Wait a bit for the pixel scripts to load
    setTimeout(initPixelsWithUserData, 100)
  }, [])

  return (
    <>
      {/* Meta Pixel Base Code */}
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
            
            // Initial basic init (will be enhanced with user data if available)
            fbq('init', '1317994616486123');
          `,
        }}
      />
      
      {/* TikTok Pixel Base Code */}
      <Script
        id="tiktok-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
            var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script")
            ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

              ttq.load('D3VK89RC77U93U3TBGGG');
              ttq.page();
            }(window, document, 'ttq');
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
    </>
  )
}
