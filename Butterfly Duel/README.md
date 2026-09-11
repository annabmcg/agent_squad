# Butterfly Duel

A 3D pollen-dueling arena game built with [Three.js](https://threejs.org/). Move around an outdoor arena, puff pollen at your opponent, and avoid getting hit — take enough damage and you turn into a butterfly and lose the round.

## How it was built

Started in [Cursor](https://cursor.com/), then continued and refined using [Claude Code](https://claude.com/claude-code) with Claude Sonnet 5 (High effort) — including bug fixes to the win condition and projectile collision, and reworking the arena from an indoor setting to an outdoor one.

## Controls

- **↑ / ↓** — move forward / backward
- **← / →** — turn
- **Space** — puff pollen

## Running it locally

Because the game loads Three.js as an ES module, opening `index.html` directly (via `file://`) won't work — browsers block module scripts on that protocol. Serve the folder instead:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173` in your browser.

## Tech

Vanilla HTML/CSS/JS with Three.js for 3D rendering — no build step or framework.
