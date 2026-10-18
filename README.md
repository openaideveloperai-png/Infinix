# Infinix

A game in the style of *The World's Hardest Game*, built to be harder.
You are the red square. Take every yellow coin, reach the green exit, and don't touch a blue circle.

You are Subject 0. You woke up in INFINIX with no memory, and something called the Counter is keeping
track of every time you die. Between the rooms you get your memories back, piece by piece, and fight
the things that keep you in here.

Open `index.html` in any browser. It is a single file (the soundtrack is embedded) with no install or build step.

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| Shift (or Space) | Precise movement (30% speed) for pixel-perfect gaps |
| Q | Time Stop (once you have it): everything freezes for a few seconds, except you |
| E | Blink (once you have it): a short dash in the direction you are moving |
| Space / Enter | Next line of dialogue |
| P / Esc | Pause (settings, the formula, quit) |
| F | Show the formula with live values |
| V | Toggle AI vision (where enemies expect you to be + what they learned) |
| M | Sound on/off |

On touch screens, drag anywhere to move. A short drag moves slowly. Tap a skill in the bottom bar to use it.

Progress (stage, deaths, skills, story and what the enemies have learned) is saved in the browser.

## How a loop is built

One loop is 31 stages in five chapters: 25 rooms, 3 memories and 3 boss fights.

| Stages | |
| --- | --- |
| Rooms 1–5 | Chapter I · Waking |
| Memory · *Before* | A race to the green, with a friend called Dot |
| Rooms 6–10 | Chapter II · The Hunt |
| Boss · **The Warden** | Reward: Time Stop |
| Rooms 11–15 | Chapter III · Equations |
| Memory · *The Count* | The day the numbers came down from the sky |
| Rooms 16–20 | Chapter IV · Recursion |
| Boss · **The Equation** | Reward: Blink |
| Rooms 21–25 | Chapter V · Overflow |
| Memory · *The Promise* | What Dot asked for |
| Boss · **The Counter** | Reward: Second Chance (once per room, a hit is forgiven) |

**Boss fights.** You can't touch a boss, but glowing cores appear around the arena: take one and it strikes the boss.
Each boss has three phases. Dying sends it back to the start of its current phase, not to full health.
Every attack leaves a way through, and bullets vanish at safe zones.

**Memories** are calm, sepia rooms where the story happens. Nothing in them can hurt you until the last one.

**Shards.** Five shards are hidden in the rooms. Each one makes Time Stop last longer and shortens Blink's cooldown,
and each has a line of lore (title screen → MEMORIES). All five unlock a second colour in the settings.

There are more secrets. One of them is under room 20.

## Debug menu

Open SETTINGS (title screen or pause), press **8** eight times, and type **8484** into the box that appears.
The debug menu can jump to any stage of the first three loops, set deaths, turn on god mode and hitboxes,
unlock skills and shards, jump into any part of the secret, set the darkness level, and reset the save.

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
| 8 | The Wall | A wall whose gap mirrors you |
| 9 | Memory | Sentries that guard the routes you used before |
| 10 | Infinix | A ring around the exit. Far away its gap runs from you; up close it turns slowly toward you, and crawls while you slip through |
| 11 | Graph | Enemies trace equations (Lissajous, roses, sine), drawn on the floor like a graphing calculator |
| 12 | Echo | Two echoes of your own path, replayed a few seconds behind you |
| 13 | Looped | The left and right edges connect; lanes of enemies stream around forever |
| 14 | Undertow | Conveyor floors push you while a wall sweeps and hunters chase |
| 15 | Shockwave | Expanding rings with one gap, placed at the edge of where you can reach in time |
| 16 | Serpent | Hunters with bodies that get longer the more you die |
| 17 | Recursion | Three nested rings around the exit, turning in opposite directions, with your echo behind you |
| 18 | Hive | Hunters, snakes and sentries working together, and your echo |
| 19 | Collapse | A wall in each half, a shockwave from the middle, hunters and your echo |
| 20 | Infinix ∞ | Looping edges, three nested rings with coins between them, a serpent, a hunter and your echo |
| 21 | Still | Two fast rotating bars, an orbiting ring, and hunters along the top and bottom |
| 22 | Splice | A horizontal wall whose gap mirrors you, crossing bouncers and your echo |
| 23 | Choir | A rose curve, rails that slide to where you cross, and sentries that guard your routes |
| 24 | Overflow | Conveyor floors, two turning squares around the coins, hunters in the outer bands |
| 25 | The Last Room | A shockwave and two serpents on one side; a turning square with two gaps around the exit and your echo on the other |

After the last stage everything loops forever (rooms mirrored each loop). The level number `L` counts every stage,
so the game keeps getting harder.

## The difficulty formula

```
L = stage number, D = deaths, x = L + D
d   = 1 + 99 · (1 − 0.5^(x/50))            approaches 100, never reaches it
PpR = max(20 · 0.5^(d − 90), 1)            only once d ≥ 90
```

- `d` sets enemy speed, reaction time, how far ahead they predict you, and patrol speed.
- `PpR` is the gap the AI enemies must leave you: between two hunters, around safe zones and coins, and the opening in walls, rings and shockwaves. Before `d = 90` the gap is 20 px. After that it halves as `d` rises, down to 1 px. Once it is online, walls and rings hold still while you thread a gap, so 1 px gaps stay possible.
- Enemies learn from every death through a heat map of where you go and where you die. Hunters lean toward your habits, sentries guard your favourite routes, walls and shockwaves open where you go least. Learning stops when `PpR` reaches 1 px (`d ≈ 94.32`).
- AI enemies are always slower than you, and every gap is at least your size + 1 px, so a path always exists.
- Safe zones are always safe: echoes and shockwaves never reach into them.
- Rings slow to a crawl while you stand at their gap, and hold still once `PpR` is online.

## Music

The soundtrack is the song embedded at the bottom of `index.html`. It loops forever on a bar line (112 beats = 28 bars at 136 BPM, where the song's chord cycle comes back round) with a 50 ms crossfade, so there is no gap or click at the loop point. To use a different song:

```
node tools/embed-song.js path/to/song.mp3 [secondsPerBeat beatsPerLoop]
```

Without the last two numbers the whole song loops.

## Testing that every room is beatable

`tools/` runs the real game code headlessly in Node and uses a search bot to find a complete winning run, which is then replayed on a fresh game to confirm it.

```
node tools/bot.js --room 15 --D 120          # one room (1-25) at one death count
node tools/bot.js --room 23 --human 1        # only inputs a person could make (held at least 83 ms)
node tools/verify.js --rooms 1-25 --targets 60,88,max   # the whole matrix, 4 at a time
```

A target is the difficulty `d` to test at, or `max` for an endgame save (2000 deaths, `PpR` = 1 px).
