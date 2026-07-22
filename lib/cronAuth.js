// Vercel's own Cron Jobs require a Pro plan, so these routes are instead
// triggered daily by an external scheduler (cron-job.org) configured to send
// `Authorization: Bearer $CRON_SECRET`. This rejects any other caller
// (including someone guessing the URL).
export function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}
