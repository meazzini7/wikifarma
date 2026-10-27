'use client';

import { trackEvent } from '@/lib/gtag';

// Box "Prodotti utili" (link di affiliazione Amazon). Client component solo per
// tracciare il clic in GA4 (evento affiliate_click), cosi' si vede quali
// articoli portano davvero verso l'acquisto.
export default function AffiliateBox({ items, theme, slug }) {
  if (!items?.length) return null;
  return (
    <aside className="affiliate-box" aria-label="Prodotti utili">
      <h2>Prodotti utili su questo argomento</h2>
      <div className="affiliate-list">
        {items.map((it) => (
          <a
            key={it.key}
            href={it.href}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            className="affiliate-item"
            onClick={() => trackEvent('affiliate_click', { item: it.key, theme, article: slug })}
          >
            <span className="affiliate-icon" aria-hidden="true">{it.icon}</span>
            <span className="affiliate-label">{it.label}</span>
            <span className="affiliate-cta">Vedi su Amazon →</span>
          </a>
        ))}
      </div>
      <p className="affiliate-note">
        Link di affiliazione: in qualità di Affiliato Amazon, WikiFarma riceve un guadagno dagli acquisti idonei, senza costi
        aggiuntivi per te. I prodotti non sostituiscono il parere del medico.
      </p>
    </aside>
  );
}
