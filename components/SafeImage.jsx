import { coverDataUri } from '@/lib/cover';

// Copertina dell'articolo: sempre quella generata dal titolo (lib/cover.js).
// Ogni articolo ne ha una diversa e non dipende da file esterni, quindi non
// esistono ne' immagini rotte ne' articoli senza immagine. `src` e' ignorato
// di proposito: gli URL salvati sui vecchi articoli (foto di stock ripetute,
// immagini AI) non vanno piu' mostrati.
export default function SafeImage({ category, alt, className, style, loading = 'lazy' }) {
  return <img src={coverDataUri(alt, category)} alt={alt} className={className} style={style} loading={loading} />;
}
