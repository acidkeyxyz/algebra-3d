<img src="public/algebra-3d-logo.webp" alt="Álgebra 3D logo" width="160" align="right" />

# Álgebra 3D

Interactive algebra for students aged 13–16. Type an equation and watch it solved step by step in a 3D scene:

- **Balance scale with algebra blocks** for linear equations (x³ cubes, x² flats, x rods, y rods, unit cubes; red = negative). Blocks drop in, cancel as zero pairs, and split into equal groups when dividing.
- **Area / volume models** for factoring: `x² + 5x + 6` assembles into an (x + 2)(x + 3) rectangle, and `x³ + 3x²` stacks into an x · x · (x + 3) box.
- **3D graphs** for functions (`y = x + 2` shows the table, intercept, and rise/run arrows), for roots of polynomials, circles (`x² + y² = 25`), and surfaces (`z = x² − y²`).
- **Game-style camera**: drag to orbit, WASD to walk, Q/E to turn, R/F for up/down, +/− to zoom. Each step flies the camera to a good view.
- **Step navigation**: ◀ ▶ buttons, ← → keys, Space to autoplay, End for the final view.
- **Systems of equations**: up to 10 equations in x and y separated by `;`, e.g. `x+2=y; 3x-2y=2`. Each equation is graphed, then solved step by step by substitution (two circles are subtracted first to get a line; curves with no algebraic route are solved numerically). The final view shows every graph and all intersections.
- **Examples sidebar**: the list scrolls forever and generates new practice formulas with clean answers. Click ☆ to pin a formula to the Favorites stack at the top (saved in localStorage). The ☆ next to the input pins your own formula.
- **Help guide**: the **? Ayuda / Help** button to the right of the language switch opens a guide covering typing rules, every problem type (with clickable examples), step and camera controls, colours, favorites, and troubleshooting.
- **Languages**: Spanish (Mexico) by default; the ES/EN switch in the header changes to English (US). The choice is remembered (`?lang=en` also works).
- **Mobile layout**: on screens up to 720px wide, expand buttons open the formula and examples, the 3D canvas, or the step card full screen, and a floating ✕ button at the bottom closes it. The formula badge over the canvas is hidden there, since the step card already shows it.
- **Sharing**: links (including `?q=` links) show a preview with `public/og-image.jpg`. See [Link previews](#link-previews).

## Stack

Astro 6 (Vite) + Preact island + Three.js + KaTeX. Node ≥ 22.12 (`.nvmrc` pins 24).

```sh
nvm use
npm install
npm run dev      # http://localhost:4321
npm test         # solver tests (vitest)
npm run build    # static site in dist/
```

## Deploy

The site is served from the [fanpage.me](https://github.com/acidkeyxyz/fanpage.me) repo at [acidkey.xyz/projects/algebra-3d/](https://acidkey.xyz/projects/algebra-3d/), which is why `astro.config.mjs` sets `base: '/projects/algebra-3d'`.

```sh
nvm use                # pnpm runs scripts with whatever `node` is on PATH; Astro needs ≥ 22.12
pnpm build
rsync -a --delete dist/ ../fanpage.me/projects/algebra-3d/
cd ../fanpage.me
git add projects/algebra-3d
git commit -m "chore(algebra-3d): deploy new build"
git push
```

nginx serves the fanpage.me folder as static files, so new builds show up right away. Restart it (`sudo systemctl reload nginx`) only after changing its config.

### Link previews

`src/pages/index.astro` sets Open Graph / Twitter tags with `public/og-image.jpg` (1200×630). Crawlers don't run JS, so every shared link gets the same preview, including links with `?q=`.

## Layout

- `src/lib/parser.ts` turns student input (`2x`, `3(x+1)`, `x²`, `−`) into an AST, then a polynomial or numeric function.
- `src/lib/solver.ts` builds the explained steps, each with a scene (balance, box, graph, surface). All text is bilingual via `T(en, es)`.
- `src/lib/view.ts` converts a scene into positioned 3D objects with stable keys, so blocks animate between steps.
- `src/three/Stage.ts` holds the Three.js renderer, animations, and camera controls.
- `src/components/` contains the Preact UI (`App`, `Viewer`, `LangSwitch`, KaTeX `Math`).
- `src/lib/i18n.ts` has the language state and UI strings.
- `src/lib/system.ts` handles systems of equations (substitution, circle subtraction, numeric fallback).
- `src/lib/generate.ts` builds random formulas from their answers; `src/lib/favorites.ts` stores starred formulas.

## Contributing

Contributions are welcome. Open an issue or a pull request.

## License

Copyright (C) 2026 Luis Mendoza

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE) for the full text.
