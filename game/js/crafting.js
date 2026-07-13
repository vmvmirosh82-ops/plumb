export const RECIPES = [
  { id: 'hatchet', name: 'Stone Hatchet', icon: '🪓', category: 'tool', level: 1,
    cost: { wood: 4, stone: 6 }, gatherBonus: { wood: 2 }, desc: 'Boosts wood gathering.' },
  { id: 'pick', name: 'Stone Pick', icon: '⛏️', category: 'tool', level: 1,
    cost: { wood: 4, stone: 6 }, gatherBonus: { stone: 2, flint: 1, metal: 1 }, desc: 'Boosts stone/flint/metal gathering.' },
  { id: 'campfire', name: 'Campfire', icon: '🔥', category: 'structure', level: 1,
    cost: { wood: 10, stone: 6 }, desc: 'Provides warmth and light. Consumes wood to burn.' },
  { id: 'thatch_foundation', name: 'Thatch Foundation', icon: '▬', category: 'structure', level: 1,
    cost: { wood: 6, fiber: 4 }, desc: 'Base for a shelter.' },
  { id: 'thatch_wall', name: 'Thatch Wall', icon: '▮', category: 'structure', level: 1,
    cost: { wood: 5, fiber: 3 }, desc: 'Blocks movement and creatures.' },
  { id: 'spear', name: 'Spear', icon: '🔱', category: 'weapon', level: 2,
    cost: { wood: 6, fiber: 4 }, damage: 18, desc: 'A basic melee weapon.' },
  { id: 'thatch_door', name: 'Thatch Doorway', icon: '▯', category: 'structure', level: 2,
    cost: { wood: 5, fiber: 3 }, desc: 'A passable gap in your walls.' },
  { id: 'storage', name: 'Storage Box', icon: '📦', category: 'structure', level: 3,
    cost: { wood: 20, fiber: 10 }, desc: 'Stash resources here.' },
  { id: 'wood_wall', name: 'Wood Wall', icon: '🟫', category: 'structure', level: 5,
    cost: { wood: 20 }, desc: 'Sturdier than thatch.' },
  { id: 'metal_pick', name: 'Metal Pick', icon: '⛏️', category: 'tool', level: 8,
    cost: { metal: 10, wood: 4 }, gatherBonus: { stone: 4, flint: 2, metal: 3 }, desc: 'A superior mining tool.' },
  { id: 'sword', name: 'Metal Sword', icon: '⚔️', category: 'weapon', level: 8,
    cost: { metal: 12, wood: 4 }, damage: 35, desc: 'A powerful melee weapon.' },
];

export function getRecipe(id) {
  return RECIPES.find((r) => r.id === id);
}

export function isUnlocked(recipe, level) {
  return level >= recipe.level;
}
