import balance from "../rules/balance.json";
import level from "../content/levels/level_1.json";
import enemiesDef from "../content/enemies.json";
import dialog from "../content/dialog.json";
import assetsManifest from "../content/assets.json";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hpEl = document.getElementById("hp");
const goldEl = document.getElementById("gold");
const coinsEl = document.getElementById("coins");
const timerEl = document.getElementById("timer");
const waveEl = document.getElementById("wave");
const messageEl = document.getElementById("message");
const healBtn = document.getElementById("heal-btn");
const telemetryEl = document.getElementById("telemetry-status");

const SHRINE = { x: level.playerStart.x, y: level.playerStart.y - 40, radius: 24 };
const keys = new Set();
const LS_KEY = "evolving-game-telemetry";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
    saved: false,
  };
}

function createState() {
  return {
    player: {
      x: level.playerStart.x,
      y: level.playerStart.y,
      hp: balance.player.maxHp,
      radius: 12,
    },
    gold: 0,
    coinsCollected: 0,
    coins: level.coins.map((c) => ({ ...c, taken: false })),
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

let session = createSession();
let state = createState();
const sprites = {};
let spritesReady = false;

async function loadSprites() {
  try {
    await Promise.all(
      Object.entries(assetsManifest.sprites).map(([key, path]) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            sprites[key] = img;
            resolve();
          };
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

function spawnEnemy() {
  const spawn = level.enemySpawns[Math.floor(Math.random() * level.enemySpawns.length)];
  const typeKey = state.lastSpawnTypes[state.enemies.length % state.lastSpawnTypes.length];
  const type = enemiesDef.enemies[typeKey] ?? enemiesDef.enemies.shadow;
  const scale = 1 + (state.wave - 1) * balance.waves.difficultyScalePerWave;

  state.enemies.push({
    x: spawn.x,
    y: spawn.y,
    hp: Math.round(balance.enemy.hp * scale),
    speed: balance.enemy.speed * (1 + (state.wave - 1) * 0.05),
    damage: Math.round(balance.enemy.damage * scale),
    radius: type.size,
    color: type.color,
    behavior: type.behavior,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
  });

  if (state.enemies.length >= balance.waves.maxEnemiesOnScreen) {
    state.wave += 1;
  }
}

function tryHeal() {
  if (state.over) return;
  if (dist(state.player, SHRINE) > SHRINE.radius + state.player.radius) {
    say("Stand near the shrine to heal.");
    return;
  }
  if (state.gold < balance.economy.healCost) {
    say(dialog.onNotEnoughGold);
    return;
  }
  state.gold -= balance.economy.healCost;
  state.player.hp = clamp(
    state.player.hp + balance.economy.healAmount,
    0,
    balance.player.maxHp
  );
  session.healsUsed += 1;
  say(dialog.onHeal);
  logEvent("heal");
}

function update(dt) {
  if (state.over) return;

  state.elapsed += dt;
  const timeLeft = Math.max(0, level.winCondition.surviveSeconds - state.elapsed);
  if (timeLeft <= 0 && state.coinsCollected < level.winCondition.coinsRequired) {
    say(dialog.onLose);
    finishRun("lose", { reason: "timeout" });
    return;
  }

  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowUp") || keys.has("w")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;
  if (keys.has("ArrowLeft") || keys.has("a")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    state.player.x = clamp(state.player.x + (dx / len) * balance.player.speed, 16, level.width - 16);
    state.player.y = clamp(state.player.y + (dy / len) * balance.player.speed, 16, level.height - 16);
  }

  for (const coin of state.coins) {
    if (!coin.taken && dist(state.player, coin) < state.player.radius + 10) {
      coin.taken = true;
      state.coinsCollected += 1;
      state.gold += balance.economy.coinValue;
      say(dialog.onCoinCollect);
      logEvent("coin_collect", { total: state.coinsCollected });
    }
  }

  state.spawnTimer += dt * 1000;
  if (
    state.spawnTimer >= balance.enemy.spawnIntervalMs &&
    state.enemies.length < balance.waves.maxEnemiesOnScreen
  ) {
    state.spawnTimer = 0;
    spawnEnemy();
  }

  for (const enemy of state.enemies) {
    if (enemy.behavior === "chase") {
      const d = dist(enemy, state.player) || 1;
      enemy.x += (state.player.x - enemy.x) / d * enemy.speed;
      enemy.y += (state.player.y - enemy.y) / d * enemy.speed;
    } else {
      enemy.x += enemy.vx;
      enemy.y += enemy.vy;
      if (enemy.x < 20 || enemy.x > level.width - 20) enemy.vx *= -1;
      if (enemy.y < 20 || enemy.y > level.height - 20) enemy.vy *= -1;
    }

    if (dist(enemy, state.player) < enemy.radius + state.player.radius) {
      state.player.hp -= enemy.damage * dt;
      if (state.player.hp <= 0) {
        say(dialog.onLose);
        finishRun("lose", {
          reason: "death",
          deathX: Math.round(state.player.x),
          deathY: Math.round(state.player.y),
        });
      } else if (state.player.hp < balance.player.maxHp * 0.3) {
        say(dialog.onLowHp);
      }
    }
  }

  if (
    state.coinsCollected >= level.winCondition.coinsRequired &&
    state.elapsed >= level.winCondition.surviveSeconds
  ) {
    say(dialog.onWin);
    finishRun("win");
  }
}

function draw() {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, level.width, level.height);

  ctx.strokeStyle = "#1e293b";
  for (let x = 0; x < level.width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, level.height);
    ctx.stroke();
  }
  for (let y = 0; y < level.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(level.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#334155";
  drawSprite("shrine", SHRINE.x, SHRINE.y, 48, () => {
    ctx.beginPath();
    ctx.arc(SHRINE.x, SHRINE.y, SHRINE.radius, 0, Math.PI * 2);
    ctx.fill();
  });

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
  const timeLeft = Math.max(0, Math.ceil(level.winCondition.surviveSeconds - state.elapsed));
  timerEl.textContent = `Time: ${timeLeft}s`;
  waveEl.textContent = `Wave: ${state.wave}`;
}

function restart() {
  session = createSession();
  state = createState();
  setTelemetryStatus("new run", "idle");
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
  keys.add(e.key);
  if (e.key === "h" || e.key === "H") tryHeal();
  if (e.key === "r" || e.key === "R") restart();
});
window.addEventListener("keyup", (e) => keys.delete(e.key));
healBtn.addEventListener("click", tryHeal);

setTelemetryStatus("ready", "idle");
say(level.tutorialLines[0]);
loadSprites().then(() => requestAnimationFrame(loop));

export { balance, level, enemiesDef, dialog, createState, dist, clamp };
