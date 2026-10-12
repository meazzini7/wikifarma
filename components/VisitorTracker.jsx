'use client';

import { useEffect } from 'react';

export default function VisitorTracker() {
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;
    fetch('/api/track-visit', { method: 'POST' }).catch(() => {});
  }, []);

  return null;
}
