import { uid } from './utils.js';

export const CREATURE_DEFS = {
  dodo: {
    icon: '🐦', label: 'Dodo', hp: 30, dmg: 0, speed: 55, aggressive: false,
    food: 'berries', tameGain: 0.34, xp: 15, meat: 2, hide: 0, radius: 16,
  },
  trike: {
    icon: '🦕', label: 'Triceratops', hp: 90, dmg: 0, speed: 65, aggressive: false,
    food: 'berries', tameGain: 0.2, xp: 30, meat: 4, hide: 2, radius: 22,
  },
  raptor: {
    icon: '🦖', label: 'Raptor', hp: 55, dmg: 14, speed: 128, aggressive: true,
    food: null, tameGain: 0, xp: 40, meat: 3, hide: 3, radius: 18,
  },
};

export class Creature {
  constructor(type, x, y) {
    const def = CREATURE_DEFS[type];
    this.id = uid();
    this.type = type;
    this.x = x;
    this.y = y;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.state = 'wander';
    this.tamed = false;
    this.tameProgress = 0;
    this.wanderTarget = null;
    this.wanderCooldown = 0;
    this.attackCooldown = 0;
    this.fleeUntil = 0;
    this.facing = 1;
  }
  get def() {
    return CREATURE_DEFS[this.type];
  }
}

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.spawnX = x;
    this.spawnY = y;
    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;
    this.maxStamina = 100;
    this.hunger = 100;
    this.thirst = 100;
    this.level = 1;
    this.xp = 0;
    this.xpNext = 40;
    this.inventory = {};
    this.owned = {};
    this.equippedTool = null;
    this.equippedWeapon = null;
    this.facing = { x: 0, y: 1 };
    this.attackCooldown = 0;
    this.alive = true;
    this.tamedIds = [];
  }
  addItem(item, qty) {
    this.inventory[item] = (this.inventory[item] || 0) + qty;
  }
  hasItems(cost) {
    return Object.entries(cost).every(([k, v]) => (this.inventory[k] || 0) >= v);
  }
  removeItems(cost) {
    for (const [k, v] of Object.entries(cost)) this.inventory[k] -= v;
  }
  gainXp(amount) {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.35);
      this.maxHealth += 5;
      this.health = Math.min(this.health + 5, this.maxHealth);
      leveled = true;
    }
    return leveled;
  }
}
