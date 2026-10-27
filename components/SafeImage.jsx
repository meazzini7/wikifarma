'use client';

import { useState } from 'react';
import { getFallbackForTitle, resolveCover } from '@/lib/imageGen';
import { PLACEHOLDER_IMAGE } from '@/lib/constants';

// Mostra solo foto reali: un URL generato da AI (articoli vecchi) viene
// sostituito subito con la foto del pool scelta in base al titolo. Se la foto
// non si carica, si passa al pool e poi a un placeholder generico.
export default function SafeImage({ src, category, alt, className, style, loading = 'lazy' }) {
  const fallback = getFallbackForTitle(alt, category);
  const [current, setCurrent] = useState(resolveCover(src, alt, category));
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
