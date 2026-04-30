'use client';

import { useEffect, useState, useMemo } from 'react';
import type { FixtureData, ActiveFilters, Match } from '@/types';
import { formatMatchDate, formatDateKey } from '@/lib/utils';
import MultiSelect from '@/components/MultiSelect';
import MatchCard from '@/components/MatchCard';

const EMPTY_FILTERS: ActiveFilters = {
  ageGroups: [],
  clubs: [],
  teams: [],
  dateFrom: '',
  dateTo: '',
};

export default function Home() {
  const [data, setData] = useState<FixtureData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetch('/api/fixtures')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load: ${r.status}`);
        return r.json();
      })
      .then((d: FixtureData) => setData(d))
      .catch((e) => setError(e.message));
  }, []);

  // Derive filter option lists from all matches
  const filterOptions = useMemo(() => {
    if (!data) return { ageGroups: [], clubs: [], teams: [] };
    const ageGroups = [...new Set(data.allMatches.map((m) => m.ageGroup))].sort();
    const clubs = [
      ...new Set(
        data.allMatches
          .flatMap((m) => [m.club1, m.club2])
          .filter((c) => c && c.toLowerCase() !== 'bye'),
      ),
    ].sort();
    const teams = [
      ...new Set(
        data.allMatches.flatMap((m) => [m.team1.name, m.team2.name]),
      ),
    ].sort();
    return { ageGroups, clubs, teams };
  }, [data]);

  // Apply filters
  const filteredMatches = useMemo((): Match[] => {
    if (!data) return [];
    return data.allMatches.filter((m) => {
      if (filters.ageGroups.length && !filters.ageGroups.includes(m.ageGroup)) return false;
      if (
        filters.clubs.length &&
        !filters.clubs.includes(m.club1) &&
        !filters.clubs.includes(m.club2)
      )
        return false;
      if (
        filters.teams.length &&
        !filters.teams.includes(m.team1.name) &&
        !filters.teams.includes(m.team2.name)
      )
        return false;
      if (filters.dateFrom) {
        const matchDate = formatDateKey(m.startTime);
        if (matchDate < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        const matchDate = formatDateKey(m.startTime);
        if (matchDate > filters.dateTo) return false;
      }
      return true;
    });
  }, [data, filters]);

  // Group by date
  const matchesByDate = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of filteredMatches) {
      const key = formatDateKey(m.startTime);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return groups;
  }, [filteredMatches]);

  const hasActiveFilters =
    filters.ageGroups.length > 0 ||
    filters.clubs.length > 0 ||
    filters.teams.length > 0 ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  const activeFilterCount =
    (filters.ageGroups.length > 0 ? 1 : 0) +
    (filters.clubs.length > 0 ? 1 : 0) +
    (filters.teams.length > 0 ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-brand-800 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {data?.competition?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.competition.logoUrl}
              alt="Competition logo"
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-white p-0.5"
            />
          )}
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">
              {data?.competition?.name ?? 'Fixtures'}
            </h1>
            {data && (
              <p className="text-blue-200 text-xs">
                {data.allMatches.length} matches · {data.divisions.length} divisions
              </p>
            )}
          </div>
          {/* Mobile filter toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="ml-auto flex items-center gap-1.5 bg-brand-700 hover:bg-brand-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-white text-brand-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Filter panel */}
      <div
        className={`bg-white border-b border-gray-200 shadow-sm transition-all duration-200 ${
          filtersOpen ? 'block' : 'hidden'
        }`}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <MultiSelect
              label="Age Group"
              options={filterOptions.ageGroups}
              selected={filters.ageGroups}
              onChange={(v) => setFilters((f) => ({ ...f, ageGroups: v }))}
            />
            <MultiSelect
              label="Club"
              options={filterOptions.clubs}
              selected={filters.clubs}
              onChange={(v) => setFilters((f) => ({ ...f, clubs: v }))}
            />
            <MultiSelect
              label="Team"
              options={filterOptions.teams}
              selected={filters.teams}
              onChange={(v) => setFilters((f) => ({ ...f, teams: v }))}
            />
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              type="button"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">
            <strong>Error loading fixtures:</strong> {error}
          </div>
        )}

        {!data && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Loading fixtures…</p>
          </div>
        )}

        {data && (
          <>
            {/* Results summary */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {hasActiveFilters ? (
                  <>
                    <span className="font-semibold text-gray-800">{filteredMatches.length}</span>
                    {' of '}
                    <span>{data.allMatches.length}</span>
                    {' matches'}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-gray-800">{data.allMatches.length}</span>
                    {' matches across '}
                    <span className="font-semibold text-gray-800">{matchesByDate.size}</span>
                    {' dates'}
                  </>
                )}
              </p>
              {!filtersOpen && (
                <button
                  onClick={() => setFiltersOpen(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  type="button"
                >
                  + Filter
                </button>
              )}
            </div>

            {filteredMatches.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">No matches match your filters</p>
                <button
                  onClick={clearFilters}
                  className="mt-2 text-blue-600 text-sm hover:text-blue-800"
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {[...matchesByDate.entries()].map(([dateKey, matches]) => (
                  <section key={dateKey}>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                      {formatMatchDate(matches[0].startTime)}
                    </h2>
                    <div className="space-y-2.5">
                      {matches.map((m) => (
                        <MatchCard key={m.id} match={m} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
