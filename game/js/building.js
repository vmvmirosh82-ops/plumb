import { TILE, snap, uid, dist } from './utils.js';

export const STRUCTURE_TYPES = {
  thatch_foundation: { size: TILE, solid: false, icon: '▬', color: '#c9a86a', label: 'Thatch Foundation' },
  thatch_wall: { size: TILE, solid: true, icon: '▮', color: '#b8935a', label: 'Thatch Wall' },
  thatch_door: { size: TILE, solid: false, icon: '▯', color: '#8a6a3f', label: 'Thatch Doorway' },
  wood_wall: { size: TILE, solid: true, icon: '🟫', color: '#7a5230', label: 'Wood Wall' },
  campfire: { size: 40, solid: true, icon: '🔥', color: '#444', label: 'Campfire', light: 220, warmth: 260 },
  storage: { size: 44, solid: true, icon: '📦', color: '#8a5a2b', label: 'Storage Box', inventory: true },
};

export function placeStructure(structures, recipeId, x, y) {
  if (!STRUCTURE_TYPES[recipeId]) return null;
  const sx = snap(x, TILE);
  const sy = snap(y, TILE);
  const s = {
    id: uid(),
    type: recipeId,
    x: sx,
    y: sy,
    lit: false,
    fuel: 0,
    inventory: STRUCTURE_TYPES[recipeId].inventory ? {} : null,
  };
  structures.push(s);
  return s;
}

export function canPlace(structures, recipeId, x, y) {
  const sx = snap(x, TILE);
  const sy = snap(y, TILE);
  const minGap = STRUCTURE_TYPES[recipeId].size * 0.8;
  return !structures.some((s) => dist(s.x, s.y, sx, sy) < minGap);
}

export function collidesSolid(structures, x, y, r) {
  for (const s of structures) {
    const def = STRUCTURE_TYPES[s.type];
    if (!def.solid) continue;
    const half = def.size / 2;
    if (x + r > s.x - half && x - r < s.x + half && y + r > s.y - half && y - r < s.y + half) {
      return true;
    }
  }
  return false;
}
