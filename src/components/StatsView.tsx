'use client';

import { useMemo, useState } from 'react';
import type {
  StatsData, StatCategory, PlayerStatEntry, PlayerStatOccurrence, TeamStatEntry,
} from '@/types';
import { extractClub, formatMatchDate, formatDateKey } from '@/lib/utils';

interface Props {
  data: StatsData;
  category: StatCategory;
  selectedCompetitions: string[];
  selectedAgeGroups: string[];
  selectedClubs: string[];
  selectedTeams: string[];
  dateFrom: string;
  dateTo: string;
}

const CATEGORY_LABELS: Record<StatCategory, string> = {
  goals: 'Goals',
  assists: 'Assists',
  yellowCards: 'Yellow Cards',
  redCards: 'Red Cards',
  cleanSheets: 'Clean Sheets',
};

// Shown in the table header, where the full label is too wide
const COUNT_HEADERS: Record<StatCategory, string> = {
  goals: 'Goals',
  assists: 'Assists',
  yellowCards: 'Yellow',
  redCards: 'Red',
  cleanSheets: 'CS',
};

const COUNT_COLOURS: Record<StatCategory, string> = {
  goals: 'text-green-700 bg-green-50/60',
  assists: 'text-blue-700 bg-blue-50/60',
  yellowCards: 'text-yellow-700 bg-yellow-50/60',
  redCards: 'text-red-700 bg-red-50/60',
  cleanSheets: 'text-teal-700 bg-teal-50/60',
};

// Each division shows a leaderboard-sized slice until expanded
const COLLAPSED_ROWS = 5;

// Player and team stats render through the same table, so both are flattened
// into this shape first.
interface StatRow {
  id: string;
  /** Player name, or the team name for clean sheets */
  primary: string;
  /** Team name — omitted for clean sheets, where it is already the primary */
  secondary: string | null;
  teamName: string;
  competitionName: string;
  divisionName: string;
  count: number;
  /** Completed matches in range — clean sheets only */
  played: number | null;
  occurrences: PlayerStatOccurrence[];
}

function inRange(date: string, dateFrom: string, dateTo: string): boolean {
  const key = formatDateKey(date);
  if (dateFrom && key < dateFrom) return false;
  if (dateTo && key > dateTo) return false;
  return true;
}

function StatModal({
  row,
  category,
  onClose,
}: {
  row: StatRow;
  category: StatCategory;
  onClose: () => void;
}) {
  const label = CATEGORY_LABELS[category];
  const sorted = [...row.occurrences].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900 text-base leading-tight">{row.primary}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{row.secondary ?? row.divisionName}</p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-gray-400 hover:text-gray-600 flex-shrink-0 mt-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <span className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">{row.count}</span>{' '}
            {label.toLowerCase()}{' '}
            {row.played !== null
              ? `from ${row.played} match${row.played !== 1 ? 'es' : ''}`
              : `across ${row.occurrences.length} match${row.occurrences.length !== 1 ? 'es' : ''}`}
          </span>
        </div>

        {/* Match list */}
        <div className="overflow-y-auto flex-1">
          {sorted.map((occ, idx) => (
            <div
              key={`${occ.matchId}-${idx}`}
              className="px-5 py-3 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    vs {occ.opponent}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{occ.divisionName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-700">{formatMatchDate(occ.date)}</p>
                  {occ.homeScore !== null && occ.awayScore !== null && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {occ.homeTeam === row.teamName
                        ? `${occ.homeScore}–${occ.awayScore}`
                        : `${occ.awayScore}–${occ.homeScore}`}{' '}
                      {(occ.homeTeam === row.teamName ? occ.homeScore > occ.awayScore : occ.awayScore > occ.homeScore)
                        ? '(W)' : (occ.homeScore === occ.awayScore ? '(D)' : '(L)')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DivisionTable({
  divisionName,
  competitionName,
  rows,
  category,
  onSelect,
}: {
  divisionName: string;
  competitionName: string;
  rows: StatRow[];
  category: StatCategory;
  onSelect: (row: StatRow) => void;
}) {
  const isTeamStat = category === 'cleanSheets';
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {divisionName}
        </p>
        <p className="text-xs text-gray-400 truncate">{competitionName}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 w-8">#</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400">
              {isTeamStat ? 'Team' : 'Player'}
            </th>
            {isTeamStat ? (
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-400 w-14">Played</th>
            ) : (
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 hidden sm:table-cell">Team</th>
            )}
            <th className={`text-center px-3 py-2.5 text-xs font-semibold w-14 ${COUNT_COLOURS[category]}`}>
              {COUNT_HEADERS[category]}
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, idx) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`border-b border-gray-50 last:border-0 cursor-pointer hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}
            >
              <td className="px-3 py-2.5 text-xs text-gray-400 font-medium">{idx + 1}</td>
              <td className="px-3 py-2.5">
                <div className="font-medium text-gray-800 leading-tight hover:text-blue-600 transition-colors">
                  {row.primary}
                </div>
                {row.secondary && (
                  <div className="text-xs text-gray-400 sm:hidden leading-tight mt-0.5">{row.secondary}</div>
                )}
              </td>
              {isTeamStat ? (
                <td className="px-3 py-2.5 text-center text-sm text-gray-500">{row.played}</td>
              ) : (
                <td className="px-3 py-2.5 text-sm text-gray-600 hidden sm:table-cell">{row.secondary}</td>
              )}
              <td className={`px-3 py-2.5 text-center text-base font-bold ${COUNT_COLOURS[category]}`}>
                {row.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > COLLAPSED_ROWS && (
        <button
          onClick={() => setExpanded((v) => !v)}
          type="button"
          className="w-full px-3 py-2 border-t border-gray-100 bg-gray-50/60 text-xs font-medium text-blue-600 hover:bg-gray-100 hover:text-blue-800 transition-colors"
        >
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

export default function StatsView({
  data,
  category,
  selectedCompetitions,
  selectedAgeGroups,
  selectedClubs,
  selectedTeams,
  dateFrom,
  dateTo,
}: Props) {
  const label = CATEGORY_LABELS[category];
  const [selectedRow, setSelectedRow] = useState<StatRow | null>(null);

  const rows = useMemo((): StatRow[] => {
    function passesFilters(e: { competitionName: string; ageGroup: string; teamName: string }): boolean {
      if (selectedCompetitions.length && !selectedCompetitions.includes(e.competitionName)) return false;
      if (selectedAgeGroups.length && !selectedAgeGroups.includes(e.ageGroup)) return false;
      if (selectedClubs.length && !selectedClubs.includes(extractClub(e.teamName))) return false;
      if (selectedTeams.length && !selectedTeams.includes(e.teamName)) return false;
      return true;
    }

    if (category === 'cleanSheets') {
      return (data.cleanSheets as TeamStatEntry[])
        .filter(passesFilters)
        .map((e): StatRow => {
          const played = e.matches.filter((m) => inRange(m.date, dateFrom, dateTo));
          const clean = played.filter((m) => m.conceded === 0);
          return {
            id: `cleanSheets-${e.teamId}`,
            primary: e.teamName,
            secondary: null,
            teamName: e.teamName,
            competitionName: e.competitionName,
            divisionName: e.divisionName,
            count: clean.length,
            played: played.length,
            occurrences: clean,
          };
        })
        .filter((r) => r.count > 0);
    }

    return (data[category] as PlayerStatEntry[])
      .filter(passesFilters)
      .map((e): StatRow => {
        const occurrences = e.occurrences.filter((o) => inRange(o.date, dateFrom, dateTo));
        return {
          id: `${category}-${e.playerName}-${e.teamId}`,
          primary: e.playerName,
          secondary: e.teamName,
          teamName: e.teamName,
          competitionName: e.competitionName,
          divisionName: e.divisionName,
          count: occurrences.length,
          played: null,
          occurrences,
        };
      })
      .filter((r) => r.count > 0);
  }, [data, category, selectedCompetitions, selectedAgeGroups, selectedClubs, selectedTeams, dateFrom, dateTo]);

  const divisions = useMemo(() => {
    const groups = new Map<string, { divisionName: string; competitionName: string; rows: StatRow[] }>();
    for (const row of rows) {
      const key = `${row.competitionName}|${row.divisionName}`;
      let group = groups.get(key);
      if (!group) {
        group = { divisionName: row.divisionName, competitionName: row.competitionName, rows: [] };
        groups.set(key, group);
      }
      group.rows.push(row);
    }
    for (const group of groups.values()) {
      group.rows.sort((a, b) => b.count - a.count || a.primary.localeCompare(b.primary));
    }
    return [...groups.values()].sort(
      (a, b) =>
        a.competitionName.localeCompare(b.competitionName) ||
        a.divisionName.localeCompare(b.divisionName),
    );
  }, [rows]);

  if (divisions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm">No {label.toLowerCase()} recorded{dateFrom || dateTo ? ' in this date range' : ' yet'}</p>
      </div>
    );
  }

  return (
    <>
      {divisions.map((group) => (
        <DivisionTable
          key={`${group.competitionName}|${group.divisionName}`}
          divisionName={group.divisionName}
          competitionName={group.competitionName}
          rows={group.rows}
          category={category}
          onSelect={setSelectedRow}
        />
      ))}

      {selectedRow && (
        <StatModal
          row={selectedRow}
          category={category}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </>
  );
}
