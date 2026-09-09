/**
 * Pure geometry helpers for the Table Map editor — no I/O, no React, unit-
 * testable in isolation. Coordinates are always in "world space" (the
 * canvas's own coordinate system, before the viewport's pan/zoom transform
 * is applied) unless a function name says otherwise.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Snaps a single coordinate to the nearest grid line. `gridSize <= 0` disables snapping (returns the value unchanged) — the caller's "snap to grid" toggle. */
export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function snapPointToGrid(point: Point, gridSize: number): Point {
  return { x: snapToGrid(point.x, gridSize), y: snapToGrid(point.y, gridSize) };
}

/** Axis-aligned rectangle intersection — used for marquee (rubber-band) multi-select hit testing. Touching edges (zero-area overlap) do not count as intersecting. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Normalizes a drag-drawn marquee rectangle so width/height are always
 * positive, regardless of which corner the user started dragging from. */
export function normalizeRect(start: Point, end: Point): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/** Converts a screen-space (viewport pixel) point into world-space, given
 * the canvas's current pan offset and zoom level — every pointer event
 * handler needs this to place/hit-test tables correctly while panned/zoomed. */
export function screenToWorld(screenPoint: Point, pan: Point, zoom: number): Point {
  return { x: (screenPoint.x - pan.x) / zoom, y: (screenPoint.y - pan.y) / zoom };
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
