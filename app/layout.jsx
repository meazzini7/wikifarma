import { Suspense } from 'react';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import VisitorTracker from '@/components/VisitorTracker';
import GAListener from '@/components/GAListener';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { SITE_URL } from '@/lib/constants';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'WikiFarma - Salute e Benessere',
  description:
    'Portale medico con AI. Enciclopedia farmaci, diagnosi virtuale e guide benessere.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>
        <GoogleAnalytics />
        <Suspense fallback={null}>
          <GAListener />
        </Suspense>
        <VisitorTracker />
        <div className="page-wrapper">
          <Navbar />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
