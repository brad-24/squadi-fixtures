import { NextResponse } from 'next/server';
import type { Division, Match } from '@/types';
import { extractAgeGroup, extractClub } from '@/lib/utils';
import { COMPETITIONS, SQUADI_BASE, SQUADI_HEADERS } from '@/lib/competitions';

async function squadiGet(path: string) {
  const res = await fetch(`${SQUADI_BASE}${path}`, {
    headers: SQUADI_HEADERS,
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Squadi ${path} → ${res.status}`);
  return res.json();
}

export async function GET() {
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

    const roundResults = await Promise.all(matchFetches);

    const allMatches: Match[] = [];
    for (const { data, div, compId } of roundResults) {
      const ageGroup = extractAgeGroup(div.name);
      const competitionName = compNameMap.get(compId) ?? '';
      for (const round of data.rounds ?? []) {
        for (const match of round.matches ?? []) {
          allMatches.push({
            ...match,
            round: { id: round.id, name: round.name, sequence: round.sequence },
            divisionName: divisionMap.get(match.divisionId)?.name ?? div.name,
            competitionName,
            ageGroup,
            club1: extractClub(match.team1?.name ?? ''),
            club2: extractClub(match.team2?.name ?? ''),
          });
        }
      }
    }

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
