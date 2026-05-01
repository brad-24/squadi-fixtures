import { NextResponse } from 'next/server';
import type { PlayerStatEntry, StatsData, StatCategory } from '@/types';
import { extractAgeGroup } from '@/lib/utils';
import { COMPETITIONS, SQUADI_BASE, SQUADI_HEADERS } from '@/lib/competitions';

// MiniRoos/U12 don't track individual events
const STATS_COMPETITIONS = COMPETITIONS.filter(
  ([key]) => key !== '1e6ec610-7f27-4d97-bc8e-7908ad58188c',
);

function classifyStat(displayName: string): StatCategory | null {
  const d = displayName.toLowerCase();
  if (d === 'own goal') return null;
  if (d.includes('goal')) return 'goals';
  if (d.includes('assist')) return 'assists';
  if (d.includes('yellow')) return 'yellowCards';
  if (d.includes('red card')) return 'redCards';
  return null;
}

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

interface TeamInfo {
  name: string;
  competitionName: string;
  divisionName: string;
  ageGroup: string;
}

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get('force') === '1';
  const squadiGet = makeSquadiGet(force);

  try {
    const [compResults, divisionResults] = await Promise.all([
      Promise.all(STATS_COMPETITIONS.map(([, id]) => squadiGet(`/competitions/id/${id}`))),
      Promise.all(STATS_COMPETITIONS.map(([key]) => squadiGet(`/division?competitionKey=${key}`))),
    ]);

    const compNameMap = new Map<number, string>(
      STATS_COMPETITIONS.map(([, id], i) => [id, compResults[i]?.name ?? '']),
    );

    const matchFetches = divisionResults.flatMap((divisions: {id:number;name:string}[], ci) => {
      const [, compId] = STATS_COMPETITIONS[ci];
      return divisions.map((div) =>
        squadiGet(`/round/matches?competitionId=${compId}&divisionId=${div.id}&ignoreStatuses=%5B4%5D`)
          .then((data) => ({ data, div, compId }))
          .catch(() => ({ data: { rounds: [] }, div, compId })),
      );
    });

    const roundResults = await Promise.all(matchFetches);

    // Build teamId → info map and collect ended match IDs
    const teamMap = new Map<number, TeamInfo>();
    const seenMatchIds = new Set<number>();
    const endedMatchIds: number[] = [];

    for (const { data, div, compId } of roundResults) {
      const competitionName = compNameMap.get(compId) ?? '';
      const divisionName = div.name;
      const ageGroup = extractAgeGroup(divisionName);

      for (const round of data.rounds ?? []) {
        for (const match of round.matches ?? []) {
          if (match.team1?.id) teamMap.set(match.team1.id, { name: match.team1.name ?? '', competitionName, divisionName, ageGroup });
          if (match.team2?.id) teamMap.set(match.team2.id, { name: match.team2.name ?? '', competitionName, divisionName, ageGroup });

          if (match.matchStatus === 'ENDED' && !seenMatchIds.has(match.id)) {
            seenMatchIds.add(match.id);
            endedMatchIds.push(match.id);
          }
        }
      }
    }

    // Fetch events for every ended match in parallel
    const fetchHeaders = {
      headers: SQUADI_HEADERS,
      ...(force ? { cache: 'no-store' as const } : { next: { revalidate: 300 } }),
    };

    const eventResults = await Promise.all(
      endedMatchIds.map((id) =>
        fetch(`${SQUADI_BASE}/matches/public/events?matchId=${id}`, fetchHeaders)
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
      ),
    );

    // Aggregate stats per player
    type Accum = Map<string, PlayerStatEntry>;
    const accum: Record<StatCategory, Accum> = {
      goals: new Map(),
      assists: new Map(),
      yellowCards: new Map(),
      redCards: new Map(),
    };

    for (const events of eventResults) {
      if (!Array.isArray(events)) continue;
      for (const event of events) {
        if (event.type !== 'stat' || !event.stat || !event.teamId) continue;
        const player = event.players?.[0];
        if (!player?.name) continue;

        const category = classifyStat(event.stat.displayName ?? '');
        if (!category) continue;

        const teamInfo = teamMap.get(event.teamId);
        if (!teamInfo) continue;

        const key = `${player.name}|||${event.teamId}`;
        const existing = accum[category].get(key);
        if (existing) {
          existing.count += 1;
        } else {
          accum[category].set(key, {
            playerName: player.name,
            shirt: player.shirt ?? '',
            teamId: event.teamId,
            teamName: teamInfo.name,
            competitionName: teamInfo.competitionName,
            ageGroup: teamInfo.ageGroup,
            divisionName: teamInfo.divisionName,
            count: 1,
          });
        }
      }
    }

    const sort = (m: Accum): PlayerStatEntry[] =>
      [...m.values()].sort((a, b) => b.count - a.count);

    const stats: StatsData = {
      goals: sort(accum.goals),
      assists: sort(accum.assists),
      yellowCards: sort(accum.yellowCards),
      redCards: sort(accum.redCards),
    };

    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Stats API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
