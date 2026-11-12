'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_ID } from '@/lib/constants';

// Unita' pubblicitaria manuale (in-article). Si mostra solo se in Vercel c'e'
// NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE (ID dell'unita' creata in AdSense):
// senza uno slot reale un <ins> non mostrerebbe nulla. Le Auto ads restano attive.
export default function AdSlot({ slot }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (!slot || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // blocco annunci o script non ancora caricato: nessun effetto
    }
  }, [slot]);
  if (!slot) return null;
  return (
    <div className="ad-slot" aria-label="Pubblicita'">
      <ins className="adsbygoogle" style={{ display: 'block', textAlign: 'center' }} data-ad-layout="in-article" data-ad-format="fluid" data-ad-client={ADSENSE_ID} data-ad-slot={slot} />
    </div>
  );
}
