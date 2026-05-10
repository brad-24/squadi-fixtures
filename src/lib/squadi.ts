import type {
  Division, Match, FixtureData,
  LadderDivision, LadderData, LadderEntry,
  StatsData, StatCategory, PlayerStatEntry,
  Appointment,
} from '@/types';
import { extractAgeGroup, extractClub } from '@/lib/utils';
import { COMPETITIONS, SQUADI_BASE } from '@/lib/competitions';

// Browser fetch — Origin header is set automatically by the browser (cross-origin).
// Squadi reflects any Origin back as Access-Control-Allow-Origin, so CORS works.
async function get(path: string): Promise<any> {
  const res = await fetch(`${SQUADI_BASE}${path}`);
  if (!res.ok) throw new Error(`Squadi ${path} → ${res.status}`);
  return res.json();
}

export async function loadFixtures(): Promise<FixtureData> {
  const [compResults, divisionResults] = await Promise.all([
    Promise.all(COMPETITIONS.map(([, id]) => get(`/competitions/id/${id}`))),
    Promise.all(COMPETITIONS.map(([key]) => get(`/division?competitionKey=${key}`))),
  ]);

  const allDivisions: Division[] = divisionResults.flat();
  const divisionMap = new Map<number, Division>(allDivisions.map((d) => [d.id, d]));
  const compNameMap = new Map<number, string>(
    compResults.map((c: { id: number; name: string }) => [c.id, c.name]),
  );

  const matchPromises = divisionResults.flatMap((divisions: Division[], ci) => {
    const [, compId] = COMPETITIONS[ci];
    return divisions.map((div: Division) =>
      get(`/round/matches?competitionId=${compId}&divisionId=${div.id}&ignoreStatuses=%5B4%5D`)
        .then((data: any) => ({ data, div, compId })),
    );
  });

  const settled = await Promise.allSettled(matchPromises);
  const roundResults = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (roundResults.length === 0 && matchPromises.length > 0) {
    throw (settled.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason;
  }

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

  const seen = new Set<number>();
  const allMatches = rawMatches.filter((m) => !seen.has(m.id) && !!seen.add(m.id));
  allMatches.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return { competitions: compResults, divisions: allDivisions, allMatches };
}

export async function loadLadder(): Promise<LadderData> {
  const [compResults, divisionResults] = await Promise.all([
    Promise.all(COMPETITIONS.map(([, id]) => get(`/competitions/id/${id}`))),
    Promise.all(COMPETITIONS.map(([key]) => get(`/division?competitionKey=${key}`))),
  ]);

  const compNameMap = new Map<number, string>(
    compResults.map((c: { id: number; name: string }) => [c.id, c.name]),
  );

  const ladderPromises = divisionResults.flatMap((divisions: Division[], ci) => {
    const [compKey, compId] = COMPETITIONS[ci];
    return divisions.map((div: Division) =>
      get(`/teams/ladder/v2?divisionIds=${div.id}&competitionKey=${compKey}&filteredOutCompStatuses=4&showForm=1`)
        .then((data: any) => ({ data, div, compId })),
    );
  });

  const ladderResults = await Promise.all(ladderPromises);
  const laddersByDivision: LadderDivision[] = [];

  for (const { data, div, compId } of ladderResults) {
    const entries: LadderEntry[] = (data.ladders ?? [])
      .filter((e: { isHidden: string }) => e.isHidden !== '1')
      .sort((a: { rk: string }, b: { rk: string }) => Number(a.rk) - Number(b.rk))
      .map((e: LadderEntry & { PTS: string; W: string; D: string }) => {
        const pts = parseInt(e.PTS, 10);
        const w = parseInt(e.W, 10);
        const d = parseInt(e.D, 10);
        const forfeitWins = Math.max(0, Math.floor((pts - w * 3 - d) / 3));
        return {
          id: e.id, name: e.name, alias: e.alias, logoUrl: e.logoUrl, rk: e.rk,
          P: e.P, W: forfeitWins > 0 ? String(w + forfeitWins) : e.W,
          D: e.D, L: e.L, F: e.F, A: e.A, PTS: e.PTS, goalDifference: e.goalDifference,
        };
      });

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

  return { laddersByDivision };
}

const STATS_COMPETITIONS = COMPETITIONS.filter(
  ([key]) => key !== '1e6ec610-7f27-4d97-bc8e-7908ad58188c',
);

const STAT_TYPES: Record<StatCategory, string> = {
  goals: 'G,PG',
  assists: 'A',
  yellowCards: 'Y1,Y2,Y3,Y4,Y5,Y6,Y7,Y8,YC,YD',
  redCards: 'R1,R2,R3,R4,R5,R6,R7,R8,RC',
};

export async function loadStats(): Promise<StatsData> {
  const [compResults, divisionResults] = await Promise.all([
    Promise.all(STATS_COMPETITIONS.map(([, id]) => get(`/competitions/id/${id}`))),
    Promise.all(STATS_COMPETITIONS.map(([key]) => get(`/division?competitionKey=${key}`))),
  ]);

  const compNameMap = new Map<number, string>(
    STATS_COMPETITIONS.map(([, id], i) => [id, compResults[i]?.name ?? '']),
  );

  const yearRefId = compResults[0]?.yearRefId ?? 8;

  const fetches = STATS_COMPETITIONS.flatMap(([, compId], ci) => {
    const divisions: Division[] = divisionResults[ci] ?? [];
    return (Object.entries(STAT_TYPES) as [StatCategory, string][]).flatMap(([category, statType]) =>
      divisions.map((div) =>
        get(`/stats/public/scoringStatsByGrade?statType=${encodeURIComponent(statType)}&competitionId=${compId}&yearRefId=${yearRefId}&divisionId=${div.id}&offset=0&limit=-1`)
          .then((data: any) => ({ data, compId, category }))
          .catch(() => ({ data: { result: [] }, compId, category })),
      ),
    );
  });

  const allResults = await Promise.all(fetches);
  const accum: Record<StatCategory, PlayerStatEntry[]> = {
    goals: [], assists: [], yellowCards: [], redCards: [],
  };

  for (const { data, compId, category } of allResults) {
    const competitionName = compNameMap.get(compId) ?? '';
    for (const item of data.result ?? []) {
      const playerName = `${item.firstName ?? ''} ${item.lastName ?? ''}`.trim();
      if (!playerName) continue;
      const count = parseInt(item.PTS ?? '0', 10);
      if (!count) continue;
      accum[category as StatCategory].push({
        playerName, shirt: item.shirt ?? '', teamId: item.playerId ?? 0,
        teamName: item.teamName ?? '', competitionName,
        ageGroup: extractAgeGroup(item.divisionName ?? ''),
        divisionName: item.divisionName ?? '', count,
      });
    }
  }

  return {
    goals: accum.goals.sort((a, b) => b.count - a.count),
    assists: accum.assists.sort((a, b) => b.count - a.count),
    yellowCards: accum.yellowCards.sort((a, b) => b.count - a.count),
    redCards: accum.redCards.sort((a, b) => b.count - a.count),
  };
}

export async function loadAppointments(): Promise<Appointment[]> {
  try {
    const res = await fetch(`${SQUADI_BASE}/public/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearRefId: 8,
        organisationUniqueKey: '78a14e91-3dbc-4b51-a52d-f5642854e8ee',
        competitionIds: [], venueIds: [], fieldIds: [], ageGroupIds: [],
        appointmentStatus: '', dateFrom: null, dateTo: null,
        page: 1, limit: 2000,
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items: { matchId: number; umpires: { sequence: number; status: string }[] }[] =
      Array.isArray(json.data) ? json.data : [];
    return items.map((item) => ({
      matchId: item.matchId,
      ref: item.umpires.find((u) => u.sequence === 1)?.status === 'appointed',
      ar1: item.umpires.find((u) => u.sequence === 2)?.status === 'appointed',
      ar2: item.umpires.find((u) => u.sequence === 3)?.status === 'appointed',
    }));
  } catch {
    return [];
  }
}

