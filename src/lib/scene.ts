// What a single step should show, described in math terms (not 3D terms).
// `view.ts` turns these into positioned 3D objects.

import type { Fraction } from './fraction';

/** A pile of identical blocks: `count` copies of the term x^i y^j ("i,j"). */
export interface TileGroup {
  term: string;
  count: Fraction;
  /** Blocks just added to both sides (shown with arrows). */
  added?: boolean;
}

export interface Side {
  /** Stable id of this side ("A" started on the left) so blocks can fly across when sides swap. */
  id: 'A' | 'B';
  groups: TileGroup[];
}

/** One edge of a box: `xs` lengths of x plus `units` lengths of 1. */
export interface Axis {
  xs: number;
  units: number;
}

export interface GraphFrame {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export interface GCurve {
  id: string;
  fn: (x: number) => number;
  color: string;
  label?: string;
  /** Animate drawing it from left to right when it first appears. */
  draw?: boolean;
  dashed?: boolean;
  /** Where along the visible curve to put its label (0 = left end, 1 = right end). */
  labelAt?: number;
}

export interface GImplicit {
  id: string;
  fn: (x: number, y: number) => number;
  color: string;
  label?: string;
}

export interface GPoint {
  id: string;
  x: number;
  y: number;
  color: string;
  label?: string;
  big?: boolean;
}

export interface GSeg {
  id: string;
  from: [number, number];
  to: [number, number];
  color: string;
  label?: string;
  arrow?: boolean;
  dashed?: boolean;
}

export type Scene =
  | {
      type: 'balance';
      left: Side;
      right: Side;
      /** Text on the arrows dropping onto both pans, e.g. "−2". */
      op?: string;
      /** Split each side into this many equal groups (dividing). */
      groups?: number;
    }
  | {
      type: 'box';
      /** Which side's blocks build the box (for animation keys). */
      id: 'A' | 'B';
      axes: [Axis, Axis, Axis];
      /** LaTeX-free plain labels for each edge, e.g. "x + 3". */
      dims: [string, string, string];
      /** Show the factor labels on the edges. */
      showDims: boolean;
      /** Highlight edge index whose length becomes 0. */
      zeroEdge?: number;
    }
  | {
      type: 'graph';
      frame: GraphFrame;
      curves: GCurve[];
      implicit?: GImplicit[];
      points: GPoint[];
      segs: GSeg[];
    }
  | {
      type: 'surface';
      fn: (x: number, y: number) => number;
      range: number;
      showSurface: boolean;
      /** Cut the surface along x = 0 and/or y = 0. */
      slices: ('x0' | 'y0')[];
      points: { id: string; x: number; y: number; z: number; label?: string; color: string }[];
    };

export interface Step {
  title: string;
  /** Plain-language explanation for the student. */
  text: string;
  /** The math of this step, in LaTeX. */
  latex: string;
  scene: Scene;
}

export interface Solution {
  /** What kind of problem we recognised. */
  kind: string;
  inputLatex: string;
  steps: Step[];
  /** Short final answer in LaTeX. */
  answer: string;
}

export const COLORS = {
  x3: '#f2a93b',
  x2: '#3b82f6',
  x: '#22c55e',
  y: '#a855f7',
  one: '#facc15',
  neg: '#ef4444',
  other: '#94a3b8',
  curve: '#38bdf8',
  curve2: '#f472b6',
  root: '#f43f5e',
  point: '#fbbf24',
  vertex: '#a3e635',
  axis: '#e2e8f0',
  rise: '#f97316',
  run: '#22d3ee',
};
