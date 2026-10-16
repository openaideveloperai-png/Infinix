# Infinix

A game in the style of *The World's Hardest Game*, built to be harder.
You are the red square. Take every yellow coin, reach the green exit, and don't touch a blue circle.

Open `index.html` in any browser. No install or build step.

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| Shift (or Space) | Precise movement (30% speed) for pixel-perfect gaps |
| P / Esc | Pause |
| F | Show the formula with live values |
| V | Toggle AI vision (where enemies expect you to be + what they learned) |
| M | Music on/off |

On touch screens, drag anywhere to move. A short drag moves slowly.

Progress (room, deaths and what the enemies have learned) is saved in the browser.

## Rooms

| # | Name | What's new |
| --- | --- | --- |
| 1 | Entrance | Classic up/down enemies |
| 2 | Lanes | Horizontal lanes and coins |
| 3 | Orbit | Rotating crosses and orbiters |
| 4 | Watchers | Rail enemies that slide to where you will cross |
| 5 | Crossfire | Rails from every side and a checkpoint |
| 6 | Hunted | Free hunters that predict your movement |
| 7 | Pack | Hunters that work together (chase, cut off, flank) |
| 8 | The Wall | A wall whose gap opens where you are not |
| 9 | Memory | Sentries that guard the routes you used before |
| 10 | Infinix | A ring around the exit whose gap turns away from you |

After room 10 the rooms loop forever (mirrored each loop). The level number keeps counting, so the game keeps getting harder.

## The difficulty formula

```
L = level, D = deaths, x = L + D
d   = 1 + 99 · (1 − 0.5^(x/50))            approaches 100, never reaches it
PpR = max(20 · 0.5^(d − 90), 1)            only once d ≥ 90
```

- `d` sets enemy speed, reaction time, how far ahead they predict you, and patrol speed.
- `PpR` is the gap the AI enemies must leave you: between two hunters, around safe zones and coins, and the opening in walls and rings. Before `d = 90` the gap is 20 px. After that it halves as `d` rises, down to 1 px.
- Enemies learn from every death through a heat map of where you go and where you die. Hunters lean toward your habits, sentries guard your favourite routes, and walls avoid your favourite crossing. Learning stops when `PpR` reaches 1 px (`d ≈ 94.32`).
- AI enemies are always slower than you, and every gap is at least your size + 1 px, so a path always exists.

## Music

The soundtrack is generated live in the browser from plain oscillators, like a song made on a graphing calculator: sine arpeggios, a rolling bass, a 4/4 kick and a Shepard tone that seems to rise forever. New layers come in as you go deeper. Once `d` passes 90, glitchy calculator beeps join in. The small graph in the corner shows the live waveform.
