import type { Match } from '@/types';
import {
  formatMatchTime,
  getStatusLabel,
  getStatusClasses,
} from '@/lib/utils';
import Image from 'next/image';

interface Props {
  match: Match;
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

export default function MatchCard({ match }: Props) {
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
