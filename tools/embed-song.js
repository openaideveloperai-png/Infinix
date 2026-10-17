#!/usr/bin/env node
// Embeds a song into index.html so the game stays a single file.
//
//   node tools/embed-song.js path/to/song.mp3 [beatSeconds beatsPerLoop]
//
// With beatSeconds and beatsPerLoop the game loops the song on a bar line
// (first audible sample + beats * beatSeconds) with a short crossfade.
// Without them it loops the whole song.
'use strict';
const fs = require('fs');
const path = require('path');

const [song, beat, beats] = process.argv.slice(2);
if (!song) { console.error('usage: node tools/embed-song.js song.mp3 [beatSeconds beatsPerLoop]'); process.exit(1); }
const index = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(index, 'utf8');
const b64 = fs.readFileSync(song).toString('base64');
const attrs = beat && beats ? ` data-beat="${Number(beat)}" data-beats="${Number(beats)}"` : '';
const block = `<script type="text/plain" id="song-data"${attrs}>${b64}</script>`;
const re = /<script type="text\/plain" id="song-data"[^>]*>[\s\S]*?<\/script>/;
if (re.test(html)) html = html.replace(re, () => block);
else html = html.replace('</body>', () => block + '\n</body>');
fs.writeFileSync(index, html);
console.log(`embedded ${path.basename(song)} (${(b64.length / 1024).toFixed(0)} KB base64)${attrs ? ', bar-aligned loop' : ', whole-song loop'}`);
