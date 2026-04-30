import { NextResponse } from 'next/server';
import type { Division, LadderEntry, LadderDivision } from '@/types';
import { extractAgeGroup } from '@/lib/utils';
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

    const compNameMap = new Map<number, string>(
      compResults.map((c: { id: number; name: string }) => [c.id, c.name]),
    );

    // Fetch ladder for each division in parallel
    const ladderFetches = divisionResults.flatMap((divisions: Division[], ci) => {
      const [compKey, compId] = COMPETITIONS[ci];
      return divisions.map((div: Division) =>
        squadiGet(
          `/teams/ladder/v2?divisionIds=${div.id}&competitionKey=${compKey}&filteredOutCompStatuses=4&showForm=1`,
        ).then((data) => ({ data, div, compId })),
      );
    });

    const ladderResults = await Promise.all(ladderFetches);

    const laddersByDivision: LadderDivision[] = [];
    for (const { data, div, compId } of ladderResults) {
      const entries: LadderEntry[] = (data.ladders ?? [])
        .filter((e: { isHidden: string }) => e.isHidden !== '1')
        .sort((a: { rk: string }, b: { rk: string }) => Number(a.rk) - Number(b.rk))
        .map((e: LadderEntry) => ({
          id: e.id,
          name: e.name,
          alias: e.alias,
          logoUrl: e.logoUrl,
          rk: e.rk,
          P: e.P,
          W: e.W,
          D: e.D,
          L: e.L,
          F: e.F,
          A: e.A,
          PTS: e.PTS,
          goalDifference: e.goalDifference,
        }));

      if (entries.length === 0) continue;

      laddersByDivision.push({
        divisionId: div.id,
        divisionName: div.name,
        competitionId: compId,
        competitionName: compNameMap.get(compId) ?? '',
        ageGroup: extractAgeGroup(div.name),
        entries,
      });
    }

    return NextResponse.json(
      { laddersByDivision },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    console.error('Ladder API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
