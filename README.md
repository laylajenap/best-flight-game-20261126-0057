# Ember Valley — Sky Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/laylajenap/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/laylajenap/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete original flight game: fly the courier plane **Kestrel-9** over the
golden-hour valley of Ember Valley, thread glowing rings, mind your fuel, and
bring the mail home to a gentle landing on Amberford Field runway 18. All art
is drawn in code and all sound is synthesised live with WebAudio — no
libraries, no network requests, plain static files under `game/`.

## How to play

- **Goal:** finish a mission. Rings pay 250 pts + fuel; a gentle landing pays
  100 pts; finishing pays 500 pts + time bonus.
- **Missions (press 1 / 2 / 3, or click a card):**
  1. **Ring Run** — thread all 8 golden rings along the valley circuit.
  2. **Courier Drop** — fly 2 rings, then land on runway 18 (under 90 kt,
     sink under 7 m/s, wings level).
  3. **Ridge Dash** — 6 high rings, then land, before 4:00 runs out.
- **Controls:** `↑` / `↓` pitch, `←` / `→` bank and turn, `W` / `S` throttle,
  mouse banks the wings, mouse wheel works the throttle, `C` swaps chase /
  cockpit camera, `P` pause, `R` restart, `Q` menu, `M` mute.
- **Flying well:** banking turns the nose; climbing bleeds speed; below ~66 kt
  the wing stalls and the nose drops. Watch the `PULL UP`, `STALL` and
  `LOW FUEL` warnings — the valley floor is not a runway.

## The valley

Procedural heightfield terrain: patchwork fields, forest, a winding river,
the town of Amberford with lit rooftops, and a runway with centreline dashes
and glowing edge lights. Chase view shows the Kestrel-9 with spinning prop
and blinking nav lights; cockpit view puts the lit attitude, altimeter,
airspeed and compass dials front and centre, with altitude, speed and heading
on the HUD in both views.

## Run it

```sh
node serve.ts            # serves game/ on http://localhost:8080
```

Screenshots are staged by the game's own code: `?shot=start|play|cockpit|end&seed=1`
(see `shots.json`). Hand-in: `MAKEFUN_OUTPUT_DIR=out node main.ts`.
