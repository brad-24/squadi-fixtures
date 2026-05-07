'use client';

import { useEffect, useState, useMemo, type ReactNode } from 'react';
import Image from 'next/image';
import type { FixtureData, LadderData, ActiveFilters, Match, StatsData, StatCategory, Appointment } from '@/types';
import { formatMatchDate, formatDateKey, formatMatchTime, getStatusLabel } from '@/lib/utils';
import MultiSelect from '@/components/MultiSelect';
import MatchCard from '@/components/MatchCard';
import LadderView from '@/components/LadderView';
import StatsView from '@/components/StatsView';
import ContactModal from '@/components/ContactModal';

type Tab = 'fixtures' | 'results' | 'ladder' | 'statistics';

const STAT_CATEGORIES: { key: StatCategory; label: string }[] = [
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'yellowCards', label: 'Yellow Cards' },
  { key: 'redCards', label: 'Red Cards' },
];

const EMPTY_FILTERS: ActiveFilters = {
  competitions: [],
  ageGroups: [],
  locations: [],
  clubs: [],
  teams: [],
  dateFrom: '',
  dateTo: '',
};

const DATE_PRESETS = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
  { label: '2 Months', days: 60 },
  { label: '3 Months', days: 90 },
];

function FilterCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </div>
  );
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

function subtractDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString('en-CA');
}

function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });
}

function isUpcoming(startTime: string): boolean {
  return new Date(startTime) > new Date();
}

const LIVE_WINDOW_MS = 100 * 60 * 1000;

function isInProgress(m: Match): boolean {
  const s = m.matchStatus?.toUpperCase();
  if (s === 'STARTED' || s === 'PAUSED') return true;
  if (s === 'ENDED') return false;
  const elapsed = Date.now() - new Date(m.startTime).getTime();
  return elapsed >= 0 && elapsed < LIVE_WINDOW_MS;
}

function isPresetActive(filters: ActiveFilters, days: number, direction: 'future' | 'past'): boolean {
  const from = direction === 'future' ? todayStr() : subtractDays(new Date(), days);
  const to = direction === 'future' ? addDays(new Date(), days) : todayStr();
  return filters.dateFrom === from && filters.dateTo === to;
}

// Brisbane is always UTC+10 (no DST)

function DateDivider({ startTime }: { startTime: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="flex-1 h-px bg-gray-300" />
      <span className="text-base font-bold text-gray-800 whitespace-nowrap px-2">
        {formatMatchDate(startTime)}
      </span>
      <div className="flex-1 h-px bg-gray-300" />
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('fixtures');
  const [fixtureData, setFixtureData] = useState<FixtureData | null>(null);
  const [ladderData, setLadderData] = useState<LadderData | null>(null);
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const [ladderError, setLadderError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [reloading, setReloading] = useState(false);
  const [showPastFixtures, setShowPastFixtures] = useState(false);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsCategory, setStatsCategory] = useState<StatCategory>('goals');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showContact, setShowContact] = useState(false);

  useEffect(() => {
    fetch('/api/fixtures')
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setFixtureData)
      .catch((e) => setFixtureError(e.message));
    fetch('/api/ladder')
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setLadderData)
      .catch((e) => setLadderError(e.message));
    fetch('/api/stats')
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setStatsData)
      .catch((e) => setStatsError(e.message));
    fetch('/api/appointments')
      .then((r) => r.ok ? r.json() : [])
      .then(setAppointments)
      .catch(() => {});
  }, []);

  async function handleReload() {
    setReloading(true);
    setFixtureError(null);
    setLadderError(null);
    setStatsError(null);
    try {
      const [fRes, lRes, sRes, aRes] = await Promise.all([
        fetch('/api/fixtures?force=1', { cache: 'no-store' }),
        fetch('/api/ladder?force=1', { cache: 'no-store' }),
        fetch('/api/stats?force=1', { cache: 'no-store' }),
        fetch('/api/appointments?force=1', { cache: 'no-store' }),
      ]);
      if (fRes.ok) setFixtureData(await fRes.json());
      else setFixtureError(String(fRes.status));
      if (lRes.ok) setLadderData(await lRes.json());
      else setLadderError(String(lRes.status));
      if (sRes.ok) setStatsData(await sRes.json());
      else setStatsError(String(sRes.status));
      if (aRes.ok) setAppointments(await aRes.json());
    } catch { /* keep existing data visible */ } finally {
      setReloading(false);
    }
  }

  const filterOptions = useMemo(() => {
    if (!fixtureData) return { competitions: [], ageGroups: [], locations: [], clubs: [], teams: [] };

    // For each dimension, compute available options by applying all OTHER active filters.
    // This gives cascading behaviour: selecting a Club narrows the Team list, etc.
    function passes(m: Match, skip: keyof ActiveFilters): boolean {
      if (skip !== 'competitions' && filters.competitions.length && !filters.competitions.includes(m.competitionName)) return false;
      if (skip !== 'ageGroups' && filters.ageGroups.length && !filters.ageGroups.includes(m.ageGroup)) return false;
      if (skip !== 'locations' && filters.locations.length && !filters.locations.includes(m.venueCourt?.venue?.name ?? '')) return false;
      if (skip !== 'clubs' && filters.clubs.length && !filters.clubs.includes(m.club1) && !filters.clubs.includes(m.club2)) return false;
      if (skip !== 'teams' && filters.teams.length && !filters.teams.includes(m.team1.name) && !filters.teams.includes(m.team2.name)) return false;
      if (skip !== 'dateFrom' && filters.dateFrom && formatDateKey(m.startTime) < filters.dateFrom) return false;
      if (skip !== 'dateTo' && filters.dateTo && formatDateKey(m.startTime) > filters.dateTo) return false;
      return true;
    }

    const all = fixtureData.allMatches;
    const competitions = [...new Set(all.filter(m => passes(m, 'competitions')).map(m => m.competitionName))].sort();
    const ageGroups    = [...new Set(all.filter(m => passes(m, 'ageGroups')).map(m => m.ageGroup))].sort();
    const locations    = [...new Set(all.filter(m => passes(m, 'locations')).map(m => m.venueCourt?.venue?.name).filter((v): v is string => !!v))].sort();

    // For clubs: only include a team's club when that team matches the active team filter.
    // For teams: only include a team when its club matches the active club filter.
    // This prevents opponent clubs/teams from bleeding into the option lists.
    const clubs = [...new Set(
      all.filter(m => passes(m, 'clubs')).flatMap(m => {
        const out: string[] = [];
        const teamMatch = !filters.teams.length;
        if ((teamMatch || filters.teams.includes(m.team1.name)) && m.club1 && m.club1.toLowerCase() !== 'bye') out.push(m.club1);
        if ((teamMatch || filters.teams.includes(m.team2.name)) && m.club2 && m.club2.toLowerCase() !== 'bye') out.push(m.club2);
        return out;
      }),
    )].sort();

    const teams = [...new Set(
      all.filter(m => passes(m, 'teams')).flatMap(m => {
        const out: string[] = [];
        const clubMatch = !filters.clubs.length;
        if (clubMatch || filters.clubs.includes(m.club1)) out.push(m.team1.name);
        if (clubMatch || filters.clubs.includes(m.club2)) out.push(m.team2.name);
        return out;
      }),
    )].sort();

    return { competitions, ageGroups, locations, clubs, teams };
  }, [fixtureData, filters]);

  const filteredMatches = useMemo((): Match[] => {
    if (!fixtureData) return [];
    return fixtureData.allMatches.filter((m) => {
      if (filters.competitions.length && !filters.competitions.includes(m.competitionName))
        return false;
      if (filters.ageGroups.length && !filters.ageGroups.includes(m.ageGroup)) return false;
      if (filters.locations.length && !filters.locations.includes(m.venueCourt?.venue?.name ?? ''))
        return false;
      if (filters.clubs.length && !filters.clubs.includes(m.club1) && !filters.clubs.includes(m.club2))
        return false;
      if (filters.teams.length && !filters.teams.includes(m.team1.name) && !filters.teams.includes(m.team2.name))
        return false;
      if (filters.dateFrom && formatDateKey(m.startTime) < filters.dateFrom) return false;
      if (filters.dateTo && formatDateKey(m.startTime) > filters.dateTo) return false;
      return true;
    });
  }, [fixtureData, filters]);

  // Upcoming = live (in-progress) and future matches only
  const upcomingByDate = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of filteredMatches) {
      if (m.matchStatus?.toUpperCase() === 'ENDED') continue;
      if (!isInProgress(m) && !isUpcoming(m.startTime) && !showPastFixtures) continue;
      const key = formatDateKey(m.startTime);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return groups;
  }, [filteredMatches, showPastFixtures]);

  // Results = ended or past matches (descending date order — most recent first)
  const completedByDate = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of filteredMatches) {
      if (isInProgress(m)) continue;
      if (isUpcoming(m.startTime)) continue;
      const key = formatDateKey(m.startTime);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
    return new Map([...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])));
  }, [filteredMatches]);

  const upcomingCount = useMemo(() => {
    return filteredMatches.filter((m) => {
      if (m.matchStatus?.toUpperCase() === 'ENDED') return false;
      if (!isInProgress(m) && !isUpcoming(m.startTime) && !showPastFixtures) return false;
      return true;
    }).length;
  }, [filteredMatches, showPastFixtures]);
  const completedCount = useMemo(
    () => filteredMatches.filter((m) => !isInProgress(m) && !isUpcoming(m.startTime)).length,
    [filteredMatches],
  );

  const hasActiveFilters =
    filters.competitions.length > 0 ||
    filters.ageGroups.length > 0 ||
    filters.locations.length > 0 ||
    filters.clubs.length > 0 ||
    filters.teams.length > 0 ||
    !!filters.dateFrom ||
    !!filters.dateTo;

  const appointmentByMatchId = useMemo(() => {
    const map = new Map<number, Appointment>();
    for (const a of appointments) map.set(a.matchId, a);
    return map;
  }, [appointments]);

  function clearFilters() { setFilters(EMPTY_FILTERS); }

  function switchTab(newTab: Tab) {
    setTab(newTab);
    setFilters((f) => ({ ...f, dateFrom: '', dateTo: '' }));
  }

  function applyPreset(days: number, direction: 'future' | 'past') {
    const from = direction === 'future' ? todayStr() : subtractDays(new Date(), days);
    const to = direction === 'future' ? addDays(new Date(), days) : todayStr();
    if (isPresetActive(filters, days, direction)) {
      setFilters((f) => ({ ...f, dateFrom: '', dateTo: '' }));
    } else {
      setFilters((f) => ({ ...f, dateFrom: from, dateTo: to }));
    }
  }

  function exportToCSV() {
    const matches = tab === 'results'
      ? filteredMatches.filter((m) => m.matchStatus?.toUpperCase() === 'ENDED' || isInProgress(m))
      : filteredMatches.filter((m) => {
          if (m.matchStatus?.toUpperCase() === 'ENDED') return false;
          if (!isInProgress(m) && !isUpcoming(m.startTime) && !showPastFixtures) return false;
          return true;
        });

    const headers = [
      'Date', 'Time', 'Competition', 'Age Group', 'Round', 'Division',
      'Team 1', 'Score 1', 'Score 2', 'Team 2', 'Venue', 'Status',
      'Referee', 'AR1', 'AR2',
    ];
    const rows = matches.map((m) => {
      const appt = appointmentByMatchId.get(m.id);
      return [
        formatDateKey(m.startTime),
        formatMatchTime(m.startTime),
        m.competitionName,
        m.ageGroup,
        m.round.name,
        m.divisionName,
        m.team1.name,
        m.team1Score ?? '',
        m.team2Score ?? '',
        m.team2.name,
        [m.venueCourt?.venue?.name, m.venueCourt?.name].filter(Boolean).join(' · '),
        getStatusLabel(m.matchStatus),
        appt?.ref ? 'Appointed' : '',
        appt?.ar1 ? 'Appointed' : '',
        appt?.ar2 ? 'Appointed' : '',
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `darling-downs-${tab}-${todayStr()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportToICS() {
    const matches = tab === 'results'
      ? filteredMatches.filter((m) => m.matchStatus?.toUpperCase() === 'ENDED' || isInProgress(m))
      : filteredMatches.filter((m) => {
          if (m.matchStatus?.toUpperCase() === 'ENDED') return false;
          if (!isInProgress(m) && !isUpcoming(m.startTime) && !showPastFixtures) return false;
          return true;
        });

    function toICSDate(utcString: string): string {
      return new Date(utcString).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    }

    function icsEscape(str: string): string {
      return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    }

    const events = matches.map((m) => {
      const dtStart = toICSDate(m.startTime);
      const dtEnd = toICSDate(new Date(new Date(m.startTime).getTime() + 90 * 60 * 1000).toISOString());
      const summary = `${m.team1.name} v ${m.team2.name}`;
      const descParts = [m.competitionName, m.round.name, m.divisionName];
      if (m.team1Score !== null && m.team2Score !== null) {
        descParts.push(`${m.team1Score} - ${m.team2Score}`);
      }
      const location = [m.venueCourt?.venue?.name, m.venueCourt?.name].filter(Boolean).join(', ');
      const lines = [
        'BEGIN:VEVENT',
        `UID:match-${m.id}@darling-downs-fq`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${icsEscape(summary)}`,
        `DESCRIPTION:${icsEscape(descParts.join(' · '))}`,
      ];
      if (location) lines.push(`LOCATION:${icsEscape(location)}`);
      lines.push('END:VEVENT');
      return lines.join('\r\n');
    });

    const calendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Football Queensland Darling Downs//Fixtures//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `darling-downs-${tab}-${todayStr()}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const tabConfig = [
    { id: 'fixtures' as Tab, label: '📅 Fixtures' },
    { id: 'results' as Tab, label: '✅ Results' },
    { id: 'ladder' as Tab, label: '🏆 Ladders' },
    { id: 'statistics' as Tab, label: '📊 Statistics' },
  ];

  const showExport = tab !== 'ladder' && fixtureData &&
    (tab === 'fixtures' ? upcomingCount > 0 : completedCount > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Disclaimer banner */}
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-xs text-yellow-800">
        This is not an official Football Queensland page. Data is sourced from{' '}
        <a href="https://registration.squadi.com/liveScoreSeasonFixture" target="_blank" rel="noopener noreferrer" className="underline font-medium">
          Squadi
        </a>
      </div>

      {/* Sticky header + tabs */}
      <header className="bg-brand-800 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <Image
                src="/fq-logo.png"
                alt="Football Queensland"
                width={32}
                height={32}
                className="h-8 w-8 object-contain flex-shrink-0"
                unoptimized
              />
              <h1 className="font-bold text-lg leading-tight">Football Queensland - Darling Downs - Season 2026</h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowContact(true)}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
              >
                Contact
              </button>
            <button
              onClick={handleReload}
              disabled={reloading}
              title="Reload data"
              type="button"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-brand-700 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <svg
                className={`w-5 h-5 ${reloading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            </div>
          </div>
          <div className="flex gap-1">
            {tabConfig.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors
                  ${tab === id
                    ? 'bg-gray-50 text-brand-800'
                    : 'text-zinc-400 hover:text-white hover:bg-brand-700'
                  }`}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Always-visible filter bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-3">
          {/* Dropdown filters */}
          <div className={`grid grid-cols-2 gap-2 items-end ${tab !== 'ladder' ? 'sm:grid-cols-3 lg:grid-cols-5' : ''}`}>
            <FilterCell label="Competition">
              <MultiSelect
                label="Competition"
                options={filterOptions.competitions}
                selected={filters.competitions}
                onChange={(v) => setFilters((f) => ({ ...f, competitions: v }))}
              />
            </FilterCell>
            <FilterCell label="Age Group">
              <MultiSelect
                label="Age Group"
                options={filterOptions.ageGroups}
                selected={filters.ageGroups}
                onChange={(v) => setFilters((f) => ({ ...f, ageGroups: v }))}
              />
            </FilterCell>
            {tab !== 'ladder' && (
              <>
                {tab !== 'statistics' && (
                  <FilterCell label="Location">
                    <MultiSelect
                      label="Location"
                      options={filterOptions.locations}
                      selected={filters.locations}
                      onChange={(v) => setFilters((f) => ({ ...f, locations: v }))}
                    />
                  </FilterCell>
                )}
                <FilterCell label="Club">
                  <MultiSelect
                    label="Club"
                    options={filterOptions.clubs}
                    selected={filters.clubs}
                    onChange={(v) => setFilters((f) => ({ ...f, clubs: v }))}
                  />
                </FilterCell>
                <FilterCell label="Team">
                  <MultiSelect
                    label="Team"
                    options={filterOptions.teams}
                    selected={filters.teams}
                    onChange={(v) => setFilters((f) => ({ ...f, teams: v }))}
                  />
                </FilterCell>
              </>
            )}
          </div>

          {/* Date range — fixtures and results only */}
          {tab !== 'ladder' && tab !== 'statistics' && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 items-end">
              <FilterCell label="From">
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:border-blue-500 h-[38px]"
                />
              </FilterCell>
              <FilterCell label="To">
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="w-full px-2.5 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white focus:outline-none focus:border-blue-500 h-[38px]"
                />
              </FilterCell>
            </div>
          )}

          {/* Date presets — fixtures and results only */}
          {tab !== 'ladder' && tab !== 'statistics' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium">
                {tab === 'fixtures' ? 'Upcoming:' : 'Past:'}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {DATE_PRESETS.map(({ label, days }) => {
                  const direction = tab === 'fixtures' ? 'future' : 'past';
                  const active = isPresetActive(filters, days, direction);
                  return (
                    <button
                      key={days}
                      onClick={() => applyPreset(days, direction)}
                      type="button"
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                        ${active
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
                {tab === 'fixtures' && (
                  <button
                    onClick={() => setShowPastFixtures((v) => !v)}
                    type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                      ${showPastFixtures
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    Show past
                  </button>
                )}
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  type="button"
                  className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Category filter — statistics only */}
          {tab === 'statistics' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-medium">Category:</span>
              <div className="flex gap-1.5 flex-wrap">
                {STAT_CATEGORIES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setStatsCategory(key)}
                    type="button"
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                      ${statsCategory === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  type="button"
                  className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear filters
                </button>
              )}
            </div>
          )}

          {(tab === 'ladder') && hasActiveFilters && (
            <button
              onClick={clearFilters}
              type="button"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-4">

        {/* ── FIXTURES TAB ── */}
        {tab === 'fixtures' && (
          <>
            {fixtureError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">
                Error loading fixtures: {fixtureError}
              </div>
            )}
            {!fixtureData && !fixtureError && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Loading fixtures…</p>
              </div>
            )}
            {fixtureData && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    {hasActiveFilters ? (
                      <>
                        <span className="font-semibold text-gray-800">{upcomingCount}</span>
                        {' upcoming matches'}
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-gray-800">{upcomingCount}</span>
                        {' upcoming across '}
                        <span className="font-semibold text-gray-800">{upcomingByDate.size}</span>
                        {' dates'}
                      </>
                    )}
                  </p>
                  {showExport && (
                    <div className="flex gap-2">
                      <button
                        onClick={exportToCSV}
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CSV
                      </button>
                      <button
                        onClick={exportToICS}
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Calendar
                      </button>
                    </div>
                  )}
                </div>
                {upcomingByDate.size === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">No upcoming matches</p>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="mt-2 text-blue-600 text-sm hover:text-blue-800" type="button">
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {[...upcomingByDate.entries()].map(([dateKey, matches]) => (
                      <section key={dateKey}>
                        <DateDivider startTime={matches[0].startTime} />
                        <div className="space-y-2.5">
                          {matches.map((m) => <MatchCard key={m.id} match={m} appointment={appointmentByMatchId.get(m.id)} />)}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── RESULTS TAB ── */}
        {tab === 'results' && (
          <>
            {fixtureError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">
                Error loading results: {fixtureError}
              </div>
            )}
            {!fixtureData && !fixtureError && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Loading results…</p>
              </div>
            )}
            {fixtureData && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-800">{completedCount}</span>
                    {' results'}
                  </p>
                  {showExport && (
                    <div className="flex gap-2">
                      <button
                        onClick={exportToCSV}
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        CSV
                      </button>
                      <button
                        onClick={exportToICS}
                        type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Calendar
                      </button>
                    </div>
                  )}
                </div>
                {completedByDate.size === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm">No results found</p>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="mt-2 text-blue-600 text-sm hover:text-blue-800" type="button">
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {[...completedByDate.entries()].map(([dateKey, matches]) => (
                      <section key={dateKey}>
                        <DateDivider startTime={matches[0].startTime} />
                        <div className="space-y-2.5">
                          {matches.map((m) => <MatchCard key={m.id} match={m} showEvents appointment={appointmentByMatchId.get(m.id)} />)}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── LADDER TAB ── */}
        {tab === 'ladder' && (
          <>
            {ladderError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">
                Error loading ladder: {ladderError}
              </div>
            )}
            {!ladderData && !ladderError && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Loading ladder…</p>
              </div>
            )}
            {ladderData && (
              <LadderView
                data={ladderData}
                selectedCompetitions={filters.competitions}
                selectedAgeGroups={filters.ageGroups}
              />
            )}
          </>
        )}

        {/* ── STATISTICS TAB ── */}
        {tab === 'statistics' && (
          <>
            {statsError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">
                Error loading statistics: {statsError}
              </div>
            )}
            {!statsData && !statsError && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Loading statistics…</p>
              </div>
            )}
            {statsData && (
              <StatsView
                key={statsCategory}
                data={statsData}
                category={statsCategory}
                selectedCompetitions={filters.competitions}
                selectedAgeGroups={filters.ageGroups}
                selectedClubs={filters.clubs}
                selectedTeams={filters.teams}
              />
            )}
          </>
        )}
      </main>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  );
}
