export function extractAgeGroup(divisionName: string): string {
  const m = divisionName.match(/\bU(\d{1,2}(?:\/\d{2})?)\b/i)
    || divisionName.match(/\bUnder\s*(\d{1,2}(?:\/\d{2})?)\b/i);
  if (m) return `U${m[1]}`;
  return divisionName;
}

// Suffixes that appear after the club name — stripped right-to-left until stable
const TRAILING_SUFFIXES = [
  /\s+FQPL\s*3?\s*$/i,
  /\s+Div(?:ision)?\s*\d+\s*$/i,
  /\s+(?:Men|Women|Girls|Boys)\s*$/i,
  /\s+Seniors?\s*$/i,
  /\s+Juniors?\s*$/i,
  /\s+JL\s*$/i,
  /\s+A?FC\s*$/i,
  /\s+SC\s*$/i,
];

// Words that identify the specific team/colour/mascot within a club.
// Stripped (up to twice) from the right after all other cleaning.
const TEAM_WORDS = new Set([
  // colours
  'white', 'black', 'red', 'blue', 'green', 'gold', 'maroon', 'purple',
  'orange', 'yellow', 'pink', 'silver', 'teal', 'navy', 'grey', 'gray',
  // gemstones / feminine nicknames
  'sapphires', 'emeralds', 'rubies', 'diamonds',
  'viqueens', 'lionesses', 'pinkbacks',
  // animal mascots / team names that are NOT standalone club names
  'grizzlies', 'honeybears', 'cougars', 'polar',
  'redbacks', 'rovers', 'raiders', 'wolves', 'vikings', 'panthers',
  'hazards', 'tigers', 'lions', 'eagles', 'stingrays', 'sharks',
  'bears', 'cubs',
]);

export function extractClub(teamName: string): string {
  if (!teamName || /^bye$/i.test(teamName.trim())) return '';

  let name = teamName.trim();

  // 1. Strip from any age-group marker onward (handles "U13 Girls", "Under 6 Blue Cubs", etc.)
  name = name.replace(/\s+(?:Under\s*\d+|U\s*\d{1,2}(?:\/\d{2})?)\b.*/i, '').trim();

  // 2. Repeatedly strip known trailing competition/grade/gender tokens
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of TRAILING_SUFFIXES) {
      const next = name.replace(re, '').trim();
      if (next !== name) { name = next; changed = true; }
    }
  }

  // 3. Strip known team-identifier words from the right (up to 2 passes for compound mascots)
  for (let i = 0; i < 2; i++) {
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length <= 1) break;
    if (TEAM_WORDS.has(words[words.length - 1].toLowerCase())) {
      name = words.slice(0, -1).join(' ');
    } else {
      break;
    }
  }

  // 4. Normalise known spelling variants
  name = name.replace(/^StAlbans$/i, 'St Albans');

  return name;
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

export function getStatusLabel(status: string | null, startTime?: string): string {
  if (!status) {
    if (startTime && new Date(startTime) <= new Date()) return 'Live';
    return 'Upcoming';
  }
  switch (status.toUpperCase()) {
    case 'ENDED': return 'Final';
    case 'STARTED': return 'Live';
    case 'PAUSED': return 'Paused';
    default: return status;
  }
}

export function getStatusClasses(status: string | null, startTime?: string): string {
  if (!status) {
    if (startTime && new Date(startTime) <= new Date()) return 'bg-green-100 text-green-700 animate-pulse';
    return 'bg-blue-100 text-blue-700';
  }
  switch (status.toUpperCase()) {
    case 'ENDED': return 'bg-gray-100 text-gray-600';
    case 'STARTED': return 'bg-green-100 text-green-700 animate-pulse';
    default: return 'bg-blue-100 text-blue-700';
  }
}
