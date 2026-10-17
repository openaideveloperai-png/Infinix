#!/usr/bin/env node
'use strict';
// Proves a room is beatable by finding a full winning run with the real game code.
//
//   node tools/bot.js --room 10 --D 120 [--seed 1] [--time 240] [--out result.json] [--heat heat.json]
//
// Method (Go-Explore): keep an archive of distinct situations (position cell + coins
// held + checkpoint), each with an exact snapshot of the whole game. Repeatedly pick a
// promising one, restore it, and try random moves from there. New situations join the
// archive. A win is replayed from the start on a fresh copy of the game to confirm it.
const fs = require('fs');
const { createSim } = require('./sim');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const ROOM = +(args.room || 1);         // level number L (1..20 for the first loop)
const DEATHS = +(args.D || 0);
const SEED = +(args.seed || 1);
const TIME = +(args.time || 240);
const OUT = args.out;
const HEAT = args.heat ? JSON.parse(fs.readFileSync(args.heat, 'utf8')) : null;

let rs = (SEED * 2654435761) >>> 0 || 7;          // the bot's own randomness (not the game's)
const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };

const sim = createSim({ seed: SEED });
const { G, I } = sim;
sim.start(ROOM, DEATHS, HEAT);
const lv = G.level;
const COLS = 25, ROWS = 14, NC = COLS * ROWS, TILE = 40, W = 1000;

// ---------- distance fields (in tiles) for the heuristic
function field(targets) {
  const d = new Int32Array(NC).fill(-1), q = [];
  for (const t of targets) if (t >= 0 && lv.walk[t] && d[t] < 0) { d[t] = 0; q.push(t); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], c = i % COLS, r = (i / COLS) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nc = c + dc; const nr = r + dr;
      if (lv.wrap) nc = (nc + COLS) % COLS;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const n = nr * COLS + nc;
      if (lv.walk[n] && d[n] < 0) { d[n] = d[i] + 1; q.push(n); }
    }
  }
  return d;
}
const coinCells = lv.coins.map(k => lv.cellIndex(k.x, k.y));
const coinField = coinCells.map(c => field([c]));
const exitCells = [];
for (let i = 0; i < NC; i++) if (lv.zone[i] === 2) exitCells.push(i);
const exitField = field(exitCells);
const big = 999;
const dval = (f, i) => (i >= 0 && f[i] >= 0 ? f[i] : big);

function stateKey() {
  const p = G.player;
  let m = 0;
  G.level.coins.forEach((k, j) => { if (k.taken) m |= 1 << j; });
  return m + '|' + G.cpGroup + '|' + ((p.x / 16) | 0) + ',' + ((p.y / 16) | 0);
}
// heuristic: greedy tour length (in tiles) from here through the coins left to the exit
function score() {
  const p = G.player, cell = G.level.cellIndex(p.x, p.y);
  let total = 0, taken = 0;
  const coins = G.level.coins;
  const left = [];
  coins.forEach((k, j) => { if (k.taken) taken++; else left.push(j); });
  let cur = cell, ff = null;
  while (left.length) {
    let bj = -1, bd = Infinity;
    for (const j of left) { const dd = ff ? dval(ff, coinCells[j]) : dval(coinField[j], cur); if (dd < bd) { bd = dd; bj = j; } }
    total += bd; cur = coinCells[bj]; ff = coinField[bj]; left.splice(left.indexOf(bj), 1);
  }
  total += ff ? dval(exitField, cur) : dval(exitField, cell);
  return -total + taken * 0.5;
}

// ---------- archive
const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const archive = new Map();
const root = { key: stateKey(), snap: sim.snapshot(), score: score(), t: 0, chosen: 0, parent: null, acts: [] };
archive.set(root.key, root);
let best = root.score;
const deaths = new Map();
let iters = 0, solution = null, maxCoins = 0;
const t0 = Date.now();
const ppr = G.ai.ppr;

function pick() {
  const nodes = [...archive.values()];
  if (rnd() < 0.15) return nodes[(rnd() * nodes.length) | 0];
  let tot = 0;
  const w = nodes.map(n => { const v = Math.exp((n.score - best) / 5) / Math.sqrt(1 + n.chosen); tot += v; return v; });
  let r = rnd() * tot;
  for (let i = 0; i < nodes.length; i++) { r -= w[i]; if (r <= 0) return nodes[i]; }
  return nodes[nodes.length - 1];
}
function chain(node) {
  const out = [];
  for (let n = node; n; n = n.parent) out.push(n.acts);
  return out.reverse().flat();
}

while (!solution && (Date.now() - t0) / 1000 < TIME) {
  iters++;
  const start = pick();
  start.chosen++;
  sim.restore(start.snap);
  let cur = start, acts = [], last = DIRS[(rnd() * 9) | 0], slow = false;
  const chunks = 8 + ((rnd() * 30) | 0);
  for (let c = 0; c < chunks; c++) {
    if (rnd() > 0.65) {
      last = rnd() < 0.16 ? DIRS[0] : DIRS[1 + ((rnd() * 8) | 0)];
      slow = rnd() < (ppr !== null ? 0.3 : 0.1);
    }
    const n = rnd() < 0.15 ? 1 + ((rnd() * 3) | 0) : 4 + ((rnd() * 26) | 0);
    sim.input(last[0], last[1], slow);
    const ran = sim.step(n);
    acts.push([last[0], last[1], slow ? 1 : 0, ran]);
    if (G.simWin) { solution = chain(cur).concat(acts); break; }
    if (G.simDead) {
      const k = ((G.player.x / 40) | 0) + ',' + ((G.player.y / 40) | 0);
      deaths.set(k, (deaths.get(k) || 0) + 1);
      break;
    }
    const key = stateKey(), ex = archive.get(key);
    if (!ex || G.time < ex.t - 0.05) {
      const node = { key, snap: sim.snapshot(), score: score(), t: G.time, chosen: ex ? ex.chosen : 0, parent: cur, acts };
      archive.set(key, node);
      if (node.score > best) best = node.score;
      let taken = 0; G.level.coins.forEach(k => { if (k.taken) taken++; });
      if (taken > maxCoins) maxCoins = taken;
      cur = node; acts = [];
    }
  }
}

// ---------- confirm on a fresh game
let replayOk = false, replayTime = 0;
if (solution) {
  const check = createSim({ seed: SEED });
  check.start(ROOM, DEATHS, HEAT);
  for (const [x, y, s, n] of solution) {
    check.input(x, y, s);
    check.step(n);
    if (check.G.simWin || check.G.simDead) break;
  }
  replayOk = !!check.G.simWin && !check.G.simDead;
  replayTime = check.G.time;
}
const topDeaths = [...deaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  .map(([k, v]) => { const [c, r] = k.split(',').map(Number); return { x: c * 40 + 20, y: r * 40 + 20, n: v }; });
const result = {
  room: ROOM, name: I.LEVELS[(ROOM - 1) % I.LEVELS.length].name, D: DEATHS, seed: SEED,
  d: +G.ai.d.toFixed(2), ppr: ppr === null ? null : +ppr.toFixed(2),
  solved: replayOk, foundRun: !!solution, gameSeconds: +replayTime.toFixed(1),
  wallSeconds: +((Date.now() - t0) / 1000).toFixed(1), iterations: iters, archive: archive.size,
  coinsTotal: lv.coins.length, maxCoins, bestRemainingTiles: +(-best).toFixed(1), topDeaths,
};
console.log(JSON.stringify(result));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ ...result, actions: replayOk ? solution : null }, null, 0));
