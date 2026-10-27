'use client';

import { useState } from 'react';
import { coverDataUri } from '@/lib/cover';

// Foto Unsplash assegnata all'articolo (URL con marcatore wf=1, vedi
// lib/unsplash.js); se manca o non si carica, copertina generata dal titolo
// (lib/cover.js): mai riquadri rotti, mai articoli senza immagine, mai
// immagini uguali. I vecchi image_url (foto ripetute, immagini AI) si ignorano.
const isCurated = (url) => /^https:\/\/images\.unsplash\.com\/.*[?&]wf=1(&|$)/.test(String(url || ''));

export default function SafeImage({ src, category, alt, className, style, loading = 'lazy' }) {
  const cover = coverDataUri(alt, category);
  const [failed, setFailed] = useState(false);
  const photo = isCurated(src) && !failed ? src : null;
  return (
    <img
      src={photo || cover}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      onError={photo ? () => setFailed(true) : undefined}
    />
  );
}
