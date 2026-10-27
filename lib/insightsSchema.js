// Versione dello snapshot analytics/insights. Vive in un file a parte perche'
// serve sia a lib/insights.js sia a lib/related.js, e quest'ultimo viene
// incluso nelle pagine pubbliche: non deve trascinarsi dietro il client GA4.
export const SCHEMA_VERSION = 5;
