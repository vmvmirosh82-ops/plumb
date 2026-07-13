import { WORLD_W, WORLD_H, TILE, clamp, dist, rand, snap } from './utils.js';
import { generateWorld, updateNodeRespawns, RESOURCE_TYPES } from './world.js';
import { Player, Creature } from './entities.js';
import { getRecipe, isUnlocked } from './crafting.js';
import { STRUCTURE_TYPES, placeStructure, canPlace, collidesSolid } from './building.js';
import { ITEM_META } from './items.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import * as UI from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function createGrassPattern() {
  const p = document.createElement('canvas');
  p.width = 64;
  p.height = 64;
  const pc = p.getContext('2d');
  pc.fillStyle = '#3c6b2f';
  pc.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 40; i++) {
    pc.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    pc.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
  }
  return ctx.createPattern(p, 'repeat');
}
const grassPattern = createGrassPattern();

const game = {
  player: null,
  world: null,
  structures: [],
  creatures: [],
  time: { t: 0, cycleLength: 480 },
  camera: { x: WORLD_W / 2, y: WORLD_H / 2 },
  buildSelection: null,
  activeStorage: null,
  mouseScreen: null,
  keys: new Set(),
  running: false,
  spawnTimer: 0,
  saveTimer: 0,
};

Object.assign(game, {
  togglePanel(id) { UI.togglePanelDom(id); },
  onPanelsClosed() {},
  craftItem(id) { craftItem(id); },
  setBuildSelection(id) { game.buildSelection = game.buildSelection === id ? null : id; },
  equip(category, id) {
    if (category === 'tool') game.player.equippedTool = id;
    else game.player.equippedWeapon = id;
    const r = getRecipe(id);
    UI.toast(`Equipped ${r.name}`);
  },
  eat(item) { eatItem(item); },
  depositAll() { depositAll(); },
  withdrawAll() { withdrawAll(); },
  startNewGame() { startNewGame(); },
  continueGame() { continueGame(); },
});

UI.initUI(game);
UI.showStartScreen(hasSave());

// ---------- New game / continue ----------
function startNewGame() {
  clearSave();
  game.world = generateWorld();
  game.structures = [];
  game.creatures = [];
  game.player = new Player(WORLD_W / 2, WORLD_H / 2);
  game.time = { t: 0, cycleLength: 480 };
  game.buildSelection = null;
  game.activeStorage = null;
  for (let i = 0; i < 6; i++) spawnCreature('dodo');
  for (let i = 0; i < 4; i++) spawnCreature('trike');
  for (let i = 0; i < 3; i++) spawnCreature('raptor');
  game.running = true;
  UI.hideStartScreen();
  UI.toast('Welcome to the Isle. Gather wood & stone to begin.');
}

function continueGame() {
  const data = loadGame();
  if (!data) {
    startNewGame();
    return;
  }
  game.world = { nodes: data.nodes, ponds: data.ponds };
  game.structures = data.structures || [];
  game.player = Object.assign(new Player(0, 0), data.player);
  game.creatures = (data.creatures || []).map((cd) => {
    const c = new Creature(cd.type, cd.x, cd.y);
    Object.assign(c, cd);
    return c;
  });
  game.time = data.time || { t: 0, cycleLength: 480 };
  game.buildSelection = null;
  game.activeStorage = null;
  game.running = true;
  UI.hideStartScreen();
  UI.toast('Welcome back!');
}

// ---------- Time of day ----------
function nightFactor(t) {
  const frac = (t % game.time.cycleLength) / game.time.cycleLength;
  if (frac < 0.45) return 0;
  if (frac < 0.55) return (frac - 0.45) / 0.1;
  if (frac < 0.85) return 1;
  if (frac < 1.0) return 1 - (frac - 0.85) / 0.15;
  return 0;
}
function isNight() {
  return nightFactor(game.time.t) > 0.5;
}

// ---------- Input ----------
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'];

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (MOVE_KEYS.includes(key)) game.keys.add(key);
  if (e.repeat || !game.running) return;
  if (key === 'e') handleInteract();
  else if (key === ' ') { handleAttack(); e.preventDefault(); }
  else if (key === 'i') game.togglePanel('inventoryPanel');
  else if (key === 'c') game.togglePanel('craftingPanel');
  else if (key === 'b') game.togglePanel('buildingPanel');
  else if (key === 'escape') { UI.closeAllPanels(); game.buildSelection = null; }
});
window.addEventListener('keyup', (e) => {
  game.keys.delete(e.key.toLowerCase());
});

canvas.addEventListener('mousemove', (e) => {
  game.mouseScreen = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('click', (e) => {
  if (!game.running) return;
  const wx = game.camera.x + (e.clientX - canvas.width / 2);
  const wy = game.camera.y + (e.clientY - canvas.height / 2);
  if (game.buildSelection) attemptPlace(wx, wy);
  else handleAttack();
});

// ---------- Player actions ----------
function handleInteract() {
  const p = game.player;
  if (!p || !p.alive || UI.isAnyPanelOpen()) return;

  const storage = game.structures.find((s) => s.type === 'storage' && dist(s.x, s.y, p.x, p.y) < 60);
  if (storage) {
    game.activeStorage = storage;
    UI.openStoragePanel();
    return;
  }

  const fire = game.structures.find((s) => s.type === 'campfire' && dist(s.x, s.y, p.x, p.y) < 55);
  if (fire) {
    if (!fire.lit) {
      if ((p.inventory.wood || 0) >= 1) {
        p.inventory.wood -= 1;
        fire.lit = true;
        fire.fuel = 240;
        UI.toast('🔥 Campfire lit');
      } else {
        UI.toast('Need 1 wood to light the fire');
      }
    } else {
      fire.lit = false;
      fire.fuel = 0;
      UI.toast('Campfire extinguished');
    }
    return;
  }

  const tamable = game.creatures.find((c) => !c.tamed && !c.def.aggressive && dist(c.x, c.y, p.x, p.y) < 55);
  if (tamable) {
    const foodKey = tamable.def.food;
    if ((p.inventory[foodKey] || 0) > 0) {
      p.inventory[foodKey]--;
      tamable.tameProgress = clamp(tamable.tameProgress + tamable.def.tameGain, 0, 1);
      if (tamable.tameProgress >= 1) {
        tamable.tamed = true;
        p.tamedIds.push(tamable.id);
        const leveled = p.gainXp(tamable.def.xp);
        UI.toast(`🎉 Tamed a ${tamable.def.label}!`);
        if (leveled) announceLevelUp();
      } else {
        UI.toast(`Feeding ${tamable.def.label}... ${Math.round(tamable.tameProgress * 100)}%`);
      }
    } else {
      UI.toast(`${tamable.def.label} wants ${ITEM_META[foodKey]?.label || foodKey}`);
    }
    return;
  }

  const pond = game.world.ponds.find((w) => dist(w.x, w.y, p.x, p.y) < w.r + 24);
  if (pond) {
    p.thirst = clamp(p.thirst + 40, 0, 100);
    UI.toast('💧 Drank water');
    return;
  }

  const node = game.world.nodes.find((n) => n.alive && dist(n.x, n.y, p.x, p.y) < RESOURCE_TYPES[n.type].radius + 30);
  if (node) gatherNode(node);
}

function gatherNode(node) {
  const p = game.player;
  const info = RESOURCE_TYPES[node.type];
  node.hitsLeft -= 1;
  const toolRecipe = p.equippedTool ? getRecipe(p.equippedTool) : null;
  for (const [res, amt] of Object.entries(info.yield)) {
    let total = amt;
    if (toolRecipe?.gatherBonus?.[res]) total += toolRecipe.gatherBonus[res];
    p.addItem(res, total);
  }
  const leveled = p.gainXp(2);
  if (leveled) announceLevelUp();
  if (node.hitsLeft <= 0) {
    node.alive = false;
    node.respawnAt = game.time.t + info.respawn;
  }
  if (UI.isAnyPanelOpen()) UI.refreshInventory();
}

function handleAttack() {
  const p = game.player;
  if (!p || !p.alive || UI.isAnyPanelOpen() || game.buildSelection || p.attackCooldown > 0) return;
  const weaponRecipe = p.equippedWeapon ? getRecipe(p.equippedWeapon) : null;
  const dmg = weaponRecipe ? weaponRecipe.damage : 6;
  p.attackCooldown = 0.55;

  let target = null;
  let best = 60;
  for (const c of game.creatures) {
    if (c.tamed) continue;
    const d = dist(c.x, c.y, p.x, p.y);
    if (d < best) { best = d; target = c; }
  }
  if (target) damageCreature(target, dmg, 'player');
}

function damageCreature(creature, dmg, source) {
  creature.hp -= dmg;
  if (creature.hp <= 0) {
    killCreature(creature, source);
    return;
  }
  if (!creature.def.aggressive) {
    creature.state = 'flee';
    creature.fleeUntil = game.time.t + 4;
  } else {
    creature.state = 'chase';
  }
}

function killCreature(creature, source) {
  game.creatures = game.creatures.filter((c) => c.id !== creature.id);
  game.player.tamedIds = game.player.tamedIds.filter((id) => id !== creature.id);
  if (source === 'player' || source === 'tamed') {
    game.player.addItem('meat', creature.def.meat);
    if (creature.def.hide) game.player.addItem('hide', creature.def.hide);
    const leveled = game.player.gainXp(creature.def.xp);
    UI.toast(`${creature.def.icon} ${creature.def.label} defeated`);
    if (leveled) announceLevelUp();
  }
}

function announceLevelUp() {
  UI.toast(`⭐ Level up! You are now level ${game.player.level}`);
}

function craftItem(id) {
  const recipe = getRecipe(id);
  if (!recipe) return;
  if (!isUnlocked(recipe, game.player.level)) { UI.toast('Not unlocked yet'); return; }
  if (!game.player.hasItems(recipe.cost)) { UI.toast('Not enough resources'); return; }
  if (recipe.category === 'structure') {
    game.buildSelection = id;
    UI.closeAllPanels();
    UI.toast(`Click in the world to place ${recipe.name}`);
    return;
  }
  game.player.removeItems(recipe.cost);
  game.player.owned[id] = (game.player.owned[id] || 0) + 1;
  if (recipe.category === 'tool' && !game.player.equippedTool) game.player.equippedTool = id;
  if (recipe.category === 'weapon' && !game.player.equippedWeapon) game.player.equippedWeapon = id;
  UI.toast(`Crafted ${recipe.name}`);
  UI.refreshCrafting();
  UI.refreshInventory();
}

function eatItem(item) {
  const meta = ITEM_META[item];
  const p = game.player;
  if (!meta || !meta.food || (p.inventory[item] || 0) <= 0) return;
  p.inventory[item] -= 1;
  p.hunger = clamp(p.hunger + meta.food, 0, 100);
  UI.toast(`Ate ${meta.label}`);
}

function depositAll() {
  const box = game.activeStorage;
  if (!box) return;
  for (const [k, v] of Object.entries(game.player.inventory)) {
    if (v > 0) {
      box.inventory[k] = (box.inventory[k] || 0) + v;
      game.player.inventory[k] = 0;
    }
  }
  UI.refreshStorage();
  UI.toast('Deposited resources');
}

function withdrawAll() {
  const box = game.activeStorage;
  if (!box) return;
  for (const [k, v] of Object.entries(box.inventory)) {
    if (v > 0) {
      game.player.addItem(k, v);
      box.inventory[k] = 0;
    }
  }
  UI.refreshStorage();
  UI.toast('Withdrew resources');
}

function attemptPlace(worldX, worldY) {
  const id = game.buildSelection;
  if (!id) return;
  const recipe = getRecipe(id);
  if (!recipe || !game.player.hasItems(recipe.cost)) { UI.toast('Not enough resources'); return; }
  if (!canPlace(game.structures, id, worldX, worldY)) { UI.toast('Too close to another structure'); return; }
  if (dist(worldX, worldY, game.player.x, game.player.y) > 260) { UI.toast('Too far away'); return; }
  game.player.removeItems(recipe.cost);
  placeStructure(game.structures, id, worldX, worldY);
  UI.toast(`Placed ${recipe.name}`);
  game.buildSelection = null;
}

// ---------- Player movement & stats ----------
function updatePlayerMovement(dt) {
  const p = game.player;
  const k = game.keys;
  let dx = 0, dy = 0;
  if (k.has('w') || k.has('arrowup')) dy -= 1;
  if (k.has('s') || k.has('arrowdown')) dy += 1;
  if (k.has('a') || k.has('arrowleft')) dx -= 1;
  if (k.has('d') || k.has('arrowright')) dx += 1;
  if (dx === 0 && dy === 0) return;
  const len = Math.hypot(dx, dy);
  dx /= len; dy /= len;
  p.facing = { x: dx, y: dy };
  const sprinting = k.has('shift') && p.stamina > 2;
  const speed = sprinting ? 280 : 180;
  if (sprinting) p.stamina = clamp(p.stamina - 24 * dt, 0, p.maxStamina);
  const nx = clamp(p.x + dx * speed * dt, 30, WORLD_W - 30);
  const ny = clamp(p.y + dy * speed * dt, 30, WORLD_H - 30);
  if (!collidesSolid(game.structures, nx, p.y, 16)) p.x = nx;
  if (!collidesSolid(game.structures, p.x, ny, 16)) p.y = ny;
}

function updatePlayerStats(dt) {
  const p = game.player;
  if (!p.alive) return;
  const moving = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].some((k) => game.keys.has(k));
  const sprinting = game.keys.has('shift') && moving;
  if (!sprinting) p.stamina = clamp(p.stamina + 14 * dt, 0, p.maxStamina);

  p.hunger = clamp(p.hunger - 0.12 * dt, 0, 100);
  p.thirst = clamp(p.thirst - 0.16 * dt, 0, 100);
  let dmg = 0;
  if (p.hunger <= 0) dmg += 1.2 * dt;
  if (p.thirst <= 0) dmg += 1.8 * dt;
  if (dmg > 0) applyDamageToPlayer(dmg);

  if (p.attackCooldown > 0) p.attackCooldown -= dt;
}

function applyDamageToPlayer(amount) {
  const p = game.player;
  p.health = clamp(p.health - amount, 0, p.maxHealth);
  if (p.health <= 0 && p.alive) killPlayer();
}

function killPlayer() {
  game.player.alive = false;
  UI.showDeath(true);
  setTimeout(respawnPlayer, 3000);
}

function respawnPlayer() {
  const p = game.player;
  p.health = p.maxHealth * 0.6;
  p.hunger = 60;
  p.thirst = 60;
  p.x = p.spawnX;
  p.y = p.spawnY;
  p.alive = true;
  UI.showDeath(false);
}

function updateCampfires(dt) {
  for (const s of game.structures) {
    if (s.type !== 'campfire' || !s.lit) continue;
    s.fuel -= dt;
    if (s.fuel <= 0) { s.lit = false; s.fuel = 0; }
  }
}

// ---------- Creature AI ----------
function moveToward(c, tx, ty, speed, dt) {
  const d = dist(c.x, c.y, tx, ty);
  if (d < 4) return;
  const dx = (tx - c.x) / d, dy = (ty - c.y) / d;
  c.facing = dx >= 0 ? 1 : -1;
  c.x = clamp(c.x + dx * speed * dt, 20, WORLD_W - 20);
  c.y = clamp(c.y + dy * speed * dt, 20, WORLD_H - 20);
}
function moveAway(c, fx, fy, speed, dt) {
  const d = dist(c.x, c.y, fx, fy) || 1;
  const dx = (c.x - fx) / d, dy = (c.y - fy) / d;
  c.facing = dx >= 0 ? 1 : -1;
  c.x = clamp(c.x + dx * speed * dt, 20, WORLD_W - 20);
  c.y = clamp(c.y + dy * speed * dt, 20, WORLD_H - 20);
}
function wander(c, dt) {
  c.wanderCooldown -= dt;
  if (!c.wanderTarget || c.wanderCooldown <= 0) {
    c.wanderTarget = {
      x: clamp(c.x + rand(-160, 160), 40, WORLD_W - 40),
      y: clamp(c.y + rand(-160, 160), 40, WORLD_H - 40),
    };
    c.wanderCooldown = rand(4, 8);
  }
  moveToward(c, c.wanderTarget.x, c.wanderTarget.y, c.def.speed * 0.4, dt);
}

function updateTamedAI(c, dt) {
  const p = game.player;
  const def = c.def;
  let hostile = null, best = 240;
  for (const other of game.creatures) {
    if (other.tamed || !other.def.aggressive) continue;
    const d = dist(other.x, other.y, c.x, c.y);
    if (d < best) { best = d; hostile = other; }
  }
  if (hostile) {
    moveToward(c, hostile.x, hostile.y, def.speed * 1.1, dt);
    if (dist(c.x, c.y, hostile.x, hostile.y) < 34 && c.attackCooldown <= 0) {
      damageCreature(hostile, 14, 'tamed');
      c.attackCooldown = 1.0;
    }
    return;
  }
  if (dist(c.x, c.y, p.x, p.y) > 60) moveToward(c, p.x, p.y, def.speed, dt);
}

function updateCreatures(dt) {
  const p = game.player;
  const night = isNight();
  for (const c of game.creatures) {
    if (c.attackCooldown > 0) c.attackCooldown -= dt;
    const def = c.def;

    if (c.tamed) { updateTamedAI(c, dt); continue; }

    if (def.aggressive) {
      const aggroRadius = night ? 420 : 260;
      const d = dist(c.x, c.y, p.x, p.y);
      if (c.state === 'chase' || d < aggroRadius) {
        c.state = 'chase';
        if (p.alive) {
          moveToward(c, p.x, p.y, def.speed, dt);
          if (d < 34 && c.attackCooldown <= 0) {
            applyDamageToPlayer(def.dmg);
            c.attackCooldown = 1.1;
          }
        }
        if (d > 700) c.state = 'wander';
      } else {
        wander(c, dt);
      }
    } else if (c.state === 'flee') {
      if (game.time.t > c.fleeUntil) c.state = 'wander';
      else moveAway(c, p.x, p.y, def.speed * 1.2, dt);
    } else {
      wander(c, dt);
    }
  }
}

function spawnCreature(type) {
  const p = game.player;
  let x, y, d, tries = 0;
  do {
    x = rand(60, WORLD_W - 60);
    y = rand(60, WORLD_H - 60);
    d = dist(x, y, p.x, p.y);
    tries++;
  } while ((d < 500 || d > 1700) && tries < 20);
  game.creatures.push(new Creature(type, x, y));
}

function maintainSpawns(dt) {
  game.spawnTimer += dt;
  if (game.spawnTimer < 3) return;
  game.spawnTimer = 0;

  const night = isNight();
  const counts = { dodo: 0, trike: 0, raptor: 0 };
  for (const c of game.creatures) counts[c.type] = (counts[c.type] || 0) + 1;
  const caps = { dodo: 10, trike: 6, raptor: night ? 10 : 4 };
  for (const type of Object.keys(caps)) {
    if (counts[type] < caps[type] && Math.random() < 0.6) spawnCreature(type);
  }
}

// ---------- Main update ----------
function update(dt) {
  game.time.t += dt;
  updateNodeRespawns(game.world.nodes, game.time.t);

  if (game.player.alive && !UI.isAnyPanelOpen()) updatePlayerMovement(dt);
  updatePlayerStats(dt);
  updateCampfires(dt);
  updateCreatures(dt);
  maintainSpawns(dt);
  UI.updateHUD(game.player, game.time);

  game.saveTimer += dt;
  if (game.saveTimer > 8) {
    game.saveTimer = 0;
    saveGame(game);
  }
}

// ---------- Rendering ----------
function drawStructure(s) {
  const def = STRUCTURE_TYPES[s.type];
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (s.type === 'campfire') {
    ctx.font = '30px serif';
    ctx.fillText(s.lit ? '🔥' : '🪵', 0, 0);
  } else if (def.inventory) {
    ctx.font = '28px serif';
    ctx.fillText(def.icon, 0, 0);
  } else {
    ctx.fillStyle = def.color;
    ctx.globalAlpha = def.solid ? 0.9 : 0.55;
    ctx.fillRect(-def.size / 2, -def.size / 2, def.size, def.size);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.strokeRect(-def.size / 2, -def.size / 2, def.size, def.size);
  }
  ctx.restore();
}

function drawBar(x, y, w, h, pct, color) {
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y - h / 2, w * clamp(pct, 0, 1), h);
}

function drawCreature(c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.facing, 1);
  ctx.font = '30px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.def.icon, 0, 0);
  ctx.restore();

  if (c.hp < c.maxHp) drawBar(c.x, c.y - 26, 34, 5, c.hp / c.maxHp, '#c23a3a');
  if (!c.tamed && !c.def.aggressive && c.tameProgress > 0) {
    drawBar(c.x, c.y - 32, 34, 5, c.tameProgress, '#c7c23a');
  }
  if (c.tamed) {
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.fillText('💚', c.x, c.y - 30);
  }
}

function drawPlayer(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.facing.x < 0 ? -1 : 1, 1);
  ctx.font = '32px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.alive ? '🧑' : '💀', 0, 0);
  ctx.restore();
}

function drawGhost() {
  const wx = game.camera.x + (game.mouseScreen.x - canvas.width / 2);
  const wy = game.camera.y + (game.mouseScreen.y - canvas.height / 2);
  const sx = snap(wx, TILE), sy = snap(wy, TILE);
  const def = STRUCTURE_TYPES[game.buildSelection];
  const valid = canPlace(game.structures, game.buildSelection, wx, wy) &&
    dist(wx, wy, game.player.x, game.player.y) <= 260;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = valid ? '#63c263' : '#c23a3a';
  ctx.translate(sx, sy);
  ctx.fillRect(-def.size / 2, -def.size / 2, def.size, def.size);
  ctx.restore();
}

let nightCanvas = null;
function getNightCanvas() {
  if (!nightCanvas || nightCanvas.width !== canvas.width || nightCanvas.height !== canvas.height) {
    nightCanvas = document.createElement('canvas');
    nightCanvas.width = canvas.width;
    nightCanvas.height = canvas.height;
  }
  return nightCanvas;
}
function punchLight(octx, x, y, r) {
  const grad = octx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  octx.fillStyle = grad;
  octx.beginPath();
  octx.arc(x, y, r, 0, Math.PI * 2);
  octx.fill();
}
function drawNightOverlay() {
  const factor = nightFactor(game.time.t);
  if (factor <= 0) return;
  const alpha = factor * 0.72;
  const off = getNightCanvas();
  const octx = off.getContext('2d');
  octx.globalCompositeOperation = 'source-over';
  octx.clearRect(0, 0, off.width, off.height);
  octx.fillStyle = `rgba(8,10,35,${alpha})`;
  octx.fillRect(0, 0, off.width, off.height);

  octx.globalCompositeOperation = 'destination-out';
  punchLight(octx, canvas.width / 2, canvas.height / 2, 130);
  for (const s of game.structures) {
    if (s.type === 'campfire' && s.lit) {
      const sx = canvas.width / 2 + (s.x - game.camera.x);
      const sy = canvas.height / 2 + (s.y - game.camera.y);
      punchLight(octx, sx, sy, STRUCTURE_TYPES.campfire.light);
    }
  }
  ctx.drawImage(off, 0, 0);
}

function render() {
  const p = game.player;
  game.camera.x = clamp(p.x, canvas.width / 2, WORLD_W - canvas.width / 2);
  game.camera.y = clamp(p.y, canvas.height / 2, WORLD_H - canvas.height / 2);

  ctx.save();
  ctx.fillStyle = grassPattern;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2 - game.camera.x, canvas.height / 2 - game.camera.y);

  ctx.fillStyle = 'rgba(45,110,150,0.85)';
  for (const w of game.world.ponds) {
    ctx.beginPath();
    ctx.ellipse(w.x, w.y, w.r, w.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = '30px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const n of game.world.nodes) {
    if (n.alive) ctx.fillText(RESOURCE_TYPES[n.type].icon, n.x, n.y);
  }

  for (const s of game.structures) drawStructure(s);
  for (const c of game.creatures) drawCreature(c);
  drawPlayer(p);
  if (game.buildSelection && game.mouseScreen) drawGhost();

  ctx.restore();
  drawNightOverlay();
}

// ---------- Loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (game.running) {
    update(dt);
    render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('beforeunload', () => {
  if (game.running) saveGame(game);
});
