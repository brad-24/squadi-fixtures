import type { StatsData, StatCategory, PlayerStatEntry } from '@/types';

interface Props {
  data: StatsData;
  category: StatCategory;
  selectedCompetitions: string[];
  selectedAgeGroups: string[];
}

const CATEGORY_LABELS: Record<StatCategory, string> = {
  goals: 'Goals',
  assists: 'Assists',
  yellowCards: 'Yellow Cards',
  redCards: 'Red Cards',
};

const COUNT_COLOURS: Record<StatCategory, string> = {
  goals: 'text-green-700 bg-green-50/60',
  assists: 'text-blue-700 bg-blue-50/60',
  yellowCards: 'text-yellow-700 bg-yellow-50/60',
  redCards: 'text-red-700 bg-red-50/60',
};

export default function StatsView({ data, category, selectedCompetitions, selectedAgeGroups }: Props) {
  const label = CATEGORY_LABELS[category];

  const entries: PlayerStatEntry[] = data[category].filter((e) => {
    if (selectedCompetitions.length && !selectedCompetitions.includes(e.competitionName)) return false;
    if (selectedAgeGroups.length && !selectedAgeGroups.includes(e.ageGroup)) return false;
    return true;
  });

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm">No {label.toLowerCase()} recorded yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 w-8">#</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400">Player</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 hidden sm:table-cell">Team</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 hidden lg:table-cell">Division</th>
            <th className={`text-center px-3 py-2.5 text-xs font-semibold w-14 ${COUNT_COLOURS[category]}`}>
              {label}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr
              key={`${entry.playerName}-${entry.teamId}`}
              className={`border-b border-gray-50 last:border-0 ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}
            >
              <td className="px-3 py-2.5 text-xs text-gray-400 font-medium">{idx + 1}</td>
              <td className="px-3 py-2.5">
                <div className="font-medium text-gray-800 leading-tight">{entry.playerName}</div>
                <div className="text-xs text-gray-400 sm:hidden leading-tight mt-0.5">{entry.teamName}</div>
              </td>
              <td className="px-3 py-2.5 text-sm text-gray-600 hidden sm:table-cell">{entry.teamName}</td>
              <td className="px-3 py-2.5 hidden lg:table-cell">
                <div className="text-xs text-gray-500">{entry.divisionName}</div>
              </td>
              <td className={`px-3 py-2.5 text-center text-base font-bold ${COUNT_COLOURS[category]}`}>
                {entry.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
