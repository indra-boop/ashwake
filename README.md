# ASHWAKE

Spaceship game. Hold the lane, break the waves, and log the wake you leave behind. A bone-white interceptor against iron raiders — multi-shot, shield, and speed drift out of the wrecks.

## Play

| Action | Keys |
| --- | --- |
| Slide / climb | WASD or arrow keys |
| Steer toward pointer | Mouse or drag |
| Fire | Space, click, or the Fire pad |
| Pause | Esc |
| Start | Enter or Space on the title |

On a phone, use the on-screen pad. High scores (callsign, best, mute, auto-fire) stay in the browser.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (port 8080).

Stack: React 19, TanStack Start, Vite, canvas. Sprites live in `public/sprites/`. Simulation is in `src/game/`.
