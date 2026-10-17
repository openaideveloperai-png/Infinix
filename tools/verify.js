#!/usr/bin/env node
'use strict';
// Runs the bot over a matrix of rooms and difficulties, 4 at a time.
//
//   node tools/verify.js --rooms 10-20 --targets 60,88,max [--time 300] [--jobs 4] [--out dir]
//
// A target is a difficulty d to test at (the death count is solved from the formula),
// or "max" for an endgame save (2000 deaths: d ~ 100, PpR = 1 px).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const [r0, r1] = (args.rooms || '1-20').split('-').map(Number);
const targets = (args.targets || '60,88,max').split(',');
const TIME = +(args.time || 300), JOBS = +(args.jobs || 4), SEED = +(args.seed || 1);
const OUT = args.out || path.join(__dirname, '..', 'verify-results');
fs.mkdirSync(OUT, { recursive: true });

// x = 50 * log2(99 / (100 - d)), D = x - L
const deathsFor = (L, t) => (t === 'max' ? 2000 : Math.max(0, Math.round(50 * Math.log2(99 / (100 - Number(t))) - L)));
const jobs = [];
for (let L = r0; L <= (r1 || r0); L++) for (const t of targets) jobs.push({ L, t, D: deathsFor(L, t) });

let next = 0, running = 0;
const results = [];
function launch() {
  while (running < JOBS && next < jobs.length) {
    const j = jobs[next++];
    running++;
    const file = path.join(OUT, `room${j.L}_${j.t}.json`);
    const p = spawn(process.execPath, [path.join(__dirname, 'bot.js'), '--room', j.L, '--D', j.D, '--seed', SEED, '--time', TIME, '--out', file]);
    let buf = '';
    p.stdout.on('data', d => { buf += d; });
    p.stderr.on('data', d => process.stderr.write(d));
    p.on('close', () => {
      running--;
      try { const r = JSON.parse(buf.trim().split('\n').pop()); r.target = j.t; results.push(r); print(r); }
      catch (e) { console.log(`room ${j.L} @${j.t}: CRASHED`); results.push({ room: j.L, target: j.t, crashed: true }); }
      if (next >= jobs.length && running === 0) finish(); else launch();
    });
  }
}
function print(r) {
  console.log(`room ${String(r.room).padStart(2)} ${r.name.padEnd(10)} d=${String(r.d).padEnd(6)} ` +
    `${r.solved ? 'BEATEN ' : 'not yet'} in ${r.wallSeconds}s  coins ${r.maxCoins}/${r.coinsTotal}  ` +
    `${r.solved ? 'run ' + r.gameSeconds + 's' : 'closest ' + r.bestRemainingTiles + ' tiles'}`);
}
function finish() {
  results.sort((a, b) => a.room - b.room || String(a.target).localeCompare(String(b.target)));
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 1));
  const ok = results.filter(r => r.solved).length;
  console.log(`\n${ok}/${results.length} runs beaten. Details in ${OUT}`);
}
launch();
