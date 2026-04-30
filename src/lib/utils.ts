export function extractAgeGroup(divisionName: string): string {
  const m = divisionName.match(/\bU(\d{1,2}(?:\/\d{2})?)\b/i)
    || divisionName.match(/\bUnder\s*(\d{1,2}(?:\/\d{2})?)\b/i);
  if (m) return `U${m[1]}`;
  return divisionName;
}

// Words that identify the team within a club (colours, gemstones, mascot names)
// When one of these is the last word before the age group, strip it to get the club.
const TEAM_NAME_WORDS = new Set([
  'white', 'black', 'red', 'blue', 'green', 'gold', 'maroon', 'purple',
  'orange', 'yellow', 'pink', 'silver', 'teal', 'navy',
  'sapphires', 'emeralds', 'rubies', 'diamonds', 'topaz',
  'viqueens', 'lionesses', 'pinkbacks', 'redbacks',
  'bears', 'hawks', 'eagles', 'rovers', 'stingrays', 'sharks',
  'a', 'b', 'c', '1', '2', '3', '4',
]);

export function extractClub(teamName: string): string {
  if (!teamName || teamName.toLowerCase() === 'bye') return '';
  // Strip everything from the age group marker onward
  const beforeAge = teamName.replace(/\s+U\d{1,2}(?:\/\d{2})?.*/i, '').trim();
  const words = beforeAge.split(' ').filter(Boolean);
  if (words.length <= 1) return words[0] ?? teamName;
  // Only drop the last word if it's a known team-identifier word
  const lastWord = words[words.length - 1].toLowerCase();
  if (TEAM_NAME_WORDS.has(lastWord)) {
    return words.slice(0, -1).join(' ');
  }
  return beforeAge;
}

export function formatMatchTime(utcString: string): string {
  const date = new Date(utcString);
  return date.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Brisbane',
  });
}

export function formatMatchDate(utcString: string): string {
  const date = new Date(utcString);
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Brisbane',
  });
}

export function formatDateKey(utcString: string): string {
  const date = new Date(utcString);
  return date.toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }); // YYYY-MM-DD
}

export function getStatusLabel(status: string | null): string {
  if (!status) return 'Upcoming';
  switch (status.toUpperCase()) {
    case 'ENDED': return 'Final';
    case 'STARTED': return 'Live';
    case 'PAUSED': return 'Paused';
    default: return status;
  }
}

export function getStatusClasses(status: string | null): string {
  if (!status) return 'bg-blue-100 text-blue-700';
  switch (status.toUpperCase()) {
    case 'ENDED': return 'bg-gray-100 text-gray-600';
    case 'STARTED': return 'bg-green-100 text-green-700 animate-pulse';
    default: return 'bg-blue-100 text-blue-700';
  }
}
