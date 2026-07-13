'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth, googleProvider } from '@/lib/firebase';
import { addFavorite, isFavorited, removeFavorite } from '@/lib/favorites';

export default function FavoriteButton({ post }) {
  const [user, setUser] = useState(undefined);
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => onAuthStateChanged(getFirebaseAuth(), setUser), []);

  useEffect(() => {
    if (user) {
      isFavorited(user.email, post.id).then(setFav);
    } else {
      setFav(false);
    }
  }, [user, post.id]);

  async function handleClick() {
    if (!user) {
      signInWithPopup(getFirebaseAuth(), googleProvider).catch((err) => alert(err.message));
      return;
    }
    setLoading(true);
    try {
      if (fav) {
        await removeFavorite(user.email, post.id);
        setFav(false);
      } else {
        await addFavorite(user.email, post);
        setFav(true);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className="favorite-btn" onClick={handleClick} disabled={loading} aria-pressed={fav}>
      {fav ? '❤️ Nei preferiti' : '🤍 Aggiungi ai preferiti'}
    </button>
  );
}
