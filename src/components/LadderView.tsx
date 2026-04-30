import type { LadderData, LadderDivision, LadderEntry } from '@/types';
import Image from 'next/image';

interface Props {
  data: LadderData;
  selectedCompetitions: string[];
  selectedAgeGroups: string[];
}

function LadderTable({ division }: { division: LadderDivision }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {division.divisionName}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 w-8">#</th>
              <th className="text-left px-2 py-2 text-xs font-semibold text-gray-400">Team</th>
              <th className="text-center px-2 py-2 text-xs font-semibold text-gray-400 w-8">P</th>
              <th className="text-center px-2 py-2 text-xs font-semibold text-gray-400 w-8">W</th>
              <th className="text-center px-2 py-2 text-xs font-semibold text-gray-400 w-8">D</th>
              <th className="text-center px-2 py-2 text-xs font-semibold text-gray-400 w-8">L</th>
              <th className="text-center px-2 py-2 text-xs font-semibold text-gray-400 w-8">F</th>
              <th className="text-center px-2 py-2 text-xs font-semibold text-gray-400 w-8">A</th>
              <th className="text-center px-2 py-2 text-xs font-semibold text-gray-400 w-10">GD</th>
              <th className="text-center px-2 py-2 text-xs font-semibold text-gray-700 w-10 bg-blue-50">Pts</th>
            </tr>
          </thead>
          <tbody>
            {division.entries.map((entry: LadderEntry, idx: number) => (
              <tr
                key={entry.id}
                className={`border-b border-gray-50 last:border-0 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
              >
                <td className="px-3 py-2 text-xs text-gray-400 font-medium">{entry.rk}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex-shrink-0 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                      {entry.logoUrl ? (
                        <Image
                          src={entry.logoUrl}
                          alt={entry.name}
                          width={24}
                          height={24}
                          className="w-full h-full object-contain"
                          unoptimized
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">⚽</span>
                      )}
                    </div>
                    <span className="text-sm text-gray-800 font-medium leading-tight">
                      {entry.alias ?? entry.name}
                    </span>
                  </div>
                </td>
                <td className="text-center px-2 py-2 text-sm text-gray-600">{entry.P}</td>
                <td className="text-center px-2 py-2 text-sm text-gray-600">{entry.W}</td>
                <td className="text-center px-2 py-2 text-sm text-gray-600">{entry.D}</td>
                <td className="text-center px-2 py-2 text-sm text-gray-600">{entry.L}</td>
                <td className="text-center px-2 py-2 text-sm text-gray-600">{entry.F}</td>
                <td className="text-center px-2 py-2 text-sm text-gray-600">{entry.A}</td>
                <td className="text-center px-2 py-2 text-sm text-gray-600">
                  <span className={Number(entry.goalDifference) > 0 ? 'text-green-600' : Number(entry.goalDifference) < 0 ? 'text-red-500' : ''}>
                    {Number(entry.goalDifference) > 0 ? `+${entry.goalDifference}` : entry.goalDifference}
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-sm font-bold text-brand-700 bg-blue-50/50">
                  {entry.PTS}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function LadderView({ data, selectedCompetitions, selectedAgeGroups }: Props) {
  const filtered = data.laddersByDivision.filter((d) => {
    if (selectedCompetitions.length && !selectedCompetitions.includes(d.competitionName))
      return false;
    if (selectedAgeGroups.length && !selectedAgeGroups.includes(d.ageGroup)) return false;
    return true;
  });

  // Group by competition
  const byComp = new Map<string, LadderDivision[]>();
  for (const div of filtered) {
    if (!byComp.has(div.competitionName)) byComp.set(div.competitionName, []);
    byComp.get(div.competitionName)!.push(div);
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">No ladder data matches your filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {[...byComp.entries()].map(([compName, divisions]) => (
        <section key={compName}>
          <h2 className="text-sm font-bold text-gray-700 mb-3 px-1 border-l-4 border-brand-600 pl-3">
            {compName}
          </h2>
          {divisions.map((div) => (
            <LadderTable key={div.divisionId} division={div} />
          ))}
        </section>
      ))}
    </div>
  );
}
