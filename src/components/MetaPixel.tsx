'use client'

import Script from 'next/script'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MetaPixel() {
  useEffect(() => {
    // Initialize pixel with user data if available
    const initPixelWithUserData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      // Check if fbq is available
      if (typeof window !== 'undefined' && (window as any).fbq) {
        const fbq = (window as any).fbq
        
        // Check cookie consent
        const cookieConsent = localStorage.getItem('cookieConsent')
        
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
    }

    // Wait a bit for the pixel script to load
    setTimeout(initPixelWithUserData, 100)
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
