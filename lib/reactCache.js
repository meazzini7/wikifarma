// cache() di React esiste solo nel build "server component" di React (dentro
// Next.js). Fuori da Next (runner dei cron su GitHub Actions) React non lo
// espone: in quel caso la funzione resta com'e', senza memoizzazione per richiesta.
import * as React from 'react';

export const cache = typeof React.cache === 'function' ? React.cache : (fn) => fn;
