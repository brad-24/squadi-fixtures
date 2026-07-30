'use client';

import { useMemo, useState } from 'react';
import type { Match, Appointment } from '@/types';
import { formatMatchDate, formatMatchTime, formatDateKey } from '@/lib/utils';
import { MINIROOS_COMPETITION_ID } from '@/lib/competitions';

interface Props {
  matches: Match[];
  appointmentByMatchId: Map<number, Appointment>;
  // Competitions the appointments feed actually returned data for. A competition
  // missing from this set tells us nothing about its officials either way.
  coveredCompetitionIds: Set<number>;
  appointmentsLoaded: boolean;
}

const OFFICIAL_ROLES: { key: 'ref' | 'ar1' | 'ar2'; label: string }[] = [
  { key: 'ref', label: 'Referee' },
  { key: 'ar1', label: 'AR1' },
  { key: 'ar2', label: 'AR2' },
];

// The officials an appointment reports as NOT assigned. Only ever called for
// competitions the feed covers, so a missing record really does mean nobody
// has been appointed to that match yet.
function missingRoles(appointment: Appointment | undefined): string[] {
  return OFFICIAL_ROLES.filter(({ key }) => !appointment?.[key]).map((r) => r.label);
}

// Games that could still have officials appointed to them
function needsOfficials(m: Match, now: number): boolean {
  // Only upcoming/live games still need officials assigned
  if (m.matchStatus?.toUpperCase() === 'ENDED') return false;
  // Ignore past fixtures (kicked off before now, regardless of status)
  if (new Date(m.startTime).getTime() < now) return false;
  // MiniRoos & U12 don't have officials appointed
  if (m.competitionId === MINIROOS_COMPETITION_ID) return false;
  // Byes have no officials to assign
  if (m.club1.toLowerCase() === 'bye' || m.club2.toLowerCase() === 'bye') return false;
  return true;
}

export default function ClubRefsView({
  matches,
  appointmentByMatchId,
  coveredCompetitionIds,
  appointmentsLoaded,
}: Props) {
  const groupsByDate = useMemo(() => {
    const groups = new Map<string, { match: Match; missing: string[] }[]>();
    const now = Date.now();
    for (const m of matches) {
      if (!needsOfficials(m, now)) continue;
      // No appointment data for this competition at all — reporting every role as
      // unassigned here would be a guess, and a wrong one when another
      // organisation has already appointed the officials.
      if (!coveredCompetitionIds.has(m.competitionId)) continue;
      const missing = missingRoles(appointmentByMatchId.get(m.id));
      if (missing.length === 0) continue;
      const key = formatDateKey(m.startTime);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ match: m, missing });
    }
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [matches, appointmentByMatchId, coveredCompetitionIds]);

  // Competitions with upcoming games that the appointments feed never returned —
  // called out so an empty list isn't mistaken for full coverage
  const uncoveredCompetitions = useMemo(() => {
    const names = new Set<string>();
    const now = Date.now();
    for (const m of matches) {
      if (!needsOfficials(m, now)) continue;
      if (!coveredCompetitionIds.has(m.competitionId)) names.add(m.competitionName);
    }
    return [...names].sort();
  }, [matches, coveredCompetitionIds]);

  const totalGames = useMemo(
    () => [...groupsByDate.values()].reduce((sum, g) => sum + g.length, 0),
    [groupsByDate],
  );

  // Plain-text summary suitable for pasting into a group chat
  const shareText = useMemo(() => {
    const lines = ['⚽ Officials needed', ''];
    for (const [, games] of groupsByDate) {
      lines.push(formatMatchDate(games[0].match.startTime));
      for (const { match, missing } of games) {
        lines.push(
          `• ${formatMatchTime(match.startTime)} ${match.team1.name} v ${match.team2.name}` +
          ` — need ${missing.join(', ')}`,
        );
      }
      lines.push('');
    }
    return lines.join('\n').trimEnd();
  }, [groupsByDate]);

  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // Fallback for browsers/contexts without the async clipboard API
      const ta = document.createElement('textarea');
      ta.value = shareText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!appointmentsLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading officials…</p>
      </div>
    );
  }

  const coverageNote = uncoveredCompetitions.length > 0 && (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mb-4 text-xs">
      No appointments data is published for {uncoveredCompetitions.join(', ')}, so those
      games are left out of this list. Officials may well be appointed — check Squadi directly.
    </div>
  );

  if (totalGames === 0) {
    return (
      <>
        {coverageNote}
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">All upcoming games have their officials assigned</p>
        </div>
      </>
    );
  }

  return (
    <>
      {coverageNote}
      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{totalGames}</span>
          {' upcoming '}{totalGames === 1 ? 'game needs' : 'games need'}{' officials assigned'}
        </p>
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors flex-shrink-0"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy list
            </>
          )}
        </button>
      </div>
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
