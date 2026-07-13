const SAVE_KEY = 'isle-survival-save-v1';

export function saveGame(state) {
  try {
    const payload = {
      player: state.player,
      structures: state.structures,
      creatures: state.creatures.map((c) => ({
        id: c.id, type: c.type, x: c.x, y: c.y, hp: c.hp, maxHp: c.maxHp,
        tamed: c.tamed, tameProgress: c.tameProgress,
      })),
      nodes: state.world.nodes,
      ponds: state.world.ponds,
      time: state.time,
      unlockedNotified: state.unlockedNotified,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Load failed', e);
    return null;
  }
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
