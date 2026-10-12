'use client';

import { useEffect } from 'react';
import { trackArticleEvent } from '@/lib/stats';

const ENGAGED_AFTER_MS = 30000;
const DEEP_SCROLL_RATIO = 0.75;

// Misura tre segnali per articolo: apertura, lettura attiva (30s con la
// scheda visibile) e scroll fino al 75% della pagina. Sono i segnali che
// contano per la resa pubblicitaria: tempo di permanenza e scorrimento.
export default function ArticleTracker({ postId, intl = false }) {
  useEffect(() => {
    trackArticleEvent(postId, intl ? ['views', 'views_intl'] : ['views']);

    let activeMs = 0;
    let engagedSent = false;
    let deepSent = false;

    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      activeMs += 1000;
      if (!engagedSent && activeMs >= ENGAGED_AFTER_MS) {
        engagedSent = true;
        trackArticleEvent(postId, ['engaged']);
      }
    }, 1000);

    function onScroll() {
      if (deepSent) return;
      const el = document.documentElement;
      const ratio = (window.scrollY + window.innerHeight) / el.scrollHeight;
      if (ratio >= DEEP_SCROLL_RATIO) {
        deepSent = true;
        trackArticleEvent(postId, ['deep']);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      clearInterval(timer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [postId, intl]);

  return null;
}
