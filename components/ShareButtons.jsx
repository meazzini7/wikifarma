'use client';

import { useState } from 'react';

export default function ShareButtons({ url, title }) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable - ignore
    }
  }

  return (
    <div className="share-buttons">
      <span className="share-label">Condividi:</span>
      <a
        href={`https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="share-btn"
        aria-label="Condividi su WhatsApp"
      >
        WhatsApp
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="share-btn"
        aria-label="Condividi su Facebook"
      >
        Facebook
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="share-btn"
        aria-label="Condividi su X"
      >
        X
      </a>
      <button type="button" className="share-btn" onClick={handleCopy}>
        {copied ? 'Copiato ✓' : 'Copia link'}
      </button>
    </div>
  );
}
