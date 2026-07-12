'use client';

import { useEffect } from 'react';

export default function VisitorTracker() {
  useEffect(() => {
    fetch('/api/track-visit', { method: 'POST' }).catch(() => {});
  }, []);

  return null;
}
