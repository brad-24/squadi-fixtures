import { NextResponse } from 'next/server';
import type { PlayerStatEntry, StatsData, StatCategory } from '@/types';
import { extractAgeGroup } from '@/lib/utils';
import { COMPETITIONS, SQUADI_BASE, SQUADI_HEADERS } from '@/lib/competitions';

// MiniRoos/U12 don't track individual events
const STATS_COMPETITIONS = COMPETITIONS.filter(
  ([key]) => key !== '1e6ec610-7f27-4d97-bc8e-7908ad58188c',
);

const STAT_TYPES: Record<StatCategory, string> = {
  goals: 'G,PG',
  assists: 'A',
  yellowCards: 'Y1,Y2,Y3,Y4,Y5,Y6,Y7,Y8,YC,YD',
  redCards: 'R1,R2,R3,R4,R5,R6,R7,R8,RC',
};

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
    const compResults = await Promise.all(
      STATS_COMPETITIONS.map(([, id]) => squadiGet(`/competitions/id/${id}`)),
    );

    const compNameMap = new Map<number, string>(
      STATS_COMPETITIONS.map(([, id], i) => [id, compResults[i]?.name ?? '']),
    );

    const yearRefId = compResults[0]?.yearRefId ?? 8;

    const fetches = STATS_COMPETITIONS.flatMap(([compKey, compId]) =>
      (Object.entries(STAT_TYPES) as [StatCategory, string][]).map(([category, statType]) =>
        squadiGet(
          `/stats/public/scoringStatsByGrade?statType=${encodeURIComponent(statType)}&competitionUniqueKey=${compKey}&yearRefId=${yearRefId}&divisionId=All&offset=0&limit=-1`,
        )
          .then((data) => ({ data, compId, category }))
          .catch(() => ({ data: { result: [] }, compId, category })),
      ),
    );

    const allResults = await Promise.all(fetches);

    const accum: Record<StatCategory, PlayerStatEntry[]> = {
      goals: [],
      assists: [],
      yellowCards: [],
      redCards: [],
    };

    for (const { data, compId, category } of allResults) {
      const competitionName = compNameMap.get(compId) ?? '';
      for (const item of data.result ?? []) {
        const playerName = `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
        if (!playerName) continue;

        const count = parseInt(item.PTS ?? '0', 10);
        if (!count) continue;

        accum[category].push({
          playerName,
          shirt: item.shirt ?? '',
          teamId: item.playerId ?? 0,
          teamName: item.teamName ?? '',
          competitionName,
          ageGroup: extractAgeGroup(item.divisionName ?? ''),
          divisionName: item.divisionName ?? '',
          count,
          occurrences: [],
        });
      }
    }

    const stats: StatsData = {
      goals: accum.goals.sort((a, b) => b.count - a.count),
      assists: accum.assists.sort((a, b) => b.count - a.count),
      yellowCards: accum.yellowCards.sort((a, b) => b.count - a.count),
      redCards: accum.redCards.sort((a, b) => b.count - a.count),
    };

    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Stats API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
