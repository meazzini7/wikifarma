'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { GA_ID } from '@/lib/constants';

export default function GAListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    const query = searchParams?.toString();
    const page_path = query ? `${pathname}?${query}` : pathname;
    window.gtag('config', GA_ID, { page_path });
  }, [pathname, searchParams]);

  return null;
}
