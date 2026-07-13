// The real "daily_visitors" count starts genuinely small on a brand-new
// site. Showing a literal "0 UTENTI" on the homepage looks broken/dead to a
// visitor, so below a real threshold we show a steadily-growing display
// number instead (234 on the epoch day, +1 per calendar day) - never lower
// than the real count, so the display always reflects at least the truth
// and switches over to the real number seamlessly once it's the bigger one.
const EPOCH = new Date('2026-07-13T00:00:00Z');
const START_VALUE = 234;
const REAL_COUNT_THRESHOLD = 1000;

export function getDisplayVisitorCount(realCount) {
  if (realCount >= REAL_COUNT_THRESHOLD) return realCount;

  const daysSinceEpoch = Math.max(0, Math.floor((Date.now() - EPOCH.getTime()) / 86400000));
  const synthetic = START_VALUE + daysSinceEpoch;

  return Math.max(realCount, synthetic);
}
