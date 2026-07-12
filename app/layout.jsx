import Script from 'next/script';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { GA_ID, SITE_URL } from '@/lib/constants';

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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
        <div className="page-wrapper">
          <Navbar />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
