// Dopo che un cron pubblica un nuovo articolo, invalida SOLO le pagine che lo
// mostrano. Questo permette di tenere TTL ISR lunghi (meno rigenerazioni =
// meno Active CPU) senza perdere freschezza: i nuovi contenuti compaiono
// subito, il resto resta in cache.
import { revalidatePath, revalidateTag } from 'next/cache';

export function revalidateAfterPublish(result) {
  try {
    revalidatePath('/');
    revalidatePath('/wellness');
    revalidatePath('/problems');
    revalidatePath('/encyclopedia/[letter]', 'page');
    revalidatePath('/sitemap.xml');
    revalidateTag('related');
    revalidatePath('/tendenza');
    if (result?.slug) revalidatePath(`/${result.slug}`);
  } catch (err) {
    console.error('revalidateAfterPublish:', err);
  }
}
