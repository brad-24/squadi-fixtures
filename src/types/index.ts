export interface Competition {
  id: number;
  uniqueKey: string;
  name: string;
  longName: string;
  yearRefId: number;
  logoUrl: string | null;
  organisationId: number;
}

export interface Division {
  id: number;
  name: string;
  uniqueKey: string;
  competitionId: number;
  age: number | null;
  grade: string | null;
}

export interface Team {
  id: number;
  name: string;
  alias: string | null;
  teamUniqueKey: string;
  logoUrl: string | null;
}

export interface Venue {
  name: string;
  shortName: string;
  suburb?: string;
}

export interface VenueCourt {
  name: string;
  courtNumber: number;
  venue: Venue;
}

export interface MatchRound {
  id: number;
  name: string;
  sequence: number;
}

export interface Match {
  id: number;
  team1: Team;
  team2: Team;
  team1Score: number | null;
  team2Score: number | null;
  team1ResultId: number | null;
  team2ResultId: number | null;
  startTime: string;
  matchStatus: string | null;
  venueCourt: VenueCourt;
  round: MatchRound;
  divisionId: number;
  competitionId: number;
  isFinals: boolean;
  finalsAlias: string | null;
  // enriched
  divisionName: string;
  competitionName: string;
  ageGroup: string;
  club1: string;
  club2: string;
}

export interface FixtureData {
  competitions: Competition[];
  divisions: Division[];
  allMatches: Match[];
}

// ── Ladder ──────────────────────────────────────────────────────────────────

export interface LadderEntry {
  id: number;
  name: string;
  alias: string | null;
  logoUrl: string | null;
  rk: string;
  P: string;
  W: string;
  D: string;
  L: string;
  F: string;
  A: string;
  PTS: string;
  goalDifference: string;
}

export interface LadderDivision {
  divisionId: number;
  divisionName: string;
  competitionId: number;
  competitionName: string;
  ageGroup: string;
  entries: LadderEntry[];
}

export interface LadderData {
  laddersByDivision: LadderDivision[];
}

// ── Statistics ───────────────────────────────────────────────────────────────

export type StatCategory = 'goals' | 'assists' | 'yellowCards' | 'redCards';

export interface PlayerStatEntry {
  playerName: string;
  shirt: string;
  teamId: number;
  teamName: string;
  competitionName: string;
  ageGroup: string;
  divisionName: string;
  count: number;
}

export interface StatsData {
  goals: PlayerStatEntry[];
  assists: PlayerStatEntry[];
  yellowCards: PlayerStatEntry[];
  redCards: PlayerStatEntry[];
}

// ── Appointments ─────────────────────────────────────────────────────────────

export interface Appointment {
  date: string;         // YYYY-MM-DD (AEST)
  time: string;         // HH:mm (AEST)
  competition: string;
  home: string;
  away: string;
  venue: string;
  referee: string | null;
  ar1: string | null;
  ar2: string | null;
}

// ── Filters ───────────────────────────────────────────────────────────────────

// ── Match Events ─────────────────────────────────────────────────────────────

export interface MatchEvent {
  id: number;
  type: string;
  eventTimestamp: string;
  teamId: number;
  period: number;
  firstName: string | null;
  lastName: string | null;
  shirt: string | null;
  isHidden: number;
}

export interface ActiveFilters {
  competitions: string[];
  ageGroups: string[];
  locations: string[];
  clubs: string[];
  teams: string[];
  dateFrom: string;
  dateTo: string;
}
