import { NextResponse } from 'next/server';
import { searchPosts } from '@/lib/firestore';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  if (q.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchPosts(q);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
