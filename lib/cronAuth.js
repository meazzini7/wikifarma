// Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when it
// invokes a scheduled Cron Job, if the CRON_SECRET env var is set on the
// project. This rejects any other caller (including someone guessing the URL).
export function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
