import { RECIPES, isUnlocked } from './crafting.js';
import { STRUCTURE_TYPES } from './building.js';
import { ITEM_META } from './items.js';
import { clamp } from './utils.js';

let dom = {};
let game = null;

export function initUI(g) {
  game = g;
  dom = {
    hud: document.getElementById('hud'),
    toolbar: document.getElementById('toolbar'),
    hpFill: document.getElementById('hpFill'), hpLabel: document.getElementById('hpLabel'),
    stFill: document.getElementById('stFill'), stLabel: document.getElementById('stLabel'),
    hgFill: document.getElementById('hgFill'), hgLabel: document.getElementById('hgLabel'),
    thFill: document.getElementById('thFill'), thLabel: document.getElementById('thLabel'),
    lvl: document.getElementById('lvl'), xpFill: document.getElementById('xpFill'),
    clockIcon: document.getElementById('clockIcon'), clockLabel: document.getElementById('clockLabel'),
    equippedToolLabel: document.getElementById('equippedToolLabel'),
    equippedWeaponLabel: document.getElementById('equippedWeaponLabel'),
    toast: document.getElementById('toast'),
    inventoryList: document.getElementById('inventoryList'),
    craftingList: document.getElementById('craftingList'),
    buildingList: document.getElementById('buildingList'),
    storageList: document.getElementById('storageList'),
    panels: document.querySelectorAll('.panel'),
    deathScreen: document.getElementById('deathScreen'),
    startScreen: document.getElementById('startScreen'),
    newGameBtn: document.getElementById('newGameBtn'),
    continueBtn: document.getElementById('continueBtn'),
    depositAllBtn: document.getElementById('depositAllBtn'),
    withdrawAllBtn: document.getElementById('withdrawAllBtn'),
  };

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeAllPanels());
  });
  document.querySelectorAll('#menuButtons button').forEach((btn) => {
    btn.addEventListener('click', () => game.togglePanel(btn.dataset.panel));
  });
  dom.depositAllBtn.addEventListener('click', () => game.depositAll());
  dom.withdrawAllBtn.addEventListener('click', () => game.withdrawAll());
  dom.newGameBtn.addEventListener('click', () => game.startNewGame());
  dom.continueBtn.addEventListener('click', () => game.continueGame());
}

export function showStartScreen(canContinue) {
  dom.startScreen.classList.remove('hidden');
  dom.continueBtn.classList.toggle('hidden', !canContinue);
}

export function hideStartScreen() {
  dom.startScreen.classList.add('hidden');
  dom.hud.classList.remove('hidden');
  dom.toolbar.classList.remove('hidden');
}

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'msg';
  el.textContent = msg;
  dom.toast.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export function showDeath(show) {
  dom.deathScreen.classList.toggle('hidden', !show);
}

export function isAnyPanelOpen() {
  return Array.from(dom.panels).some((p) => !p.classList.contains('hidden'));
}

export function closeAllPanels() {
  dom.panels.forEach((p) => p.classList.add('hidden'));
  if (game) game.onPanelsClosed();
}

export function togglePanelDom(id) {
  const el = document.getElementById(id);
  const wasHidden = el.classList.contains('hidden');
  dom.panels.forEach((p) => p.classList.add('hidden'));
  if (wasHidden) {
    el.classList.remove('hidden');
    if (id === 'inventoryPanel') refreshInventory();
    if (id === 'craftingPanel') refreshCrafting();
    if (id === 'buildingPanel') refreshBuilding();
  } else if (game) {
    game.onPanelsClosed();
  }
  return !wasHidden ? false : true;
}

export function openStoragePanel() {
  dom.panels.forEach((p) => p.classList.add('hidden'));
  document.getElementById('storagePanel').classList.remove('hidden');
  refreshStorage();
}

export function updateHUD(player, time) {
  setBar(dom.hpFill, dom.hpLabel, player.health, player.maxHealth, 'HP');
  setBar(dom.stFill, dom.stLabel, player.stamina, player.maxStamina, 'STA');
  setBar(dom.hgFill, dom.hgLabel, player.hunger, 100, 'FOOD');
  setBar(dom.thFill, dom.thLabel, player.thirst, 100, 'H2O');
  dom.lvl.textContent = player.level;
  dom.xpFill.style.width = `${clamp((player.xp / player.xpNext) * 100, 0, 100)}%`;
  dom.equippedToolLabel.textContent = player.equippedTool ? findRecipeName(player.equippedTool) : '-';
  dom.equippedWeaponLabel.textContent = player.equippedWeapon ? findRecipeName(player.equippedWeapon) : 'Fists';

  const dayNum = Math.floor(time.t / time.cycleLength) + 1;
  const frac = (time.t % time.cycleLength) / time.cycleLength;
  const isNight = frac > 0.5;
  dom.clockIcon.textContent = isNight ? '🌙' : '☀️';
  dom.clockLabel.textContent = `Day ${dayNum}`;
}

function findRecipeName(id) {
  const r = RECIPES.find((x) => x.id === id);
  return r ? `${r.icon} ${r.name}` : id;
}

function setBar(fillEl, labelEl, val, max, prefix) {
  const pct = clamp((val / max) * 100, 0, 100);
  fillEl.style.width = `${pct}%`;
  labelEl.textContent = `${prefix} ${Math.round(val)}/${Math.round(max)}`;
}

export function refreshInventory() {
  dom.inventoryList.innerHTML = '';
  const inv = game.player.inventory;
  const owned = game.player.owned;

  const resKeys = Object.keys(inv).filter((k) => inv[k] > 0);
  if (resKeys.length === 0 && Object.keys(owned).length === 0) {
    dom.inventoryList.innerHTML = '<p class="hintSmall">Empty. Go gather some resources!</p>';
    return;
  }

  for (const key of resKeys) {
    const meta = ITEM_META[key] || { icon: '❔', label: key };
    const row = document.createElement('div');
    row.className = 'itemRow';
    row.innerHTML = `<span class="icon">${meta.icon}</span><span class="name">${meta.label}</span><span class="qty">x${inv[key]}</span>`;
    if (meta.food) {
      const btn = document.createElement('button');
      btn.textContent = 'Eat';
      btn.addEventListener('click', () => { game.eat(key); refreshInventory(); });
      row.appendChild(btn);
    }
    dom.inventoryList.appendChild(row);
  }

  for (const id of Object.keys(owned)) {
    if (owned[id] <= 0) continue;
    const r = RECIPES.find((x) => x.id === id);
    if (!r) continue;
    const row = document.createElement('div');
    row.className = 'itemRow';
    const isEquipped = game.player.equippedTool === id || game.player.equippedWeapon === id;
    row.innerHTML = `<span class="icon">${r.icon}</span><span class="name">${r.name}</span><span class="qty">x${owned[id]}</span>`;
    const btn = document.createElement('button');
    btn.textContent = isEquipped ? 'Equipped' : 'Equip';
    btn.disabled = isEquipped;
    btn.addEventListener('click', () => { game.equip(r.category, id); refreshInventory(); });
    row.appendChild(btn);
    dom.inventoryList.appendChild(row);
  }
}

export function refreshCrafting() {
  dom.craftingList.innerHTML = '';
  for (const r of RECIPES) {
    const unlocked = isUnlocked(r, game.player.level);
    const canAfford = game.player.hasItems(r.cost);
    const row = document.createElement('div');
    row.className = 'recipeRow' + (unlocked ? '' : ' locked');
    const costStr = Object.entries(r.cost).map(([k, v]) => `${v} ${ITEM_META[k]?.label || k}`).join(', ');
    row.innerHTML = `<span class="icon">${r.icon}</span>
      <span class="name">${r.name}<br/><span class="cost">${costStr}</span></span>`;
    const btn = document.createElement('button');
    if (!unlocked) {
      btn.textContent = `Lv ${r.level}`;
      btn.disabled = true;
    } else {
      btn.textContent = r.category === 'structure' ? 'Select' : 'Craft';
      btn.disabled = !canAfford;
      btn.addEventListener('click', () => game.craftItem(r.id));
    }
    row.appendChild(btn);
    dom.craftingList.appendChild(row);
  }
}

export function refreshBuilding() {
  dom.buildingList.innerHTML = '';
  const structureRecipes = RECIPES.filter((r) => r.category === 'structure');
  for (const r of structureRecipes) {
    const unlocked = isUnlocked(r, game.player.level);
    const row = document.createElement('div');
    row.className = 'buildRow' + (unlocked ? '' : ' locked') + (game.buildSelection === r.id ? ' selected' : '');
    const costStr = Object.entries(r.cost).map(([k, v]) => `${v} ${ITEM_META[k]?.label || k}`).join(', ');
    row.innerHTML = `<span class="icon">${r.icon}</span><span class="name">${r.name}<br/><span class="cost">${costStr}</span></span>`;
    const btn = document.createElement('button');
    btn.textContent = !unlocked ? `Lv ${r.level}` : (game.buildSelection === r.id ? 'Selected' : 'Select');
    btn.disabled = !unlocked;
    btn.addEventListener('click', () => { game.setBuildSelection(r.id); closeAllPanels(); });
    row.appendChild(btn);
    dom.buildingList.appendChild(row);
  }
}

export function refreshStorage() {
  dom.storageList.innerHTML = '';
  const box = game.activeStorage;
  if (!box) return;
  const keys = Object.keys(box.inventory).filter((k) => box.inventory[k] > 0);
  if (keys.length === 0) {
    dom.storageList.innerHTML = '<p class="hintSmall">Storage box is empty.</p>';
    return;
  }
  for (const key of keys) {
    const meta = ITEM_META[key] || { icon: '❔', label: key };
    const row = document.createElement('div');
    row.className = 'itemRow';
    row.innerHTML = `<span class="icon">${meta.icon}</span><span class="name">${meta.label}</span><span class="qty">x${box.inventory[key]}</span>`;
    dom.storageList.appendChild(row);
  }
}
