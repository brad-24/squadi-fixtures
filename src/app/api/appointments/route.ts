import { NextResponse } from 'next/server';
import type { Appointment } from '@/types';

const APPOINTMENTS_URL =
  'https://footballqueensland.com.au/Resources/darling-downs-appointments/';

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDMY(s: string): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function toOfficial(s: string): string | null {
  const t = s.trim();
  return t === '' ? null : t;
}

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get('force') === '1';
  try {
    const res = await fetch(APPOINTMENTS_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      ...(force ? { cache: 'no-store' } : { next: { revalidate: 300 } }),
    });
    const html = await res.text();

    // The appointments are rendered in a single igsv-table (Google Sheets embed)
    const tableMatch = html.match(/<table[^>]*igsv[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return NextResponse.json([]);

    const rows = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    const appointments: Appointment[] = [];

    for (const row of rows) {
      const cells = [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(
        (m) => stripHtml(m[1]),
      );

      if (cells.length < 10) continue;

      // Col layout: Day[0] | Date[1] | Time[2] | Competition[3] | Home[4] |
      //             Away[5] | Venue[6] | Field[7] | Round[8] |
      //             Referee[9] | AR1[10] | AR2[11] | ...
      const date = parseDMY(cells[1]);
      if (!date) continue; // skips header row and metadata rows

      const time = cells[2].trim();
      if (!time) continue;

      appointments.push({
        date,
        time,
        competition: cells[3],
        home: cells[4],
        away: cells[5],
        venue: cells[6],
        referee: toOfficial(cells[9]),
        ar1: toOfficial(cells[10]),
        ar2: toOfficial(cells[11]),
      });
    }

    return NextResponse.json(appointments, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Appointments API error:', err);
    return NextResponse.json([]);
  }
}
