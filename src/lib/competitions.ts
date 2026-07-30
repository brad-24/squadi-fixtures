// All Darling Downs competitions: [uniqueKey, integer id]
export const COMPETITIONS: [string, number][] = [
  ['1e6ec610-7f27-4d97-bc8e-7908ad58188c', 1387], // MiniRoos & Under 12
  ['916e5242-4969-4502-bfbc-ab8568341156', 1299], // Community Juniors
  ['94bcdbcb-36a1-4cd4-bdc3-a260f1c1ed58', 1331], // Community Seniors
  ['820aef84-2603-43b7-bece-dbe5894d331f', 1281], // FQPL 3 Men
  ['2c424449-2684-4297-af3e-02b0e7f208a2', 1284], // FQPL 3 Women
  ['318866de-37e3-420d-87a6-3fc821e2ecba', 1557], // T2 Girls United League
  ['db4be8da-70fc-40a0-a61c-6740f591151c', 1253], // FQPL 5 Metro Men
  ['75c83158-d8dd-4ffb-a64c-523788a053c6', 1685], // T3 Girls United League
];

// MiniRoos & Under 12 — no individual events tracked and no officials appointed
export const MINIROOS_COMPETITION_ID = 1387;

// The appointments feed is scoped to one organisation per request, and a
// competition's appointments only come back under the organisation that runs it.
// Three of the competitions above are run by someone other than Darling Downs:
//
//   organisationId 112 — everything except the three below (Darling Downs)
//   organisationId   8 — FQPL 5 Metro Men (1253)
//   organisationId 569 — T2 and T3 Girls United League (1557, 1685), not currently displayed
//   organisationId   7 — Queensland Cup (1330), not currently displayed
//
// A competition whose organisation is missing from this list returns no records
// at all, which the Club Refs tab reports as uncovered rather than unassigned.
export const APPOINTMENT_ORGANISATIONS: string[] = [
  '78a14e91-3dbc-4b51-a52d-f5642854e8ee', // organisationId 112 — FQ Darling Downs
  '74f39f3a-6e73-48a8-b837-705aba4c4512', // organisationId 7 — the org behind Queensland Cup
  'b0e92958-980b-4da0-9ec9-a9c2597b06f0', // organisationId 8 — FQPL 5 Metro Men
];

export const SQUADI_BASE = 'https://api.squadi.com/livescores';
export const SQUADI_ORIGIN = 'https://registration.squadi.com';

export const SQUADI_HEADERS = {
  Origin: SQUADI_ORIGIN,
  Referer: `${SQUADI_ORIGIN}/`,
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
