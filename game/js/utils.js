export const TILE = 64;
export const WORLD_W = 4000;
export const WORLD_H = 4000;

export function rand(min, max) {
  return Math.random() * (max - min) + min;
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function snap(v, size) {
  return Math.round(v / size) * size;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
