// All Darling Downs competitions: [uniqueKey, integer id]
export const COMPETITIONS: [string, number][] = [
  ['1e6ec610-7f27-4d97-bc8e-7908ad58188c', 1387], // MiniRoos & Under 12
  ['916e5242-4969-4502-bfbc-ab8568341156', 1299], // Community Juniors
  ['94bcdbcb-36a1-4cd4-bdc3-a260f1c1ed58', 1331], // Community Seniors
  ['820aef84-2603-43b7-bece-dbe5894d331f', 1281], // FQPL 3 Men
  ['2c424449-2684-4297-af3e-02b0e7f208a2', 1284], // FQPL 3 Women
  ['318866de-37e3-420d-87a6-3fc821e2ecba', 1557], // T2 Girls United League
];

export const SQUADI_BASE = 'https://api.squadi.com/livescores';
export const SQUADI_ORIGIN = 'https://registration.squadi.com';

export const SQUADI_HEADERS = {
  Origin: SQUADI_ORIGIN,
  Referer: `${SQUADI_ORIGIN}/`,
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
