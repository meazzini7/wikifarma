import { SITE_URL } from '@/lib/constants';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api/', '/profile', '/per-te'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
