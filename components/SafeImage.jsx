'use client';

import { useState } from 'react';
import { coverDataUri } from '@/lib/cover';

// Foto Unsplash assegnata all'articolo (URL con wf=1, vedi lib/unsplash.js);
// se manca o non si carica, copertina generata dal titolo (lib/cover.js): mai
// riquadri rotti, mai articoli senza immagine, mai immagini uguali. I vecchi
// image_url (foto ripetute, immagini AI) si ignorano.
const isCurated = (url) => /^https:\/\/images\.unsplash\.com\/.*[?&]wf=1(&|$)/.test(String(url || ''));

// Le schede degli elenchi non hanno bisogno di 1200 px: con ~20 schede per
// pagina la differenza pesa megabyte e rallenta il caricamento (Core Web Vitals).
const small = (url) => url.replace('w=1200', 'w=640').replace('h=750', 'h=400');

export default function SafeImage({ src, category, alt, className, style, loading = 'lazy', priority = false }) {
  const cover = coverDataUri(alt, category);
  const [failed, setFailed] = useState(false);
  const isCard = /\bcard-img\b/.test(className || '');
  const photo = isCurated(src) && !failed ? (isCard ? small(src) : src) : null;
  return (
    <img
      src={photo || cover}
      alt={alt}
      className={className}
      style={style}
      width={isCard ? 640 : 1200}
      height={isCard ? 400 : 750}
      loading={priority ? 'eager' : loading}
      fetchpriority={priority ? 'high' : undefined}
      decoding="async"
      onError={photo ? () => setFailed(true) : undefined}
    />
  );
}
