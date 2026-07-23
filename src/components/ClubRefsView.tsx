'use client';

import { useMemo } from 'react';
import type { Match, Appointment } from '@/types';
import { formatMatchDate, formatMatchTime, formatDateKey } from '@/lib/utils';

interface Props {
  matches: Match[];
  appointmentByMatchId: Map<number, Appointment>;
}

const OFFICIAL_ROLES: { key: 'ref' | 'ar1' | 'ar2'; label: string }[] = [
  { key: 'ref', label: 'Referee' },
  { key: 'ar1', label: 'AR1' },
  { key: 'ar2', label: 'AR2' },
];

// The officials an appointment reports as NOT assigned. A match with no
// appointment record at all is treated as having every role unassigned.
function missingRoles(appointment: Appointment | undefined): string[] {
  return OFFICIAL_ROLES.filter(({ key }) => !appointment?.[key]).map((r) => r.label);
}

export default function ClubRefsView({ matches, appointmentByMatchId }: Props) {
  const groupsByDate = useMemo(() => {
    const groups = new Map<string, { match: Match; missing: string[] }[]>();
    for (const m of matches) {
      // Only upcoming/live games still need officials assigned
      if (m.matchStatus?.toUpperCase() === 'ENDED') continue;
      // Byes have no officials to assign
      if (m.club1.toLowerCase() === 'bye' || m.club2.toLowerCase() === 'bye') continue;
      const missing = missingRoles(appointmentByMatchId.get(m.id));
      if (missing.length === 0) continue;
      const key = formatDateKey(m.startTime);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ match: m, missing });
    }
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [matches, appointmentByMatchId]);

  const totalGames = useMemo(
    () => [...groupsByDate.values()].reduce((sum, g) => sum + g.length, 0),
    [groupsByDate],
  );

  if (totalGames === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">All upcoming games have their officials assigned</p>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-gray-500 mb-4">
        <span className="font-semibold text-gray-800">{totalGames}</span>
        {' upcoming '}{totalGames === 1 ? 'game needs' : 'games need'}{' officials assigned'}
      </p>
      <div className="space-y-6">
        {[...groupsByDate.entries()].map(([dateKey, games]) => (
          <section key={dateKey}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-gray-300" />
              <span className="text-base font-bold text-gray-800 whitespace-nowrap px-2">
                {formatMatchDate(games[0].match.startTime)}
              </span>
              <div className="flex-1 h-px bg-gray-300" />
            </div>
            <div className="space-y-2.5">
              {games.map(({ match, missing }) => {
                const venue = match.venueCourt?.venue;
                const court = match.venueCourt?.name;
                return (
                  <div
                    key={match.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    <div className="px-3 pt-2.5 pb-2 flex items-center justify-between gap-2">
                      <span className="text-base font-bold text-gray-900 flex-shrink-0">
                        {formatMatchTime(match.startTime)}
                      </span>
                      <span className="text-xs text-gray-400 truncate min-w-0 text-right">
                        {match.competitionName} · {match.round.name} · {match.divisionName}
                      </span>
                    </div>
                    <div className="px-3 pb-2">
                      <p className="text-sm text-gray-800 font-medium leading-tight">
                        {match.team1.name} <span className="text-gray-400 font-normal">v</span> {match.team2.name}
                      </p>
                    </div>
                    <div className="px-3 py-1.5 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide flex-shrink-0">
                        Not assigned
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {missing.map((role) => (
                          <span
                            key={role}
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-600"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                    {venue && (
                      <div className="px-3 py-2 border-t border-gray-100">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="truncate">{venue.name}{court ? ` · ${court}` : ''}</span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
