// Cover + inline image URL builder for generated articles. Ported from the
// keyword-mapping logic in the old cron_daily*.php scripts: known topics get
// a curated, reliable Unsplash photo; everything else falls back to an
// AI-generated pollinations.ai image with a deterministic seed (stable
// across regenerations of the same title).

const DRUG_MAP = [
  [/aulin|nimesulide|\boki\b/i, 'https://images.unsplash.com/photo-1626968361222-dc3620583191?w=800&q=80'],
  [/paracetamolo|tachipirina/i, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80'],
  [/brufen|ibuprofene|\bmoment\b/i, 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=800&q=80'],
  [/voltaren|lasonil|fastum|\bgel\b/i, 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80'],
  [/sciroppo|gocce|tosse/i, 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=800&q=80'],
];

const WELLNESS_MAP = [
  [/zenzero/i, 'https://images.unsplash.com/photo-1615485290382-441e4d04fcad?w=800&q=80'],
  [/curcuma/i, 'https://images.unsplash.com/photo-1615485500704-8e99099928b3?w=800&q=80'],
  [/limone/i, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=800&q=80'],
  [/miele/i, 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&q=80'],
  [/aglio/i, 'https://images.unsplash.com/photo-1615477021379-38708c02c086?w=800&q=80'],
  [/\bnoci\b/i, 'https://images.unsplash.com/photo-1552014763-952402434524?w=800&q=80'],
  [/mirtill/i, 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=800&q=80'],
  [/cioccolato/i, 'https://images.unsplash.com/photo-1511381971705-4bfe24d86922?w=800&q=80'],
  [/avocado/i, 'https://images.unsplash.com/photo-1523049673856-38240640c525?w=800&q=80'],
  [/\bt[eè]\b|tisan/i, 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?w=800&q=80'],
  [/caff[eè]/i, 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&q=80'],
  [/banan/i, 'https://images.unsplash.com/photo-1571771896612-418b9503a341?w=800&q=80'],
  [/dieta|cibi|colesterolo|verdure|alimentazione/i, 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80'],
  [/dormire|sonno|insonnia/i, 'https://images.unsplash.com/photo-1520206183501-b80df61043c2?w=800&q=80'],
  [/stress|ansia|meditazione/i, 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80'],
  [/camminata|correre|sport|fitness|allenamento/i, 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&q=80'],
  [/pelle|viso|rughe/i, 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800&q=80'],
  [/capelli/i, 'https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&q=80'],
  [/dent[ei]|sorriso/i, 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&q=80'],
  [/schiena|postura/i, 'https://images.unsplash.com/photo-1544367563-12123d8965cd?w=800&q=80'],
  [/acqua|\bbere\b/i, 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80'],
];

const PROBLEMS_MAP = [
  [/dent|impianto|bocca|sbiancamento/i, 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=800&q=80'],
  [/capelli|calvizie|trapianto/i, 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&q=80'],
  [/pelle|acne|macchie|rughe|\bnei\b|dermatite|psoriasi/i, 'https://images.unsplash.com/photo-1556760544-74068565f05c?w=800&q=80'],
  [/schiena|cervicale|dolore|sciatalgia|ernia|menisco/i, 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80'],
  [/occhio|vista|laser|cataratta|glaucoma/i, 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80'],
  [/stomaco|reflusso|gastrite|colon|intestin/i, 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&q=80'],
  [/ansia|depressione|panico|burnout/i, 'https://images.unsplash.com/photo-1527137342181-19aab11a8ee8?w=800&q=80'],
  [/cuore|pressione|colesterolo|ipertensione/i, 'https://images.unsplash.com/photo-1628348068343-c6a848d2b6dd?w=800&q=80'],
  [/naso|sinusite|otite/i, 'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=800&q=80'],
];

const DRUG_FALLBACK = 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80';
const WELLNESS_FALLBACK = 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80';
const PROBLEMS_FALLBACK = 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=800&q=80';

function seedFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % 9999;
}

function pollinationsUrl(promptText, seed) {
  const encoded = encodeURIComponent(`${promptText}, photorealistic, 4k, bright lighting`);
  return `https://image.pollinations.ai/prompt/${encoded}?width=800&height=500&nologo=true&seed=${seed}`;
}

function pickFromMap(map, title) {
  const found = map.find(([re]) => re.test(title));
  return found ? found[1] : null;
}

export function buildArticleImages(title, category) {
  const seed = seedFromString(title);
  let cover;
  let inlinePrompt;

  if (category === 'Farmaco') {
    cover = pickFromMap(DRUG_MAP, title) || pollinationsUrl(`${title} medicine box packaging white background studio product photography`, seed) || DRUG_FALLBACK;
    inlinePrompt = `${title} medicine pack close up detail`;
  } else if (category === 'Problemi Frequenti') {
    cover = pickFromMap(PROBLEMS_MAP, title) || pollinationsUrl(`${title} medical clinic doctor consultation`, seed) || PROBLEMS_FALLBACK;
    inlinePrompt = `${title} medical consultation healthcare closeup`;
  } else {
    cover = pickFromMap(WELLNESS_MAP, title) || pollinationsUrl(`${title} wellness healthy lifestyle nature`, seed) || WELLNESS_FALLBACK;
    inlinePrompt = `${title} healthy lifestyle wellness closeup`;
  }

  const inline = pollinationsUrl(inlinePrompt, seed + 1);
  return { cover, inline };
}
