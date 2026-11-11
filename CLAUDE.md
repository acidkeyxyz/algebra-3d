# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
nvm use              # Node >= 22.12 required (.nvmrc pins 24)
npm install
npm run dev          # http://localhost:4321 (astro dev --host)
npm test             # vitest run (tests/*.test.ts)
npx vitest run tests/solver.test.ts            # one file
npx vitest run -t "name fragment"              # one test by name
npm run build        # static site in dist/
```

No linter is configured. `?test=true` in the URL opens every Learn level; `?lang=en` forces English; `?q=<equation>` preloads a formula.

## Architecture

Static Astro 6 site with a single Preact island (`src/components/App.tsx`), Three.js for 3D and KaTeX for math. Two modes share one app: **Learn** (gamified levels, ages 8–13) and the **3D solver**.

Solver pipeline (the part that spans several files):
1. `parser.ts` — student input (`2x`, `3(x+1)`, `x²`, `−`) → AST → polynomial (`poly.ts`) or numeric function. `roots.ts`/`fraction.ts` provide exact-fraction math and factoring/root finding.
2. `solver.ts` — classifies the problem and produces a `Solution`: a list of explained `Step`s, each carrying a `Scene` (balance, box, graph, surface) described in *math* terms (`scene.ts`). `system.ts` handles `;`-separated systems (substitution, circle subtraction, numeric fallback).
3. `view.ts` — converts a `Scene` into positioned 3D objects with **stable keys**, so blocks animate between consecutive steps. Preserve keys when changing scenes.
4. `three/Stage.ts` — Three.js renderer, tweened animations, game-style camera controls.
5. `components/Viewer.tsx` bridges Preact and `Stage`.

Learn mode: `learn.ts` (levels, age→start-level map, question generators), `progress.ts` (XP, stars, ranks, badges, streaks; persisted in localStorage), `components/Learn.tsx` (UI), `sound.ts`. Algebra questions link to the solver. `generate.ts` produces practice formulas with clean answers for the examples sidebar; `favorites.ts` stores starred formulas.

Conventions:
- All user-facing text is bilingual via `T(en, es)` from `i18n.ts` (Spanish-MX default, English-US alt). New strings need both languages, including question explanations in Learn.
- `astro.config.mjs` sets `base: '/projects/algebra-3d'`; asset URLs in `.astro`/components must use `import.meta.env.BASE_URL`.
- `index.astro` contains the GTM/GA4 snippets and the Open Graph meta (crawlers don't run JS, so previews are static).
- Mobile layout (<=720px) uses full-screen expand buttons; check both layouts when changing UI.

## Deploy

Built `dist/` is rsynced into the sibling `../fanpage.me/projects/algebra-3d/` repo and committed/pushed there (see README for the exact steps); nginx serves it as static files.
