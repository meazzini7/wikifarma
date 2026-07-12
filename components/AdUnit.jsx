'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_ID } from '@/lib/constants';

export default function AdUnit({ slot = 'auto' }) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not yet loaded or blocked - safe to ignore.
    }
  }, []);

  return (
    <div className="ad-clean-wrapper">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_ID}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
