import { Resend } from 'resend';
import { ADMIN_EMAIL, SITE_URL } from './constants';

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendNewArticleEmail({ title, slug, category }) {
  if (!isResendConfigured()) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = process.env.ADMIN_NOTIFICATION_EMAIL || ADMIN_EMAIL;

  try {
    await resend.emails.send({
      from: 'WikiFarma Bot <onboarding@resend.dev>',
      to,
      subject: `WikiFarma: nuovo articolo - ${title}`,
      html: `<p>È stato pubblicato un nuovo articolo automaticamente.</p>
        <p><strong>Titolo:</strong> ${title}<br/>
        <strong>Categoria:</strong> ${category}<br/>
        <strong>Link:</strong> <a href="${SITE_URL}/${slug}">${SITE_URL}/${slug}</a></p>
        <p>— WikiFarma Bot</p>`,
    });
  } catch {
    // Non-critical: article was already saved, email is best-effort.
  }
}
