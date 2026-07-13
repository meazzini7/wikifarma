'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function highlightMatch(title, query) {
  const idx = title.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return title;
  return (
    <>
      {title.slice(0, idx)}
      <mark>{title.slice(idx, idx + query.length)}</mark>
      {title.slice(idx + query.length)}
    </>
  );
}

export default function LiveSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setResults(data);
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        // ignore aborted/failed requests
      } finally {
        setLoading(false);
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

  function goTo(slug) {
    setOpen(false);
    router.push(`/${slug}`);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[activeIndex >= 0 ? activeIndex : 0];
      if (target) goTo(target.slug);
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
      {q && (
        <button
          type="button"
          className="search-clear"
          aria-label="Cancella ricerca"
          onClick={() => {
            setQ('');
            setResults([]);
            setOpen(false);
          }}
        >
          ✕
        </button>
      )}
      {open && (
        <div className="suggestions-box" style={{ display: 'block' }}>
          {loading ? (
            <div className="suggestion-item" style={{ color: '#999', cursor: 'default' }}>
              Ricerca in corso...
            </div>
          ) : results.length > 0 ? (
            results.map((r, i) => (
              <div
                key={r.slug}
                className={`suggestion-item${i === activeIndex ? ' active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => goTo(r.slug)}
              >
                {r.category === 'Farmaco' ? '💊 ' : '📄 '}
                {highlightMatch(r.title, q.trim())}
              </div>
            ))
          ) : (
            <div className="suggestion-item" style={{ color: '#999', cursor: 'default' }}>
              Nessun risultato per &quot;{q.trim()}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
