import { NextResponse } from 'next/server';
import type { Division, Match } from '@/types';
import { extractAgeGroup, extractClub } from '@/lib/utils';
import { COMPETITIONS, SQUADI_BASE, SQUADI_HEADERS } from '@/lib/competitions';

function makeSquadiGet(noCache: boolean) {
  return async function squadiGet(path: string) {
    const res = await fetch(`${SQUADI_BASE}${path}`, {
      headers: SQUADI_HEADERS,
      ...(noCache ? { cache: 'no-store' } : { next: { revalidate: 300 } }),
    });
    if (!res.ok) throw new Error(`Squadi ${path} → ${res.status}`);
    return res.json();
  };
}

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get('force') === '1';
  const squadiGet = makeSquadiGet(force);
  try {
    const [compResults, divisionResults] = await Promise.all([
      Promise.all(COMPETITIONS.map(([, id]) => squadiGet(`/competitions/id/${id}`))),
      Promise.all(COMPETITIONS.map(([key]) => squadiGet(`/division?competitionKey=${key}`))),
    ]);

    const allDivisions: Division[] = divisionResults.flat();
    const divisionMap = new Map<number, Division>(allDivisions.map((d) => [d.id, d]));
    const compNameMap = new Map<number, string>(
      compResults.map((c: { id: number; name: string }) => [c.id, c.name]),
    );

    const matchFetches = divisionResults.flatMap((divisions: Division[], ci) => {
      const [, compId] = COMPETITIONS[ci];
      return divisions.map((div: Division) =>
        squadiGet(
          `/round/matches?competitionId=${compId}&divisionId=${div.id}&ignoreStatuses=%5B4%5D`,
        ).then((data) => ({ data, div, compId })),
      );
    });

    const roundSettled = await Promise.allSettled(matchFetches);
    const roundResults = roundSettled.flatMap((r) => {
      if (r.status === 'fulfilled') return [r.value];
      console.warn('Fixtures: match fetch failed (skipped):', r.reason);
      return [];
    });

    const rawMatches: Match[] = [];
    for (const { data, div, compId } of roundResults) {
      const competitionName = compNameMap.get(compId) ?? '';
      for (const round of data.rounds ?? []) {
        for (const match of round.matches ?? []) {
          const divisionName = divisionMap.get(match.divisionId)?.name ?? div.name;
          rawMatches.push({
            ...match,
            round: { id: round.id, name: round.name, sequence: round.sequence },
            divisionName,
            competitionName,
            ageGroup: extractAgeGroup(divisionName),
            club1: extractClub(match.team1?.name ?? ''),
            club2: extractClub(match.team2?.name ?? ''),
          });
        }
      }
    }

    // Deduplicate by match ID (API may return same match from multiple division queries)
    const seen = new Set<number>();
    const allMatches = rawMatches.filter((m) => !seen.has(m.id) && !!seen.add(m.id));

    allMatches.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    return NextResponse.json(
      { competitions: compResults, divisions: allDivisions, allMatches },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    console.error('Fixtures API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
