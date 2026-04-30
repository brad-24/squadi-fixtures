import { NextResponse } from 'next/server';
import type { Division, Match } from '@/types';
import { extractAgeGroup, extractClub } from '@/lib/utils';

const SQUADI_BASE = 'https://api.squadi.com/livescores';
const ORIGIN = 'https://registration.squadi.com';

const HEADERS = {
  Origin: ORIGIN,
  Referer: `${ORIGIN}/`,
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

// All Darling Downs competitions: [uniqueKey, integer id]
const COMPETITIONS: [string, number][] = [
  ['1e6ec610-7f27-4d97-bc8e-7908ad58188c', 1387], // MiniRoos & Under 12
  ['916e5242-4969-4502-bfbc-ab8568341156', 1299], // Community Juniors
  ['94bcdbcb-36a1-4cd4-bdc3-a260f1c1ed58', 1331], // Community Seniors
  ['820aef84-2603-43b7-bece-dbe5894d331f', 1281], // FQPL 3 Men
  ['2c424449-2684-4297-af3e-02b0e7f208a2', 1284], // FQPL 3 Women
];

async function squadiGet(path: string) {
  const res = await fetch(`${SQUADI_BASE}${path}`, {
    headers: HEADERS,
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Squadi ${path} → ${res.status}`);
  return res.json();
}

export async function GET() {
  try {
    // Fetch all competition infos and their divisions in parallel
    const [compResults, divisionResults] = await Promise.all([
      Promise.all(COMPETITIONS.map(([, id]) => squadiGet(`/competitions/id/${id}`))),
      Promise.all(COMPETITIONS.map(([key]) => squadiGet(`/division?competitionKey=${key}`))),
    ]);

    const competitions = compResults;

    // Flatten divisions, keyed by division id
    const allDivisions: Division[] = divisionResults.flat();
    const divisionMap = new Map<number, Division>(allDivisions.map((d) => [d.id, d]));

    // Map competitionId → competition name
    const compNameMap = new Map<number, string>(
      competitions.map((c: { id: number; name: string }) => [c.id, c.name]),
    );

    // Fetch matches for all divisions across all competitions in parallel
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
          const club1 = extractClub(match.team1?.name ?? '');
          const club2 = extractClub(match.team2?.name ?? '');
          const enriched: Match = {
            ...match,
            round: { id: round.id, name: round.name, sequence: round.sequence },
            divisionName: divisionMap.get(match.divisionId)?.name ?? div.name,
            competitionName,
            ageGroup,
            club1,
            club2,
          };
          allMatches.push(enriched);
        }
      }
    }

    // Sort by startTime ascending
    allMatches.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );

    return NextResponse.json(
      { competitions, divisions: allDivisions, allMatches },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    );
  } catch (err) {
    console.error('Fixtures API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
