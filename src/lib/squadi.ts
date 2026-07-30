import type {
  Division, Match, FixtureData,
  LadderDivision, LadderData, LadderEntry,
  StatsData, PlayerStatCategory, PlayerStatEntry, TeamStatEntry, MatchEvent,
  Appointment,
} from '@/types';
import { extractAgeGroup, extractClub } from '@/lib/utils';
import { APPOINTMENT_ORGANISATIONS, COMPETITIONS, SQUADI_BASE } from '@/lib/competitions';

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

// MiniRoos/U12 (id 1387) doesn't track individual events
const MINIROOS_ID = 1387;

export async function loadStats(allMatches: Match[]): Promise<StatsData> {
  const endedMatches = allMatches.filter(
    (m) => m.matchStatus?.toUpperCase() === 'ENDED' && m.competitionId !== MINIROOS_ID,
  );

  const accum: Record<PlayerStatCategory, Map<string, PlayerStatEntry>> = {
    goals: new Map(),
    assists: new Map(),
    yellowCards: new Map(),
    redCards: new Map(),
  };

  const cleanSheets = collectTeamMatches(endedMatches);

  const eventResults = await Promise.all(
    endedMatches.map((match) =>
      fetch(`${SQUADI_BASE}/matches/public/matchEvents?matchId=${match.id}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data: unknown) => ({
          events: Array.isArray(data) ? (data as MatchEvent[]) : [],
          match,
        }))
        .catch(() => ({ events: [] as MatchEvent[], match })),
    ),
  );

  for (const { events, match } of eventResults) {
    for (const e of events) {
      let category: PlayerStatCategory | null = null;
      if (e.type === 'G' || e.type === 'PG') category = 'goals';
      else if (e.type === 'A') category = 'assists';
      else if (e.type.startsWith('Y')) category = 'yellowCards';
      else if (e.type.startsWith('R')) category = 'redCards';
      // OG: not counted as a goal for the scorer
      if (!category || e.isHidden === 1) continue;

      const playerName = [e.firstName, e.lastName].filter(Boolean).join(' ');
      if (!playerName) continue;

      const isTeam1 = e.teamId === match.team1.id;
      const teamName = isTeam1 ? match.team1.name : match.team2.name;
      const opponent = isTeam1 ? match.team2.name : match.team1.name;
      const occurrence = {
        matchId: match.id,
        date: match.startTime,
        opponent,
        homeTeam: match.team1.name,
        awayTeam: match.team2.name,
        homeScore: match.team1Score,
        awayScore: match.team2Score,
        divisionName: match.divisionName,
        competitionName: match.competitionName,
      };

      // Keyed by division as well as player: a team can play across two
      // divisions, and each goal belongs to the division it was scored in.
      const key = `${playerName}|${e.teamId}|${match.divisionId}`;
      const existing = accum[category].get(key);
      if (existing) {
        existing.count++;
        existing.occurrences.push(occurrence);
      } else {
        accum[category].set(key, {
          playerName,
          shirt: e.shirt ?? '',
          teamId: e.teamId,
          teamName,
          competitionName: match.competitionName,
          ageGroup: match.ageGroup,
          divisionId: match.divisionId,
          divisionName: match.divisionName,
          count: 1,
          occurrences: [occurrence],
        });
      }
    }
  }

  return {
    goals: [...accum.goals.values()].sort((a, b) => b.count - a.count),
    assists: [...accum.assists.values()].sort((a, b) => b.count - a.count),
    yellowCards: [...accum.yellowCards.values()].sort((a, b) => b.count - a.count),
    redCards: [...accum.redCards.values()].sort((a, b) => b.count - a.count),
    cleanSheets,
  };
}

function isBye(teamName: string | undefined): boolean {
  return !teamName || /^bye$/i.test(teamName.trim());
}

// One entry per team, holding every completed match it played. Unlike the other
// categories this comes straight from the scoreline — no match events needed.
function collectTeamMatches(endedMatches: Match[]): TeamStatEntry[] {
  // Keyed by division as well as team, for the same reason as the player stats
  const byTeam = new Map<string, TeamStatEntry>();

  for (const match of endedMatches) {
    // A missing score means the result was never entered — not a 0 conceded
    if (match.team1Score === null || match.team2Score === null) continue;
    if (isBye(match.team1?.name) || isBye(match.team2?.name)) continue;

    for (const isTeam1 of [true, false]) {
      const team = isTeam1 ? match.team1 : match.team2;
      const opponent = isTeam1 ? match.team2 : match.team1;
      if (!team?.id) continue;

      const key = `${team.id}|${match.divisionId}`;
      let entry = byTeam.get(key);
      if (!entry) {
        entry = {
          teamId: team.id,
          teamName: team.name,
          competitionName: match.competitionName,
          ageGroup: match.ageGroup,
          divisionId: match.divisionId,
          divisionName: match.divisionName,
          matches: [],
        };
        byTeam.set(key, entry);
      }

      entry.matches.push({
        matchId: match.id,
        date: match.startTime,
        opponent: opponent.name,
        homeTeam: match.team1.name,
        awayTeam: match.team2.name,
        homeScore: match.team1Score,
        awayScore: match.team2Score,
        divisionName: match.divisionName,
        competitionName: match.competitionName,
        conceded: isTeam1 ? match.team2Score : match.team1Score,
      });
    }
  }

  return [...byTeam.values()];
}

interface RawAppointment {
  matchId: number;
  umpires: { sequence: number; status: string }[] | null;
}

// A full season of appointments does not fit in one response, and the feed gives
// no total — so keep asking for pages until one comes back short. The cap is a
// runaway guard, not an expected limit.
const APPOINTMENTS_PAGE_LIMIT = 2000;
const APPOINTMENTS_MAX_PAGES = 10;

async function fetchAppointmentPage(
  organisationUniqueKey: string,
  page: number,
): Promise<RawAppointment[] | null> {
  const res = await fetch(`${SQUADI_BASE}/public/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      yearRefId: 8,
      organisationUniqueKey,
      competitionIds: [], venueIds: [], fieldIds: [], ageGroupIds: [],
      appointmentStatus: '', dateFrom: null, dateTo: null,
      page, limit: APPOINTMENTS_PAGE_LIMIT,
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return Array.isArray(json.data) ? (json.data as RawAppointment[]) : [];
}

function isAppointed(umpires: RawAppointment['umpires'], sequence: number): boolean {
  return (umpires ?? []).find((u) => u.sequence === sequence)?.status === 'appointed';
}

async function loadOrgAppointments(organisationUniqueKey: string): Promise<Appointment[]> {
  const out: Appointment[] = [];
  try {
    for (let page = 1; page <= APPOINTMENTS_MAX_PAGES; page++) {
      const items = await fetchAppointmentPage(organisationUniqueKey, page);
      if (!items) break;
      for (const item of items) {
        out.push({
          matchId: item.matchId,
          ref: isAppointed(item.umpires, 1),
          ar1: isAppointed(item.umpires, 2),
          ar2: isAppointed(item.umpires, 3),
        });
      }
      if (items.length < APPOINTMENTS_PAGE_LIMIT) break;
    }
  } catch {
    // Keep whatever pages already came back rather than dropping the lot
  }
  return out;
}

// One request per organisation: the feed only returns appointments for the
// organisation it was asked about, so a competition run by another body needs
// its own key in APPOINTMENT_ORGANISATIONS to show up at all.
export async function loadAppointments(): Promise<Appointment[]> {
  const perOrg = await Promise.all(APPOINTMENT_ORGANISATIONS.map(loadOrgAppointments));
  const byMatchId = new Map<number, Appointment>();
  for (const list of perOrg) {
    for (const a of list) byMatchId.set(a.matchId, a);
  }
  return [...byMatchId.values()];
}

