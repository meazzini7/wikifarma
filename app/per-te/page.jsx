'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth, googleProvider } from '@/lib/firebase';
import { getUserFavorites, getUserReadingHistory } from '@/lib/favorites';
import { getRecommendedPosts } from '@/lib/firestore';
import SafeImage from '@/components/SafeImage';

export default function ForYouPage() {
  const [user, setUser] = useState(undefined);
  const [posts, setPosts] = useState(null);

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), setUser), []);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const [favorites, history] = await Promise.all([
        getUserFavorites(user.email),
        getUserReadingHistory(user.email),
      ]);

      const weight = {};
      favorites.forEach((f) => {
        if (f.category) weight[f.category] = (weight[f.category] || 0) + 3;
      });
      history.forEach((h) => {
        if (h.category) weight[h.category] = (weight[h.category] || 0) + (h.viewCount || 1);
      });

      const topCategories = Object.entries(weight)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category]) => category);

      const excludeSlugs = new Set(favorites.map((f) => f.slug));
      const recs = await getRecommendedPosts(topCategories, excludeSlugs);
      setPosts(recs);
    })();
  }, [user]);

  const handleLogin = () => {
    signInWithPopup(getFirebaseAuth(), googleProvider).catch((err) => alert(err.message));
  };

  if (user === undefined) return null;

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <h2>Contenuti Per Te 🎯</h2>
        <p style={{ marginBottom: 20, color: '#666' }}>
          Accedi per ricevere consigli personalizzati in base ai tuoi interessi.
        </p>
        <span onClick={handleLogin} className="btn-login" style={{ cursor: 'pointer' }}>
          Accedi con Google
        </span>
      </div>
    );
  }

  return (
    <div className="section-home">
      <div className="section-head">
        <h2>Per Te 🎯</h2>
        <p style={{ color: '#666' }}>Una selezione basata sui tuoi preferiti e sulle tue letture.</p>
      </div>
      {posts === null ? (
        <p style={{ textAlign: 'center' }}>Caricamento...</p>
      ) : posts.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666' }}>
          Metti &quot;mi piace&quot; a qualche articolo per iniziare a ricevere consigli personalizzati.
        </p>
      ) : (
        <div className="news-grid">
          {posts.map((post) => (
            <Link key={post.id} href={`/${post.slug}`} className="card">
              <SafeImage src={post.image_url} category={post.category} alt={post.title} className="card-img" />
              <div className="card-body">
                <div className="card-tag">{post.category}</div>
                <h3>{post.title}</h3>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
