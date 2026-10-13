'use client';

import { useEffect, useRef } from 'react';

// Sottile barra in alto che mostra a che punto si e' dell'articolo: da' un
// senso di avanzamento e spinge a finire. Aggiorna lo stile direttamente (senza
// stato React) e solo su requestAnimationFrame, quindi non pesa sullo scroll.
export default function ReadingProgress() {
  const bar = useRef(null);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const el = document.documentElement;
      const max = el.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${ratio})`;
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return <div ref={bar} className="reading-progress" aria-hidden="true" />;
}
