import { NextResponse } from 'next/server';
import { SQUADI_BASE, SQUADI_HEADERS } from '@/lib/competitions';

export async function GET(request: Request) {
  const matchId = new URL(request.url).searchParams.get('matchId');
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });

  try {
    const res = await fetch(
      `${SQUADI_BASE}/matches/public/matchEvents?matchId=${matchId}`,
      { headers: SQUADI_HEADERS, next: { revalidate: 300 } },
    );
    if (!res.ok) return NextResponse.json([], { status: 200 });
    const data = await res.json();

    const GOAL_TYPES = new Set(['G', 'PG', 'OG']);
    const events = (Array.isArray(data) ? data : []).filter((e: { eventCategory: string; type: string }) =>
      e.eventCategory === 'stat' &&
      (GOAL_TYPES.has(e.type) || e.type.startsWith('Y') || e.type.startsWith('R')),
    );

    return NextResponse.json(events, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
