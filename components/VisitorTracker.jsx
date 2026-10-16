'use client';

import { useEffect } from 'react';

const BOT_RE = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;
const KEY = 'wf_visit_day';

// Un solo POST al giorno per browser (il contatore e' comunque "visitatori
// unici al giorno", dedup lato server per hash IP): prima partiva una
// funzione serverless + scrittura Firestore ad OGNI caricamento di pagina.
// Bot e browser automatizzati vengono saltati lato client.
export default function VisitorTracker() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;
    if (navigator.webdriver || BOT_RE.test(navigator.userAgent || '')) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(KEY) === today) return;
    } catch {
      // storage non disponibile: si invia comunque (il server deduplica).
    }
    fetch('/api/track-visit', { method: 'POST', keepalive: true })
      .then((res) => {
        if (!res.ok) return;
        try {
          localStorage.setItem(KEY, today);
        } catch {}
      })
      .catch(() => {});
  }, []);

  return null;
}
