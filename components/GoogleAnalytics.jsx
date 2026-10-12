'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { GA_ID } from '@/lib/constants';

// Niente tracciamento sotto /admin: le visite dell'amministratore ai
// pannelli (compreso /admin/insights) non devono entrare nelle statistiche,
// perche' sono proprio i dati su cui la strategia editoriale impara.
export default function GoogleAnalytics() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
