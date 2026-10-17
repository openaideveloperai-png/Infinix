'use strict';
// Runs the real game code from index.html headlessly in Node, for testing.
// Rendering, input and audio are stubbed; physics, enemies and the AI are the
// exact code the browser runs. Randomness is seeded so runs are reproducible,
// and the whole game state can be snapshotted and restored.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const INDEX = path.join(__dirname, '..', 'index.html');

function extractScript(html) {
  const start = html.indexOf('<script>');
  const end = html.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('game script not found in index.html');
  return html.slice(start + '<script>'.length, end);
}

function mulberry(state) {
  return () => {
    let t = (state.s = (state.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deep copy of the game state. Integer typed arrays (level grids, flow fields)
// are never written after creation, so they are shared; float arrays (echo
// buffer, heat) are copied. Level definitions (functions, maps) are shared.
function clone(o, memo) {
  if (o === null || typeof o !== 'object') return o;
  const seen = memo.get(o);
  if (seen !== undefined) return seen;
  if (ArrayBuffer.isView(o)) {
    const tag = Object.prototype.toString.call(o);
    const r = tag.includes('Float') ? o.slice() : o;
    memo.set(o, r);
    return r;
  }
  if (Array.isArray(o)) {
    const r = new Array(o.length);
    memo.set(o, r);
    for (let i = 0; i < o.length; i++) r[i] = clone(o[i], memo);
    return r;
  }
  const r = Object.create(Object.getPrototypeOf(o));
  memo.set(o, r);
  for (const k of Object.keys(o)) r[k] = k === 'def' ? o[k] : clone(o[k], memo);
  return r;
}

const STATE_KEYS = ['level', 'player', 'spawn', 'cpGroup', 'time', 'hunt', 'ai', 'circles',
  'heat', 'heatTmp', 'heatMax', 'heatVer', 'simDead', 'simWin', 'room', 'loop', 'mirrorX', 'mirrorY'];

function createSim(opts = {}) {
  const code = extractScript(fs.readFileSync(opts.index || INDEX, 'utf8'));
  const rng = { s: (opts.seed >>> 0) || 1 };
  const SMath = Object.create(Math);
  SMath.random = mulberry(rng);
  const noop = () => {};
  const ctx2d = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 0 }) : noop),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const mkCanvas = () => ({
    getContext: () => ctx2d, style: {}, width: 0, height: 0, addEventListener: noop, focus: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 640 }), setPointerCapture: noop,
  });
  const canvas = mkCanvas();
  const store = new Map();
  const sandbox = {
    Math: SMath, console, performance: { now: () => 0 },
    requestAnimationFrame: () => 0, setInterval: () => 0, clearInterval: noop, setTimeout: () => 0,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k), clear: () => store.clear(),
    },
    matchMedia: () => ({ matches: false }),
    document: {
      getElementById: id => (id === 'game' ? canvas : id === 'stage' ? { clientWidth: 1000, clientHeight: 640 } : null),
      createElement: () => mkCanvas(), addEventListener: noop, hidden: false,
    },
    innerWidth: 1000, innerHeight: 640, devicePixelRatio: 1, addEventListener: noop,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'index.html' });
  const I = sandbox.INFINIX;
  const G = I.G;

  const sim = {
    I, G, rng,
    // L = level number (1..), D = deaths (sets the difficulty), heat = learned map or null
    start(L, D, heat) {
      I.save.D = D; I.save.heat = {};
      const room = (L - 1) % I.LEVELS.length;
      if (heat) I.save.heat[room] = heat;
      I.startRoom(L);
      G.state = 'play'; G.sim = true; G.msgs.length = 0;
      G.simDead = false; G.simWin = false; G.botInput = { x: 0, y: 0, slow: false };
    },
    input(x, y, slow) { G.botInput = { x, y, slow: !!slow }; },
    step(n) {
      for (let i = 0; i < n; i++) {
        I.physics(1 / 120);
        if (G.simDead || G.simWin) return i + 1;
      }
      return n;
    },
    snapshot() {
      const memo = new Map(), st = {};
      for (const k of STATE_KEYS) st[k] = clone(G[k], memo);
      return { st, rng: rng.s };
    },
    restore(snap) {
      const memo = new Map();
      for (const k of STATE_KEYS) G[k] = clone(snap.st[k], memo);
      rng.s = snap.rng;
    },
  };
  return sim;
}

module.exports = { createSim };
