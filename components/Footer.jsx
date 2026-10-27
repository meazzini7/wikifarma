import Link from 'next/link';

export default function Footer() {
  return (
    <footer>
      <div style={{ marginBottom: 15 }}>WikiFarma © {new Date().getFullYear()} - Portale Medico e Benessere</div>
      <div style={{ marginBottom: 15, fontSize: '0.8rem', opacity: 0.8 }}>
        In qualità di Affiliato Amazon, WikiFarma riceve un guadagno dagli acquisti idonei.
      </div>
      <div>
        <Link href="/privacy">Privacy Policy</Link> | <Link href="/contact">Contatti</Link>
      </div>
    </footer>
  );
}
