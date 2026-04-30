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

function TeamRow({
  team,
  score,
  resultId,
  isEnded,
}: {
  team: Match['team1'];
  score: number | null;
  resultId: number | null;
  isEnded: boolean;
}) {
  const isWinner = isEnded && resultId === 1;
  return (
    <div className={`flex items-center gap-2.5 py-1 ${isWinner ? 'font-semibold' : ''}`}>
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
      <span className="flex-1 text-sm leading-tight text-gray-800 truncate">{team.name}</span>
      <span
        className={`text-base tabular-nums w-6 text-right flex-shrink-0 ${
          isWinner ? 'text-gray-900' : 'text-gray-500'
        }`}
      >
        {score !== null ? score : '–'}
      </span>
    </div>
  );
}

export default function MatchCard({ match }: Props) {
  const isEnded = match.matchStatus?.toUpperCase() === 'ENDED';
  const isLive = match.matchStatus?.toUpperCase() === 'STARTED';
  const statusLabel = getStatusLabel(match.matchStatus);
  const statusClasses = getStatusClasses(match.matchStatus);
  const venue = match.venueCourt?.venue;
  const court = match.venueCourt?.name;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs text-gray-500 truncate">{match.competitionName}</span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-500 truncate">{match.round.name}</span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-500 truncate">{match.divisionName}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusClasses}`}>
          {isLive ? '● Live' : statusLabel}
        </span>
      </div>

      {/* Teams */}
      <div className="px-3 pt-2 pb-1">
        <TeamRow
          team={match.team1}
          score={match.team1Score}
          resultId={match.team1ResultId}
          isEnded={isEnded}
        />
        <TeamRow
          team={match.team2}
          score={match.team2Score}
          resultId={match.team2ResultId}
          isEnded={isEnded}
        />
      </div>

      {/* Footer */}
      <div className="px-3 pb-2.5 flex items-center gap-3 text-xs text-gray-400">
        {venue && (
          <span className="flex items-center gap-1 truncate">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{venue.name}{court ? ` · ${court}` : ''}</span>
          </span>
        )}
        <span className="flex items-center gap-1 flex-shrink-0 ml-auto">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {formatMatchTime(match.startTime)}
        </span>
      </div>
    </div>
  );
}
