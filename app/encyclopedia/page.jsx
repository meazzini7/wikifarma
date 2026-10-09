import { redirect } from 'next/navigation';

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

// /encyclopedia e' ora solo un redirect verso la pagina statica per lettera
// (vedi app/encyclopedia/[letter]/page.jsx) - mantiene funzionanti i vecchi
// link con ?let=X senza dover servire una pagina dinamica non in cache.
export default function EncyclopediaRedirect({ searchParams }) {
  const raw = Array.isArray(searchParams?.let) ? searchParams.let[0] : searchParams?.let;
  const letter = (raw || 'A').toUpperCase();
  redirect(`/encyclopedia/${LETTERS.includes(letter) ? letter : 'A'}`);
}
