'use client';

import { useState } from 'react';
import { getFallbackForTitle } from '@/lib/imageGen';
import { PLACEHOLDER_IMAGE } from '@/lib/constants';

// Cover images are AI-generated URLs (pollinations.ai) which can
// occasionally 404 or fail to render (the classic "broken image" icon).
// Swap to a reliable curated photo on error (picked deterministically from
// the title, so different articles don't all collapse onto one identical
// fallback image), and to a generic placeholder if even that fails.
export default function SafeImage({ src, category, alt, className, style, loading = 'lazy' }) {
  const fallback = getFallbackForTitle(alt, category);
  const [current, setCurrent] = useState(src || fallback);
  const [stage, setStage] = useState(0);

  function handleError() {
    if (stage === 0) {
      setStage(1);
      setCurrent(fallback);
    } else if (stage === 1) {
      setStage(2);
      setCurrent(PLACEHOLDER_IMAGE);
    }
  }

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={handleError}
    />
  );
}
