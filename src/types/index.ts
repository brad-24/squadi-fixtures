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

export interface ActiveFilters {
  competitions: string[];
  ageGroups: string[];
  clubs: string[];
  teams: string[];
  dateFrom: string;
  dateTo: string;
}
