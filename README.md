# VESPER — local-first P2P spatial mesh command canvas

## Run it
```bash
cd vesper
npm install
npm run dev
```

## Or scaffold from scratch
```bash
npm create vite@latest vesper -- --template react-ts
cd vesper
npm install
npm install yjs y-indexeddb lucide-react
npm install tailwindcss @tailwindcss/vite
```
Then: add `tailwindcss()` to the plugins in `vite.config.ts`, replace `src/index.css` with
`@import "tailwindcss";`, and replace `src/App.tsx` with the provided files
(`src/meshEngine.ts`, `src/TacticalMap.tsx`, `src/App.tsx`). Finish with `npm run dev`.

## Demo script for judges
1. Open the app in **two browser tabs** side by side — drop a pin in one, it appears in the other instantly; move the mouse to see live peer cursors.
2. Click **Simulate 4 Field Peers** — virtual operatives roam, drop pins, and trigger genuinely concurrent CRDT edits (see `CONFLICT RESOLVED` in the CRDT LOG).
3. Click **Simulate Network Blackout** in one tab, edit in both tabs, then **Restore Network** — watch the merge log.
4. Use **Demo Voice Command** (or the mic) to turn speech into a typed, prioritized pin.
5. Switch the **Scenario Preset** dropdown — all tabs follow.

Keys: `1` Select · `2` Pin · `3` Zone · `Space+Drag` / middle-drag pan · scroll zoom · `Del` delete.
State persists offline in IndexedDB (`vesper-doc`).
