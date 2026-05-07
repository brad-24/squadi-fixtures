import { NextResponse } from 'next/server';
import type { Appointment } from '@/types';

const APPOINTMENTS_URL = 'https://api.squadi.com/livescores/public/appointments';
const COMMON_HEADERS = {
  'Origin': 'https://registration.squadi.com',
  'Referer': 'https://registration.squadi.com/',
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const PAYLOAD = {
  yearRefId: 8,
  organisationUniqueKey: '78a14e91-3dbc-4b51-a52d-f5642854e8ee',
  competitionIds: [],
  venueIds: [],
  fieldIds: [],
  ageGroupIds: [],
  appointmentStatus: '',
  dateFrom: null,
  dateTo: null,
  page: 1,
  limit: 2000,
};

function isAppointed(umpires: { sequence: number; status: string }[], seq: number): boolean {
  return umpires.find((u) => u.sequence === seq)?.status === 'appointed';
}

export async function GET(_request: Request) {
  try {
    const res = await fetch(APPOINTMENTS_URL, {
      method: 'POST',
      headers: COMMON_HEADERS,
      body: JSON.stringify(PAYLOAD),
      cache: 'no-store',
    });

    if (!res.ok) return NextResponse.json([]);

    const json = await res.json();
    const items: { matchId: number; umpires: { sequence: number; status: string }[] }[] =
      Array.isArray(json.data) ? json.data : [];

    const appointments: Appointment[] = items.map((item) => ({
      matchId: item.matchId,
      ref: isAppointed(item.umpires, 1),
      ar1: isAppointed(item.umpires, 2),
      ar2: isAppointed(item.umpires, 3),
    }));

    return NextResponse.json(appointments, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Appointments API error:', err);
    return NextResponse.json([]);
  }
}
