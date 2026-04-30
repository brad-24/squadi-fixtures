import { NextResponse } from 'next/server';
import type { Division, Match } from '@/types';
import { extractAgeGroup, extractClub } from '@/lib/utils';

const SQUADI_BASE = 'https://api.squadi.com/livescores';
const ORIGIN = 'https://registration.squadi.com';

const COMPETITION_UNIQUE_KEY = '916e5242-4969-4502-bfbc-ab8568341156';
const COMPETITION_ID = 1299;

const HEADERS = {
  Origin: ORIGIN,
  Referer: `${ORIGIN}/`,
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

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
    const [competition, divisions] = await Promise.all([
      squadiGet(`/competitions/id/${COMPETITION_ID}`),
      squadiGet(`/division?competitionKey=${COMPETITION_UNIQUE_KEY}`),
    ]);

    // Fetch all divisions in parallel (15 divisions = 15 requests)
    const roundResults = await Promise.all(
      (divisions as Division[]).map((div) =>
        squadiGet(
          `/round/matches?competitionId=${COMPETITION_ID}&divisionId=${div.id}&ignoreStatuses=%5B4%5D`,
        ),
      ),
    );

    const divisionMap = new Map<number, Division>(
      (divisions as Division[]).map((d) => [d.id, d]),
    );

    const allMatches: Match[] = [];
    for (let i = 0; i < roundResults.length; i++) {
      const div = divisions[i] as Division;
      const ageGroup = extractAgeGroup(div.name);
      for (const round of roundResults[i].rounds ?? []) {
        for (const match of round.matches ?? []) {
          const club1 = extractClub(match.team1?.name ?? '');
          const club2 = extractClub(match.team2?.name ?? '');
          const enriched: Match = {
            ...match,
            round: {
              id: round.id,
              name: round.name,
              sequence: round.sequence,
            },
            divisionName: divisionMap.get(match.divisionId)?.name ?? div.name,
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
      { competition, divisions, allMatches },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (err) {
    console.error('Fixtures API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

