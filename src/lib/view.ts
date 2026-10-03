// Scene (math) → View (positioned 3D things). Pure functions: easy to test.
// Every object has a stable `key`: the renderer animates objects whose key
// survives from one step to the next, and fades the others in/out.

import { Fraction } from './fraction';
import { COLORS, type Axis, type GraphFrame, type Scene, type Side, type TileGroup } from './scene';

export type V3 = [number, number, number];

export interface TileObj {
  key: string;
  size: V3;
  pos: V3;
  color: string;
  negative: boolean;
  label?: string;
  dim?: boolean;
  added?: boolean;
}

export interface LabelObj {
  key: string;
  pos: V3;
  text: string;
  cls?: string;
  color?: string;
}

export interface ArrowObj {
  key: string;
  from: V3;
  to: V3;
  color: string;
  label?: string;
  head: boolean;
  dashed?: boolean;
}

export interface CurveObj {
  key: string;
  pts: V3[];
  color: string;
  draw: boolean;
}

export interface PointObj {
  key: string;
  pos: V3;
  color: string;
  big: boolean;
  label?: string;
}

export interface AxesObj {
  frame: GraphFrame;
  /** World position of graph point (x, y). */
  origin: V3;
  sx: number;
  sy: number;
}

export interface SurfaceObj {
  fn: (x: number, y: number) => number;
  range: number;
  scale: number;
  zScale: number;
  showSurface: boolean;
  slices: ('x0' | 'y0')[];
}

export interface View {
  mode: Scene['type'];
  balance: boolean;
  tiles: TileObj[];
  labels: LabelObj[];
  arrows: ArrowObj[];
  curves: CurveObj[];
  /** Polylines given as pairs of points (implicit curves). */
  segments: { key: string; pts: V3[]; color: string }[];
  points: PointObj[];
  axes?: AxesObj;
  surface?: SurfaceObj;
  camera: { pos: V3; target: V3 };
}

// Block sizes. x is deliberately not a whole number: it is unknown!
export const X = 2.6;
export const Y = 1.7;
export const PAN_X = 7.5;
export const PAN_Y = 3.2;
const PILE_WIDTH = 10;
const GAP = 0.22;
const MAX_TILES = 15;

const termColor = (term: string) =>
  ({ '3,0': COLORS.x3, '2,0': COLORS.x2, '1,0': COLORS.x, '0,1': COLORS.y, '0,0': COLORS.one })[term] ?? COLORS.other;

function termSize(term: string): V3 {
  switch (term) {
    case '3,0':
      return [X, X, X];
    case '2,0':
      return [X, 1, X];
    case '1,0':
      return [X, 1, 1];
    case '0,1':
      return [Y, 1, 1];
    case '0,0':
      return [1, 1, 1];
    default:
      return [1.6, 1.6, 1.6];
  }
}

export function termText(term: string, c: Fraction): string {
  const [i, j] = term.split(',').map(Number);
  const sup = (n: number) => (n === 1 ? '' : String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]));
  const mono = (i ? `x${sup(i)}` : '') + (j ? `y${sup(j)}` : '');
  const abs = c.abs();
  const num = mono && abs.eq(Fraction.ONE) ? '' : abs.toString();
  return `${c.sign() < 0 ? '−' : ''}${num}${mono}`;
}

interface Item {
  key: string;
  size: V3;
  color: string;
  negative: boolean;
  label?: string;
  added?: boolean;
  row: string;
}

function itemsOf(sideId: string, g: TileGroup, from: number, to: number): Item[] {
  const neg = g.count.sign() < 0;
  const base = { color: neg ? COLORS.neg : termColor(g.term), negative: neg, added: g.added };
  const sign = neg ? '-' : '+';
  const row = `${g.term}${sign}${g.added ? 'a' : ''}`;
  const n = Math.abs(g.count.n);
  const simple = g.count.isInt() && n <= MAX_TILES && termSize(g.term)[0] !== 1.6;
  if (!simple) {
    const s = termSize(g.term);
    return from === 0
      ? [{ ...base, key: `${sideId}:${g.term}:${sign}:${g.added ? 'a' : ''}bulk`, size: [s[0] * 1.15, s[1] * 1.15, s[2] * 1.15], label: termText(g.term, g.count), row }]
      : [];
  }
  const out: Item[] = [];
  for (let i = from; i < Math.min(to, n); i++) {
    out.push({ ...base, key: `${sideId}:${g.term}:${sign}:${g.added ? 'a' : ''}${i}`, size: termSize(g.term), row });
  }
  return out;
}

/** Lays out items in centred rows; returns depth used. Positions are relative to (cx, PAN_Y, z0). */
function packRows(items: Item[], cx: number, z0: number, dim: boolean, out: TileObj[]): number {
  const rows: Item[][] = [];
  let cur: Item[] = [];
  let w = 0;
  for (const it of items) {
    const newKind = cur.length && cur[0].row !== it.row;
    if (cur.length && (w + it.size[0] > PILE_WIDTH || newKind)) {
      rows.push(cur);
      cur = [];
      w = 0;
    }
    cur.push(it);
    w += it.size[0] + GAP;
  }
  if (cur.length) rows.push(cur);
  let z = z0;
  for (const row of rows) {
    const depth = Math.max(...row.map((r) => r.size[2]));
    const width = row.reduce((s, r) => s + r.size[0] + GAP, -GAP);
    let x = cx - width / 2;
    for (const it of row) {
      out.push({
        key: it.key,
        size: it.size,
        pos: [x + it.size[0] / 2, PAN_Y + it.size[1] / 2, z + depth / 2],
        color: it.color,
        negative: it.negative,
        label: it.label,
        added: it.added,
        dim,
      });
      x += it.size[0] + GAP;
    }
    z += depth + GAP;
  }
  return z - z0 - GAP;
}

function layoutSide(s: Side, cx: number, groups = 1): TileObj[] {
  const out: TileObj[] = [];
  const blocks: { items: Item[]; dim: boolean }[] = [];
  for (let g = 0; g < groups; g++) {
    const items: Item[] = [];
    for (const tg of s.groups) {
      const per = Math.abs(tg.count.n) / groups;
      items.push(...itemsOf(s.id, tg, g * per, (g + 1) * per));
    }
    blocks.push({ items, dim: g > 0 });
  }
  // Measure depth first so the whole pile is centred on the pan.
  const tmp: TileObj[] = [];
  const depths = blocks.map((b) => packRows(b.items, cx, 0, b.dim, tmp));
  const total = depths.reduce((a, d) => a + d, 0) + (blocks.length - 1) * 0.9;
  let z = -total / 2;
  blocks.forEach((b, i) => {
    packRows(b.items, cx, z, b.dim, out);
    z += depths[i] + 0.9;
  });
  return out;
}

const segLengths = (a: Axis) => [...Array(a.xs).fill(X), ...Array(a.units).fill(1)] as number[];

function boxTiles(id: string, axes: [Axis, Axis, Axis], cx: number): { tiles: TileObj[]; size: V3 } {
  const [s0, s1, s2] = axes.map(segLengths);
  const sum = (s: number[]) => s.reduce((a, b) => a + b, 0) + (s.length - 1) * 0.04;
  const W = sum(s0);
  const D = sum(s1);
  const counters = new Map<string, number>();
  const tiles: TileObj[] = [];
  let x = cx - W / 2;
  for (const a of s0) {
    let z = -D / 2;
    for (const b of s1) {
      let y = PAN_Y;
      for (const c of s2) {
        const nx = [a, b, c].filter((v) => v === X).length;
        const term = `${nx},0`;
        const idx = counters.get(term) ?? 0;
        counters.set(term, idx + 1);
        tiles.push({
          key: `${id}:${term}:+:${idx}`,
          size: [a, c, b],
          pos: [x + a / 2, y + c / 2, z + b / 2],
          color: termColor(term),
          negative: false,
        });
        y += c + 0.04;
      }
      z += b + 0.04;
    }
    x += a + 0.04;
  }
  return { tiles, size: [W, sum(s2), D] };
}

function emptyView(mode: Scene['type']): View {
  return { mode, balance: false, tiles: [], labels: [], arrows: [], curves: [], segments: [], points: [], camera: { pos: [0, 12, 26], target: [0, 4, 0] } };
}

export function buildView(scene: Scene): View {
  switch (scene.type) {
    case 'balance':
      return balanceView(scene);
    case 'box':
      return boxView(scene);
    case 'graph':
      return graphView(scene);
    case 'surface':
      return surfaceView(scene);
  }
}

function balanceView(scene: Extract<Scene, { type: 'balance' }>): View {
  const v = emptyView('balance');
  v.balance = true;
  v.tiles = [...layoutSide(scene.left, -PAN_X, scene.groups), ...layoutSide(scene.right, PAN_X, scene.groups)];
  for (const [s, cx] of [
    [scene.left, -PAN_X],
    [scene.right, PAN_X],
  ] as const) {
    if (!s.groups.length) v.labels.push({ key: `zero:${cx}`, pos: [cx, PAN_Y + 1, 0], text: '0', cls: 'big' });
  }
  v.labels.push({ key: 'eq', pos: [0, PAN_Y + 3.6, 0], text: '=', cls: 'big' });
  const top = Math.max(PAN_Y + 3, ...v.tiles.map((t) => t.pos[1] + t.size[1] / 2 + 1));
  if (scene.op) {
    for (const cx of [-PAN_X, PAN_X]) {
      v.arrows.push({ key: `op:${cx}`, from: [cx, top + 4, 0], to: [cx, top + 0.6, 0], color: '#f97316', label: scene.op, head: true });
    }
  }
  const depth = Math.max(4, ...v.tiles.map((t) => Math.abs(t.pos[2]) * 2 + 2));
  v.camera = { pos: [0, 9 + depth * 0.4, 21 + depth * 0.6], target: [0, PAN_Y + 1.5, 0] };
  return v;
}

function boxView(scene: Extract<Scene, { type: 'box' }>): View {
  const v = emptyView('box');
  v.balance = true;
  const cx = -PAN_X;
  const { tiles, size } = boxTiles(scene.id, scene.axes, cx);
  v.tiles = tiles;
  const [W, H, D] = size;
  const x0 = cx - W / 2;
  const z1 = D / 2;
  if (scene.showDims) {
    v.arrows.push({ key: 'dim0', from: [x0, PAN_Y + 0.05, z1 + 0.8], to: [x0 + W, PAN_Y + 0.05, z1 + 0.8], color: '#f97316', label: scene.dims[0], head: true });
    v.arrows.push({ key: 'dim1', from: [x0 + W + 0.8, PAN_Y + 0.05, z1], to: [x0 + W + 0.8, PAN_Y + 0.05, z1 - D], color: '#f97316', label: scene.dims[1], head: true });
    if (scene.dims[2] !== '1')
      v.arrows.push({ key: 'dim2', from: [x0 - 0.8, PAN_Y, z1], to: [x0 - 0.8, PAN_Y + H, z1], color: '#f97316', label: scene.dims[2], head: true });
  }
  v.labels.push({ key: 'zero:7.5', pos: [PAN_X, PAN_Y + 1, 0], text: '0', cls: 'big' });
  v.labels.push({ key: 'eq', pos: [0, PAN_Y + 3.6, 0], text: '=', cls: 'big' });
  const tall = H > 2;
  v.camera = {
    pos: [cx + (tall ? 9 : 3), PAN_Y + H + (tall ? 8 : 11), 13 + D * 0.5],
    target: [cx, PAN_Y + H / 2, 0],
  };
  return v;
}

/** World placement of a graph frame: a board standing on the floor at z = 0. */
export function axesFor(frame: GraphFrame): AxesObj {
  const W = 22;
  const H = 14;
  let sx = W / (frame.xmax - frame.xmin);
  let sy = H / (frame.ymax - frame.ymin);
  // Same scale on both axes when possible so slopes look right.
  const r = sx / sy;
  if (r > 0.45 && r < 2.2) sx = sy = Math.min(sx, sy);
  const cx = (frame.xmin + frame.xmax) / 2;
  return { frame, sx, sy, origin: [-cx * sx, 1 - frame.ymin * sy, 0] };
}

export function toWorld(a: AxesObj, x: number, y: number, z = 0): V3 {
  return [a.origin[0] + x * a.sx, a.origin[1] + y * a.sy, z];
}

function graphView(scene: Extract<Scene, { type: 'graph' }>): View {
  const v = emptyView('graph');
  const ax = axesFor(scene.frame);
  v.axes = ax;
  const { xmin, xmax, ymin, ymax } = scene.frame;
  const inY = (y: number) => y >= ymin - 0.02 && y <= ymax + 0.02;
  for (const c of scene.curves) {
    const N = 600;
    let piece: V3[] = [];
    let n = 0;
    const flush = () => {
      if (piece.length > 1) v.curves.push({ key: `${c.id}#${n++}`, pts: piece, color: c.color, draw: !!c.draw });
      piece = [];
    };
    let prev: number | null = null;
    for (let i = 0; i <= N; i++) {
      const x = xmin + ((xmax - xmin) * i) / N;
      const y = c.fn(x);
      if (!Number.isFinite(y) || !inY(y) || (prev !== null && Math.abs(y - prev) > (ymax - ymin) * 0.5)) {
        // Keep the curve reaching the edge of the board instead of stopping short.
        if (Number.isFinite(y) && piece.length && prev !== null && Math.abs(y - prev) < (ymax - ymin) * 0.5)
          piece.push(toWorld(ax, x, Math.min(ymax, Math.max(ymin, y)), 0.06));
        flush();
        if (Number.isFinite(y) && inY(y)) piece.push(toWorld(ax, x, y, 0.06));
      } else {
        if (!piece.length && i > 0 && prev !== null && Number.isFinite(prev))
          piece.push(toWorld(ax, xmin + ((xmax - xmin) * (i - 1)) / N, Math.min(ymax, Math.max(ymin, prev)), 0.06));
        piece.push(toWorld(ax, x, y, 0.06));
      }
      prev = Number.isFinite(y) ? y : null;
    }
    flush();
    if (c.label) {
      // Put the label near the right end of the visible curve.
      // Label the longest visible piece, at the requested spot along it.
      const pieces = v.curves.filter((k) => k.key.startsWith(`${c.id}#`));
      const last = pieces.sort((p, q) => q.pts.length - p.pts.length)[0];
      if (last) {
        const p = last.pts[Math.min(last.pts.length - 1, Math.floor(last.pts.length * (c.labelAt ?? 0.85)))];
        v.labels.push({ key: `lbl:${c.id}`, pos: [p[0], p[1] + 0.7, 0.3], text: c.label, cls: 'curve', color: c.color });
      }
    }
  }
  for (const im of scene.implicit ?? []) {
    const raw = marchingSquares(im.fn, scene.frame);
    v.segments.push({ key: im.id, pts: raw.map(([x, y]) => toWorld(ax, x, y, 0.06)), color: im.color });
    if (im.label && raw.length) {
      // Label the right-most part of the curve.
      const [lx, ly] = raw.reduce((best, p) => (p[0] > best[0] ? p : best), raw[0]);
      const w = toWorld(ax, lx, ly, 0.3);
      v.labels.push({ key: `lbl:${im.id}`, pos: [w[0] + 0.4, w[1] + 0.7, 0.3], text: im.label, cls: 'curve', color: im.color });
    }
  }
  for (const p of scene.points) {
    if (!inY(p.y) || p.x < xmin || p.x > xmax) continue;
    v.points.push({ key: p.id, pos: toWorld(ax, p.x, p.y, 0.1), color: p.color, big: !!p.big, label: p.label });
  }
  const clampX = (x: number) => Math.min(xmax, Math.max(xmin, x));
  const clampY = (y: number) => Math.min(ymax, Math.max(ymin, y));
  for (const s of scene.segs) {
    v.arrows.push({
      key: s.id,
      from: toWorld(ax, clampX(s.from[0]), clampY(s.from[1]), 0.12),
      to: toWorld(ax, clampX(s.to[0]), clampY(s.to[1]), 0.12),
      color: s.color,
      label: s.label,
      head: !!s.arrow,
      dashed: s.dashed,
    });
  }
  const W = (xmax - xmin) * ax.sx;
  const H = (ymax - ymin) * ax.sy;
  const cy = 1 + H / 2;
  const dist = Math.max(W * 0.95, H * 1.35) + 4;
  v.camera = { pos: [W * 0.12, cy + 2.5, dist], target: [0, cy, 0] };
  return v;
}

/** Points where f(x, y) = 0, as pairs of segment endpoints. */
export function marchingSquares(f: (x: number, y: number) => number, fr: GraphFrame, n = 160): [number, number][] {
  const out: [number, number][] = [];
  const dx = (fr.xmax - fr.xmin) / n;
  const dy = (fr.ymax - fr.ymin) / n;
  const val: number[][] = [];
  for (let i = 0; i <= n; i++) {
    val.push([]);
    for (let j = 0; j <= n; j++) val[i].push(f(fr.xmin + i * dx, fr.ymin + j * dy));
  }
  const lerp = (x0: number, y0: number, v0: number, x1: number, y1: number, v1: number): [number, number] => {
    const t = v0 / (v0 - v1);
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = fr.xmin + i * dx;
      const y = fr.ymin + j * dy;
      const c = [val[i][j], val[i + 1][j], val[i + 1][j + 1], val[i][j + 1]];
      if (!c.every(Number.isFinite)) continue;
      const corners: [number, number][] = [
        [x, y],
        [x + dx, y],
        [x + dx, y + dy],
        [x, y + dy],
      ];
      const hits: [number, number][] = [];
      for (let e = 0; e < 4; e++) {
        const a = c[e];
        const b = c[(e + 1) % 4];
        if ((a < 0) !== (b < 0)) {
          const [x0, y0] = corners[e];
          const [x1, y1] = corners[(e + 1) % 4];
          hits.push(lerp(x0, y0, a, x1, y1, b));
        }
      }
      if (hits.length === 2) out.push(hits[0], hits[1]);
      else if (hits.length === 4) out.push(hits[0], hits[1], hits[2], hits[3]);
    }
  }
  return out;
}

function surfaceView(scene: Extract<Scene, { type: 'surface' }>): View {
  const v = emptyView('surface');
  const scale = 10 / scene.range;
  // Squash very tall surfaces so they fit on screen.
  let zmax = 0;
  for (let i = 0; i <= 20; i++)
    for (let j = 0; j <= 20; j++) {
      const z = scene.fn(-scene.range + (i * scene.range) / 10, -scene.range + (j * scene.range) / 10);
      if (Number.isFinite(z)) zmax = Math.max(zmax, Math.abs(z));
    }
  const zScale = zmax * scale > 12 ? 12 / zmax : scale;
  v.surface = { fn: scene.fn, range: scene.range, scale, zScale, showSurface: scene.showSurface, slices: scene.slices };
  for (const p of scene.points) {
    v.points.push({ key: p.id, pos: [p.x * scale, p.z * zScale, -p.y * scale], color: p.color, big: true, label: p.label });
  }
  v.camera = { pos: [24, 20, 28], target: [0, 2.5, 0] };
  return v;
}
