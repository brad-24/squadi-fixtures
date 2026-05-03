'use client';

import { useEffect, useState } from 'react';
import type { Match, MatchEvent } from '@/types';
import {
  formatMatchTime,
  getStatusLabel,
  getStatusClasses,
} from '@/lib/utils';
import Image from 'next/image';

interface Props {
  match: Match;
  showEvents?: boolean;
}

function TeamLogo({ team }: { team: Match['team1'] }) {
  return (
    <div className="w-7 h-7 flex-shrink-0 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
      {team.logoUrl ? (
        <Image
          src={team.logoUrl}
          alt={team.name}
          width={28}
          height={28}
          className="w-full h-full object-contain"
          unoptimized
        />
      ) : (
        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )}
    </div>
  );
}

function GoalIcon() {
  return <span className="text-sm leading-none flex-shrink-0">⚽</span>;
}

function YellowCardIcon() {
  return (
    <svg className="w-3 h-4 flex-shrink-0" viewBox="0 0 12 16" fill="#f59e0b">
      <rect x="0" y="0" width="12" height="16" rx="2" />
    </svg>
  );
}

function RedCardIcon() {
  return (
    <svg className="w-3 h-4 flex-shrink-0" viewBox="0 0 12 16" fill="#ef4444">
      <rect x="0" y="0" width="12" height="16" rx="2" />
    </svg>
  );
}

function getEventKind(type: string): 'goal' | 'yellow' | 'red' | null {
  if (type === 'G' || type === 'PG' || type === 'OG') return 'goal';
  if (type.startsWith('Y')) return 'yellow';
  if (type.startsWith('R')) return 'red';
  return null;
}

const HALF_TIME_BREAK_MINS = 10;

function getGameMinute(eventTimestamp: string, matchStartTime: string, period: number): number {
  const elapsed = Math.round(
    (new Date(eventTimestamp).getTime() - new Date(matchStartTime).getTime()) / 60000,
  );
  // Subtract the half-time break for each period beyond the first
  const breakAdjustment = (period - 1) * HALF_TIME_BREAK_MINS;
  return Math.max(1, elapsed - breakAdjustment);
}

interface DisplayEvent {
  id: number;
  kind: 'goal' | 'yellow' | 'red';
  minute: number;
  playerName: string;
}

export default function MatchCard({ match, showEvents = false }: Props) {
  const isEnded = match.matchStatus?.toUpperCase() === 'ENDED';
  const LIVE_WINDOW_MS = 100 * 60 * 1000;
  const elapsed = Date.now() - new Date(match.startTime).getTime();
  const isLive = match.matchStatus?.toUpperCase() === 'STARTED' ||
    match.matchStatus?.toUpperCase() === 'PAUSED' ||
    (!match.matchStatus && elapsed >= 0 && elapsed < LIVE_WINDOW_MS);
  const statusLabel = getStatusLabel(match.matchStatus, match.startTime);
  const statusClasses = getStatusClasses(match.matchStatus, match.startTime);
  const venue = match.venueCourt?.venue;
  const court = match.venueCourt?.name;

  const homeWins = isEnded && match.team1ResultId === 1;
  const awayWins = isEnded && match.team2ResultId === 1;
  const hasScores = match.team1Score !== null || match.team2Score !== null;

  interface EventRow {
    id: number;
    kind: 'goal' | 'yellow' | 'red';
    minute: number;
    playerName: string;
    side: 'home' | 'away';
  }

  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    if (!showEvents) return;
    fetch(`/api/match-events?matchId=${match.id}`)
      .then((r) => r.ok ? r.json() : [])
      .then((raw: MatchEvent[]) => {
        const rows: EventRow[] = [];
        for (const e of raw) {
          const kind = getEventKind(e.type);
          if (!kind) continue;
          const playerName = [e.firstName, e.lastName].filter(Boolean).join(' ') || `#${e.shirt}`;
          const minute = getGameMinute(e.eventTimestamp, match.startTime, e.period);
          const side = e.teamId === match.team1.id ? 'home' : 'away';
          rows.push({ id: e.id, kind, minute, playerName, side });
        }
        rows.sort((a, b) => a.minute - b.minute);
        setEvents(rows);
      })
      .catch(() => {});
  }, [match.id, match.startTime, match.team1.id, showEvents]);

  const hasEvents = events.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">
            {formatMatchTime(match.startTime)}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusClasses}`}>
            {isLive ? '● Live' : statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5 min-w-0">
          <span className="text-xs text-gray-400 truncate">{match.competitionName}</span>
          <span className="text-gray-300 flex-shrink-0">·</span>
          <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{match.round.name}</span>
          <span className="text-gray-300 flex-shrink-0">·</span>
          <span className="text-xs text-gray-400 truncate">{match.divisionName}</span>
        </div>
      </div>

      {/* Teams + Score */}
      <div className="px-3 py-3 flex items-center gap-2">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamLogo team={match.team1} />
          <span className={`text-sm leading-tight truncate ${homeWins ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {match.team1.name}
          </span>
        </div>

        {/* Score */}
        <div className="flex items-center gap-1 flex-shrink-0 tabular-nums">
          {hasScores ? (
            <>
              <span className={`text-lg font-bold w-6 text-center ${homeWins ? 'text-gray-900' : 'text-gray-500'}`}>
                {match.team1Score ?? '–'}
              </span>
              <span className="text-base text-gray-400 font-medium">-</span>
              <span className={`text-lg font-bold w-6 text-center ${awayWins ? 'text-gray-900' : 'text-gray-500'}`}>
                {match.team2Score ?? '–'}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400 font-medium px-1">vs</span>
          )}
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className={`text-sm leading-tight truncate text-right ${awayWins ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {match.team2.name}
          </span>
          <TeamLogo team={match.team2} />
        </div>
      </div>

      {/* Events */}
      {showEvents && hasEvents && (
        <div className="px-3 pb-2.5 pt-2 flex flex-col gap-0.5 border-t border-gray-50">
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-1">
              <div className="flex-1 flex justify-end">
                {e.side === 'home' && (
                  <span className="text-xs text-gray-500 leading-tight">{e.playerName} {e.minute}'</span>
                )}
              </div>
              <div className="w-6 flex justify-center flex-shrink-0">
                {e.kind === 'goal' && <GoalIcon />}
                {e.kind === 'yellow' && <YellowCardIcon />}
                {e.kind === 'red' && <RedCardIcon />}
              </div>
              <div className="flex-1">
                {e.side === 'away' && (
                  <span className="text-xs text-gray-500 leading-tight">{e.minute}' {e.playerName}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer — venue */}
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
}
