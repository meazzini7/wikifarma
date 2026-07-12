'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LiveSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } catch {
        // ignore aborted/failed requests
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, []);

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) router.push(`/${results[0].slug}`);
    }
  }

  return (
    <div className="search-wrapper" ref={wrapRef}>
      <input
        type="text"
        className="search-input"
        placeholder="Cerca farmaco, sintomo o principio attivo..."
        autoComplete="off"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && (
        <div className="suggestions-box" style={{ display: 'block' }}>
          {results.length > 0 ? (
            results.map((r) => (
              <div key={r.slug} className="suggestion-item" onClick={() => router.push(`/${r.slug}`)}>
                {r.category === 'Farmaco' ? '💊 ' : '📄 '}
                {r.title}
              </div>
            ))
          ) : (
            <div className="suggestion-item" style={{ color: '#999', cursor: 'default' }}>
              Nessun risultato
            </div>
          )}
        </div>
      )}
    </div>
  );
}
