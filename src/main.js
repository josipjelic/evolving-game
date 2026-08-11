import balance from "../rules/balance.json";
import levelTemplate from "../content/levels/level_1.json";
import enemiesDef from "../content/enemies.json";
import dialog from "../content/dialog.json";
import assetsManifest from "../content/assets.json";
import { parseLevel, tileCenter, moveCircle, circleHitsWall, drawMap } from "./map.js";
import { generateLevel } from "./maze-gen.js";

let map;
let level;
let TS;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hpEl = document.getElementById("hp");
const goldEl = document.getElementById("gold");
const coinsEl = document.getElementById("coins");
const keysEl = document.getElementById("keys");
const timerEl = document.getElementById("timer");
const waveEl = document.getElementById("wave");
const messageEl = document.getElementById("message");
const healBtn = document.getElementById("heal-btn");
const telemetryEl = document.getElementById("telemetry-status");
document.getElementById("subtitle").textContent = levelTemplate.name;

function initLevel(seed) {
  level = generateLevel(levelTemplate, seed ?? Date.now());
  map = parseLevel(level);
  TS = map.tileSize;
  canvas.width = map.width;
  canvas.height = map.height;
  document.querySelector("header h1").textContent = level.name;
}

const keySet = new Set();
const LS_KEY = "evolving-game-telemetry";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function tw(tx, ty) {
  return tileCenter(tx, ty, TS);
}

function newSessionId() {
  return `human-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSession() {
  return {
    sessionId: newSessionId(),
    player: "human",
    levelId: level.id,
    startedAt: new Date().toISOString(),
    events: [],
    healsUsed: 0,
    chestsOpened: 0,
    saved: false,
  };
}

function createState() {
  const start = tw(level.playerStart.tx, level.playerStart.ty);
  return {
    player: { ...start, hp: balance.player.maxHp, radius: 12 },
    gold: 0,
    coinsCollected: 0,
    keysHeld: new Set(),
    openDoors: new Set(),
    coins: (level.coins ?? []).map((c) => ({ ...tw(c.tx, c.ty), taken: false })),
    keys: (level.keys ?? []).map((k) => ({ ...k, ...tw(k.tx, k.ty), taken: false })),
    chests: (level.chests ?? []).map((c) => ({ ...tw(c.tx, c.ty), gold: c.gold, opened: false })),
    shrines: (level.shrines ?? []).map((s) => ({ ...tw(s.tx, s.ty), type: s.type, radius: 22 })),
    hazards: (level.hazards ?? []).map((h) => ({ ...tw(h.tx, h.ty), radius: h.radius, dps: h.dps })),
    enemies: [],
    elapsed: 0,
    wave: 1,
    spawnTimer: 0,
    over: false,
    won: false,
    finished: false,
    lastSpawnTypes: enemiesDef.levelEnemyMap[level.id] ?? ["shadow"],
  };
}

let session;
let state;
const sprites = {};
let spritesReady = false;

async function loadSprites() {
  try {
    await Promise.all(
      Object.entries(assetsManifest.sprites).map(([key, path]) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => { sprites[key] = img; resolve(); };
          img.onerror = reject;
          img.src = path;
        })
      )
    );
    spritesReady = true;
  } catch {
    spritesReady = false;
  }
}

function drawSprite(key, x, y, size, fallbackDraw) {
  const img = sprites[key];
  if (spritesReady && img) {
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    return;
  }
  fallbackDraw();
}

function say(text) {
  messageEl.textContent = text;
}

function setTelemetryStatus(text, kind = "idle") {
  telemetryEl.textContent = `Telemetry: ${text}`;
  telemetryEl.className = kind === "saved" ? "saved" : kind === "error" ? "error" : "telemetry-idle";
}

function logEvent(type, data = {}) {
  const entry = {
    type,
    at: new Date().toISOString(),
    elapsed: state.elapsed,
    wave: state.wave,
    hp: state.player.hp,
    gold: state.gold,
    coins: state.coinsCollected,
    keys: [...state.keysHeld],
    playerX: Math.round(state.player.x),
    playerY: Math.round(state.player.y),
    ...data,
  };
  session.events.push(entry);
  const existing = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  existing.push(entry);
  localStorage.setItem(LS_KEY, JSON.stringify(existing.slice(-500)));
}

async function saveSession(outcome, extra = {}) {
  if (session.saved) return;
  session.saved = true;
  const payload = {
    sessionId: session.sessionId,
    player: "human",
    levelId: level.id,
    startedAt: session.startedAt,
    endedAt: new Date().toISOString(),
    outcome,
    durationSeconds: Math.round(state.elapsed),
    wave: state.wave,
    coinsCollected: state.coinsCollected,
    coinsRequired: level.winCondition.coinsRequired,
    healsUsed: session.healsUsed,
    chestsOpened: session.chestsOpened,
    gold: state.gold,
    finalHp: Math.round(Math.max(0, state.player.hp)),
    events: session.events,
    ...extra,
  };
  if (!import.meta.env.DEV) {
    setTelemetryStatus("local only (build)", "idle");
    return;
  }
  setTelemetryStatus("saving…", "idle");
  try {
    const res = await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setTelemetryStatus(`saved ${data.file}`, "saved");
  } catch {
    setTelemetryStatus("save failed — still in localStorage", "error");
  }
}

function finishRun(outcome, extra = {}) {
  if (state.finished) return;
  state.finished = true;
  state.over = true;
  state.won = outcome === "win";
  logEvent(outcome === "win" ? "win" : "lose", extra);
  saveSession(outcome, extra);
}

function tryOpenDoors() {
  for (const door of level.doors ?? []) {
    const key = `${door.tx},${door.ty}`;
    if (state.openDoors.has(key)) continue;
    if (!state.keysHeld.has(door.keyId)) continue;
    const dc = tw(door.tx, door.ty);
    if (dist(state.player, dc) < TS * 1.2) {
      state.openDoors.add(key);
      say(`The ${door.keyId} gate opens!`);
      logEvent("door_open", { keyId: door.keyId });
    }
  }
}

function spawnEnemy() {
  const spawns = level.enemySpawns ?? [];
  if (!spawns.length) return;
  const s = spawns[Math.floor(Math.random() * spawns.length)];
  const pos = tw(s.tx, s.ty);
  const typeKey = state.lastSpawnTypes[state.enemies.length % state.lastSpawnTypes.length];
  const type = enemiesDef.enemies[typeKey] ?? enemiesDef.enemies.shadow;
  const scale = 1 + (state.wave - 1) * balance.waves.difficultyScalePerWave;

  state.enemies.push({
    x: pos.x,
    y: pos.y,
    hp: Math.round(balance.enemy.hp * scale),
    speed: balance.enemy.speed * (1 + (state.wave - 1) * 0.05),
    damage: Math.round(balance.enemy.damage * scale),
    radius: type.size,
    color: type.color,
    behavior: type.behavior,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
  });

  if (state.enemies.length >= balance.waves.maxEnemiesOnScreen) state.wave += 1;
}

function nearestShrine() {
  return state.shrines.reduce((best, s) => {
    const d = dist(state.player, s);
    return d < best.d ? { d, s } : best;
  }, { d: Infinity, s: null }).s;
}

function tryHeal() {
  if (state.over) return;
  const shrine = nearestShrine();
  if (!shrine || dist(state.player, shrine) > shrine.radius + state.player.radius) {
    say("Stand near a shrine to heal.");
    return;
  }
  if (state.gold < balance.economy.healCost) {
    say(dialog.onNotEnoughGold);
    return;
  }
  state.gold -= balance.economy.healCost;
  state.player.hp = clamp(state.player.hp + balance.economy.healAmount, 0, balance.player.maxHp);
  session.healsUsed += 1;
  say(dialog.onHeal);
  logEvent("heal");
}

function collectPickups() {
  for (const coin of state.coins) {
    if (!coin.taken && dist(state.player, coin) < state.player.radius + 12) {
      coin.taken = true;
      state.coinsCollected += 1;
      state.gold += balance.economy.coinValue;
      say(dialog.onCoinCollect);
      logEvent("coin_collect", { total: state.coinsCollected });
    }
  }

  for (const key of state.keys) {
    if (!key.taken && dist(state.player, key) < state.player.radius + 14) {
      key.taken = true;
      state.keysHeld.add(key.id);
      say(`Picked up ${key.id} key.`);
      logEvent("key_pickup", { keyId: key.id });
    }
  }

  for (const chest of state.chests) {
    if (!chest.opened && dist(state.player, chest) < state.player.radius + 14) {
      chest.opened = true;
      state.gold += chest.gold;
      session.chestsOpened += 1;
      say(`Chest! +${chest.gold} gold.`);
      logEvent("chest_open", { gold: chest.gold });
    }
  }

  tryOpenDoors();
}

function updateEnemies(dt) {
  for (const enemy of state.enemies) {
    let dx = 0;
    let dy = 0;
    if (enemy.behavior === "chase") {
      const d = dist(enemy, state.player) || 1;
      dx = (state.player.x - enemy.x) / d * enemy.speed;
      dy = (state.player.y - enemy.y) / d * enemy.speed;
    } else {
      dx = enemy.vx;
      dy = enemy.vy;
    }

    const moved = moveCircle(enemy, dx, dy, map.walls, map, state.openDoors);
    enemy.x = moved.x;
    enemy.y = moved.y;

    if (enemy.behavior === "patrol") {
      if (circleHitsWall(enemy.x + enemy.vx, enemy.y, enemy.radius, map.walls, state.openDoors)) enemy.vx *= -1;
      if (circleHitsWall(enemy.x, enemy.y + enemy.vy, enemy.radius, map.walls, state.openDoors)) enemy.vy *= -1;
    }

    if (dist(enemy, state.player) < enemy.radius + state.player.radius) {
      state.player.hp -= enemy.damage * dt;
      if (state.player.hp <= 0) {
        say(dialog.onLose);
        finishRun("lose", { reason: "death", deathX: Math.round(state.player.x), deathY: Math.round(state.player.y) });
      } else if (state.player.hp < balance.player.maxHp * 0.3) {
        say(dialog.onLowHp);
      }
    }
  }
}

function update(dt) {
  if (state.over) return;

  state.elapsed += dt;
  const timeLeft = level.winCondition.surviveSeconds - state.elapsed;
  if (timeLeft <= 0 && state.coinsCollected < level.winCondition.coinsRequired) {
    say(dialog.onLose);
    finishRun("lose", { reason: "timeout" });
    return;
  }

  let dx = 0;
  let dy = 0;
  if (keySet.has("ArrowUp") || keySet.has("w")) dy -= 1;
  if (keySet.has("ArrowDown") || keySet.has("s")) dy += 1;
  if (keySet.has("ArrowLeft") || keySet.has("a")) dx -= 1;
  if (keySet.has("ArrowRight") || keySet.has("d")) dx += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    const moved = moveCircle(
      state.player,
      (dx / len) * balance.player.speed,
      (dy / len) * balance.player.speed,
      map.walls,
      map,
      state.openDoors
    );
    state.player.x = moved.x;
    state.player.y = moved.y;
  }

  collectPickups();

  for (const hazard of state.hazards) {
    if (dist(state.player, hazard) < hazard.radius) {
      state.player.hp -= hazard.dps * dt;
      if (state.player.hp <= 0) {
        say(dialog.onLose);
        finishRun("lose", { reason: "hazard", deathX: Math.round(state.player.x), deathY: Math.round(state.player.y) });
        return;
      }
    }
  }

  state.spawnTimer += dt * 1000;
  if (state.spawnTimer >= balance.enemy.spawnIntervalMs && state.enemies.length < balance.waves.maxEnemiesOnScreen) {
    state.spawnTimer = 0;
    spawnEnemy();
  }

  updateEnemies(dt);

  if (state.coinsCollected >= level.winCondition.coinsRequired && state.elapsed >= level.winCondition.surviveSeconds) {
    say(dialog.onWin);
    finishRun("win");
  }
}

function draw() {
  drawMap(ctx, map, state.openDoors);

  for (const hazard of state.hazards) {
    ctx.fillStyle = "rgba(139, 92, 246, 0.25)";
    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(167, 139, 250, 0.5)";
    ctx.stroke();
  }

  for (const shrine of state.shrines) {
    drawSprite("shrine", shrine.x, shrine.y, 44, () => {
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.arc(shrine.x, shrine.y, shrine.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  for (const chest of state.chests) {
    if (chest.opened) continue;
    ctx.fillStyle = "#b45309";
    ctx.fillRect(chest.x - 10, chest.y - 8, 20, 16);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(chest.x - 8, chest.y - 10, 16, 4);
  }

  for (const key of state.keys) {
    if (key.taken) continue;
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(key.x - 6, key.y - 3, 12, 6);
    ctx.beginPath();
    ctx.arc(key.x - 4, key.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const coin of state.coins) {
    if (coin.taken) continue;
    drawSprite("crystal", coin.x, coin.y, 18, () => {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  for (const enemy of state.enemies) {
    const spriteKey = enemy.behavior === "patrol" ? "wisp" : "shadow";
    drawSprite(spriteKey, enemy.x, enemy.y, enemy.radius * 2.2, () => {
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawSprite("player", state.player.x, state.player.y, 26, () => {
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  hpEl.textContent = `HP: ${Math.max(0, Math.round(state.player.hp))}`;
  goldEl.textContent = `Gold: ${state.gold}`;
  coinsEl.textContent = `Crystals: ${state.coinsCollected}/${level.winCondition.coinsRequired}`;
  keysEl.textContent = `Keys: ${state.keysHeld.size ? [...state.keysHeld].join(", ") : "none"}`;
  timerEl.textContent = `Time: ${Math.max(0, Math.ceil(level.winCondition.surviveSeconds - state.elapsed))}s`;
  waveEl.textContent = `Wave: ${state.wave}`;
}

function restart() {
  session = createSession();
  initLevel(Date.now());
  state = createState();
  setTelemetryStatus("new maze", "idle");
  say(level.tutorialLines[0]);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  keySet.add(e.key);
  if (e.key === "h" || e.key === "H") tryHeal();
  if (e.key === "r" || e.key === "R") restart();
});
window.addEventListener("keyup", (e) => keySet.delete(e.key));
healBtn.addEventListener("click", tryHeal);

initLevel();
session = createSession();
state = createState();
setTelemetryStatus("ready", "idle");
say(level.tutorialLines[0]);
loadSprites().then(() => requestAnimationFrame(loop));

export { balance, level, enemiesDef, dialog, createState, dist, clamp, map };
