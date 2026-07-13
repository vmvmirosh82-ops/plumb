import { rand, dist, uid, WORLD_W, WORLD_H } from './utils.js';

export const RESOURCE_TYPES = {
  tree: { icon: '🌲', hits: 3, yield: { wood: 4, fiber: 1 }, radius: 26, respawn: 45, label: 'Tree' },
  rock: { icon: '🪨', hits: 3, yield: { stone: 4, flint: 1 }, radius: 24, respawn: 55, label: 'Rock' },
  bush: { icon: '🌿', hits: 2, yield: { fiber: 3, berries: 2 }, radius: 20, respawn: 35, label: 'Berry Bush' },
  metal: { icon: '⛰️', hits: 5, yield: { metal: 3, stone: 1 }, radius: 28, respawn: 90, label: 'Metal Vein' },
};

export function generateWorld() {
  const nodes = [];
  const counts = { tree: 150, rock: 90, bush: 80, metal: 14 };
  for (const type of Object.keys(counts)) {
    for (let i = 0; i < counts[type]; i++) {
      let x, y;
      do {
        x = rand(150, WORLD_W - 150);
        y = rand(150, WORLD_H - 150);
      } while (dist(x, y, WORLD_W / 2, WORLD_H / 2) < 220);
      nodes.push({
        id: uid(),
        type,
        x,
        y,
        hitsLeft: RESOURCE_TYPES[type].hits,
        alive: true,
        respawnAt: 0,
      });
    }
  }

  const ponds = [];
  for (let i = 0; i < 6; i++) {
    ponds.push({ x: rand(300, WORLD_W - 300), y: rand(300, WORLD_H - 300), r: rand(70, 140) });
  }

  return { nodes, ponds };
}

export function updateNodeRespawns(nodes, now) {
  for (const n of nodes) {
    if (!n.alive && now >= n.respawnAt) {
      n.alive = true;
      n.hitsLeft = RESOURCE_TYPES[n.type].hits;
    }
  }
}
