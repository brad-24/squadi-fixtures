'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadFixtures } from '@/lib/squadi';
import type { Match } from '@/types';
import { formatDateKey } from '@/lib/utils';

// ── helpers ───────────────────────────────────────────────────────────────────

function isWillowburnVenue(m: Match) {
  return (m.venueCourt?.venue?.name ?? '').toLowerCase().includes('willowburn');
}

function willowburnTeam(m: Match): string | null {
  if (m.club1.toLowerCase().includes('willowburn')) return m.team1.name;
  if (m.club2.toLowerCase().includes('willowburn')) return m.team2.name;
  return null;
}

function opponent(m: Match): string {
  return m.club1.toLowerCase().includes('willowburn') ? m.team2.name : m.team1.name;
}

// Brisbane is UTC+10, no DST — always a fixed 600-minute offset
function toBrisbaneMins(utcString: string): number {
  const d = new Date(utcString);
  return ((d.getUTCHours() * 60 + d.getUTCMinutes()) + 600) % 1440;
}

function fmtMins(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
}

// Senior teams need to be in canteen 90 mins before kick-off (1 hour warm-up after).
// Junior teams need 30 mins before. Slot is always 30 mins wide.
function isSenior(m: Match): boolean {
  return !/^U\d/i.test(m.ageGroup);
}

function canteenSlot(gameMins: number, senior: boolean): number {
  const offset = senior ? 90 : 30;
  return gameMins - (gameMins % 30) - offset;
}

function saturdayOf(dateKey: string): string {
  const [y, mo, d] = dateKey.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  if (date.getDay() === 0) {
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('en-CA');
  }
  return dateKey;
}

function formatDayLabel(dateKey: string): string {
  const [y, mo, d] = dateKey.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatWeekendOption(satKey: string): string {
  const [y, mo, d] = satKey.split('-').map(Number);
  const sat = new Date(y, mo - 1, d);
  const sun = new Date(y, mo - 1, d + 1);
  const fmt = (dt: Date) => dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  return `${fmt(sat)} / ${fmt(sun)} ${y}`;
}

// ── types ─────────────────────────────────────────────────────────────────────

type SlotRow = {
  slotStart: number;
  teams: Array<{ teamName: string; opponentName: string; gameMins: number; senior: boolean }>;
};

type DayRoster = { dateKey: string; slots: SlotRow[] };
type Weekend = { satKey: string; label: string; days: DayRoster[] };

// ── page ──────────────────────────────────────────────────────────────────────

export default function CanteenRosterPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedWeekend, setSelectedWeekend] = useState('');
  const [volunteers, setVolunteers] = useState<Record<string, string>>({});

  useEffect(() => {
    loadFixtures()
      .then((d) => setMatches(d.allMatches))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Persist volunteer names across page refreshes
  useEffect(() => {
    const saved = localStorage.getItem('canteen-volunteers');
    if (saved) try { setVolunteers(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (Object.keys(volunteers).length) {
      localStorage.setItem('canteen-volunteers', JSON.stringify(volunteers));
    }
  }, [volunteers]);

  const weekends = useMemo((): Weekend[] => {
    // Separate maps: all venue matches for slot coverage; Willowburn-only for assignments
    const allVenueByDate = new Map<string, Match[]>();
    const willowburnByDate = new Map<string, Match[]>();
    for (const m of matches) {
      if (!isWillowburnVenue(m)) continue;
      const dk = formatDateKey(m.startTime);
      const dow = new Date(dk).getDay();
      if (dow !== 0 && dow !== 6) continue;
      if (!allVenueByDate.has(dk)) allVenueByDate.set(dk, []);
      allVenueByDate.get(dk)!.push(m);
      if (willowburnTeam(m)) {
        if (!willowburnByDate.has(dk)) willowburnByDate.set(dk, []);
        willowburnByDate.get(dk)!.push(m);
      }
    }

    // Only show days that have at least one Willowburn match
    const dayRosters: DayRoster[] = [...willowburnByDate.keys()]
      .sort()
      .map((dateKey) => {
        const allDay = allVenueByDate.get(dateKey) ?? [];
        const wbDay = willowburnByDate.get(dateKey) ?? [];

        // Build Willowburn assignments keyed by their canteen slot
        const assignments = new Map<number, SlotRow['teams']>();
        for (const m of wbDay) {
          const gameMins = toBrisbaneMins(m.startTime);
          const senior = isSenior(m);
          const slot = canteenSlot(gameMins, senior);
          if (!assignments.has(slot)) assignments.set(slot, []);
          assignments.get(slot)!.push({
            teamName: willowburnTeam(m)!,
            opponentName: opponent(m),
            gameMins,
            senior,
          });
        }

        // All coverage slots: 30 min before every game at the venue + Willowburn-specific slots
        const allSlots = new Set<number>();
        for (const m of allDay) {
          allSlots.add(canteenSlot(toBrisbaneMins(m.startTime), false));
        }
        for (const slot of assignments.keys()) {
          allSlots.add(slot);
        }

        const slots: SlotRow[] = [...allSlots]
          .sort((a, b) => a - b)
          .map((slotStart) => ({
            slotStart,
            teams: assignments.get(slotStart) ?? [],
          }));
        return { dateKey, slots };
      });

    const weekendMap = new Map<string, DayRoster[]>();
    for (const day of dayRosters) {
      const satKey = saturdayOf(day.dateKey);
      if (!weekendMap.has(satKey)) weekendMap.set(satKey, []);
      weekendMap.get(satKey)!.push(day);
    }

    return [...weekendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([satKey, days]) => ({
        satKey,
        label: formatWeekendOption(satKey),
        days: days.sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
      }));
  }, [matches]);

  // Default to nearest upcoming weekend
  useEffect(() => {
    if (!weekends.length || selectedWeekend) return;
    const today = new Date().toLocaleDateString('en-CA');
    const next = weekends.find((w) => w.satKey >= today) ?? weekends[weekends.length - 1];
    setSelectedWeekend(next.satKey);
  }, [weekends, selectedWeekend]);

  const currentWeekend = weekends.find((w) => w.satKey === selectedWeekend);

  function vKey(dateKey: string, slotStart: number, idx: 0 | 1) {
    return `${dateKey}:${slotStart}:${idx}`;
  }

  function setVol(key: string, val: string) {
    setVolunteers((prev) => ({ ...prev, [key]: val }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading fixtures…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Error loading fixtures: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 print:px-0 print:py-0">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 print:text-xl">Canteen Roster</h1>
          <p className="text-sm text-gray-500 mt-0.5">Commonwealth Oval — Willowburn FC</p>
          {/* Show selected weekend in print */}
          {currentWeekend && (
            <p className="hidden print:block text-sm text-gray-600 mt-1">{currentWeekend.label}</p>
          )}
        </div>
        <button
          onClick={() => window.print()}
          type="button"
          className="print:hidden flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print roster
        </button>
      </div>

      {weekends.length === 0 ? (
        <p className="text-gray-500 text-sm">No Willowburn home games found.</p>
      ) : (
        <>
          {/* Weekend selector */}
          <div className="mb-6 print:hidden">
            <label className="block text-sm font-medium text-gray-700 mb-1">Weekend</label>
            <select
              value={selectedWeekend}
              onChange={(e) => setSelectedWeekend(e.target.value)}
              className="w-full sm:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:border-blue-500"
            >
              {weekends.map((w) => (
                <option key={w.satKey} value={w.satKey}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* Roster for each day */}
          {currentWeekend?.days.map((day) => (
            <div key={day.dateKey} className="mb-8 print:mb-6">
              <h2 className="text-base font-bold text-gray-800 mb-3 pb-1 border-b border-gray-200">
                {formatDayLabel(day.dateKey)}
              </h2>

              {day.slots.length === 0 ? (
                <p className="text-gray-400 text-sm">No canteen slots for this day.</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border border-gray-200 w-36">
                        Time slot
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border border-gray-200">
                        Responsible team
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border border-gray-200 w-36">
                        Volunteer 1
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-gray-600 border border-gray-200 w-36">
                        Volunteer 2
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.slots.map((slot) => (
                      <tr key={slot.slotStart} className="even:bg-gray-50/50">
                        <td className="px-3 py-2.5 border border-gray-200 font-medium text-gray-800 whitespace-nowrap align-top">
                          {fmtMins(slot.slotStart)} – {fmtMins(slot.slotStart + 30)}
                        </td>
                        <td className="px-3 py-2.5 border border-gray-200 align-top">
                          {slot.teams.length === 0 ? (
                            <span className="text-gray-400 italic text-sm">Volunteer required</span>
                          ) : slot.teams.map((t, i) => (
                            <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-gray-100' : ''}>
                              <div className="font-medium text-gray-800">{t.teamName}</div>
                              <div className="text-xs text-gray-400 mt-0.5">vs {t.opponentName}</div>
                              <div className="text-xs text-gray-400">Kick Off - {fmtMins(t.gameMins)}</div>
                            </div>
                          ))}
                        </td>
                        {([0, 1] as const).map((idx) => (
                          <td key={idx} className="px-2 py-2 border border-gray-200 align-top">
                            <input
                              type="text"
                              value={volunteers[vKey(day.dateKey, slot.slotStart, idx)] ?? ''}
                              onChange={(e) => setVol(vKey(day.dateKey, slot.slotStart, idx), e.target.value)}
                              placeholder="Name"
                              className="w-full px-2 py-1 rounded border border-gray-200 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-blue-500 print:border-0 print:border-b print:border-gray-400 print:rounded-none print:bg-transparent print:px-0"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
