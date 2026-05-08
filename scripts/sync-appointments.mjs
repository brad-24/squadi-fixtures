#!/usr/bin/env node
// Run from your local machine (residential IP not blocked by Squadi):
//   node scripts/sync-appointments.mjs
// Or via npm:
//   npm run sync:appointments

import { createWriteStream } from 'fs';
import { writeFile } from 'fs/promises';
import https from 'https';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../public/appointments.json');

const payload = JSON.stringify({
  yearRefId: 8,
  organisationUniqueKey: '78a14e91-3dbc-4b51-a52d-f5642854e8ee',
  competitionIds: [], venueIds: [], fieldIds: [], ageGroupIds: [],
  appointmentStatus: '', dateFrom: null, dateTo: null,
  page: 1, limit: 2000,
});

function post() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.squadi.com',
      port: 443,
      path: '/livescores/public/appointments',
      method: 'POST',
      headers: {
        'Origin': 'https://registration.squadi.com',
        'Referer': 'https://registration.squadi.com/',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Squadi returned ${res.statusCode}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

console.log('Fetching appointments from Squadi…');
const json = await post();
const items = Array.isArray(json.data) ? json.data : [];
const appointments = items.map((item) => ({
  matchId: item.matchId,
  ref: item.umpires?.find((u) => u.sequence === 1)?.status === 'appointed' ?? false,
  ar1: item.umpires?.find((u) => u.sequence === 2)?.status === 'appointed' ?? false,
  ar2: item.umpires?.find((u) => u.sequence === 3)?.status === 'appointed' ?? false,
}));

await writeFile(OUT, JSON.stringify(appointments));
console.log(`Saved ${appointments.length} appointments to public/appointments.json`);

if (process.env.GIT_PUSH === 'false') {
  console.log('GIT_PUSH=false — skipping git (workflow will handle it).');
} else {
  try {
    execSync('git add public/appointments.json', { cwd: join(__dirname, '..') });
    execSync('git diff --staged --quiet || git commit -m "chore: sync appointments data"', {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
    });
    execSync('git push', { cwd: join(__dirname, '..'), stdio: 'inherit' });
    console.log('Pushed to GitHub — Vercel will redeploy automatically.');
  } catch {
    console.log('Git push failed — check your credentials. File was saved locally.');
  }
}
