import Link from 'next/link';

const LABELS = {
  Farmaco: 'Medicinali A-Z',
  Benessere: 'Benessere',
  'Problemi Frequenti': 'Problemi Frequenti',
  Salute: 'Benessere',
};

// Pagina elenco a cui appartiene l'articolo (i farmaci stanno nella pagina
// della lettera iniziale; gli articoli "Salute" nell'elenco Benessere).
export function categoryHref(category, title = '') {
  if (category === 'Farmaco') {
    const letter = String(title).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().charAt(0).toUpperCase();
    return `/encyclopedia/${/[A-Z]/.test(letter) ? letter : 'A'}`;
  }
  if (category === 'Problemi Frequenti') return '/problems';
  return '/wellness';
}

export function categoryLabel(category) {
  return LABELS[category] || 'Benessere';
}

export default function Breadcrumb({ category, title }) {
  return (
    <nav className="breadcrumb" aria-label="Percorso">
      <Link href="/">Home</Link>
      <span aria-hidden="true">›</span>
      <Link href={categoryHref(category, title)}>{categoryLabel(category)}</Link>
    </nav>
  );
}
