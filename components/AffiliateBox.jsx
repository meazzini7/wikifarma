'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/gtag';

// Un prodotto: foto ufficiale di Amazon + nome. Se la foto non si carica o
// Amazon risponde con il pixel vuoto (ASIN non piu' valido), si nasconde il
// riquadro immagine invece di mostrare un buco.
function Item({ it, theme, slug }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <a
      href={it.href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      className="affiliate-item"
      onClick={() => trackEvent('affiliate_click', { item: it.key, theme, article: slug })}
    >
      {imgOk && (
        <span className="affiliate-photo">
          <img
            src={it.image}
            alt={it.label}
            loading="lazy"
            onLoad={(e) => {
              if (e.currentTarget.naturalWidth < 20) setImgOk(false);
            }}
            onError={() => setImgOk(false)}
          />
        </span>
      )}
      <span className="affiliate-label">{it.label}</span>
      <span className="affiliate-cta">Vedi su Amazon →</span>
    </a>
  );
}

// Box "Prodotti utili" (link di affiliazione Amazon). Client component per
// tracciare il clic in GA4 (evento affiliate_click): si vede quali articoli
// portano davvero verso l'acquisto.
export default function AffiliateBox({ items, theme, slug }) {
  if (!items?.length) return null;
  return (
    <aside className="affiliate-box" aria-label="Prodotti utili">
      <h2>Prodotti utili su questo argomento</h2>
      <div className="affiliate-list">
        {items.map((it) => (
          <Item key={it.key} it={it} theme={theme} slug={slug} />
        ))}
      </div>
      <p className="affiliate-note">
        Link di affiliazione: in qualità di Affiliato Amazon, WikiFarma riceve un guadagno dagli acquisti idonei, senza costi
        aggiuntivi per te. I prodotti non sostituiscono il parere del medico.
      </p>
    </aside>
  );
}
