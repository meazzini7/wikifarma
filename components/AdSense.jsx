'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { ADSENSE_ID } from '@/lib/constants';

// Script AdSense su tutto il sito (non solo sugli articoli): Auto ads puo' cosi'
// piazzare annunci anche su home, elenchi, "In tendenza" e pagine tradotte, che
// prima non ne mostravano nessuno. Escluso /admin (nessuna impression inutile
// e nessun rischio di clic accidentali dell'amministratore sui propri annunci).
export default function AdSense() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;
  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
