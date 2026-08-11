import balance from "../rules/balance.json";
import level from "../content/levels/level_1.json";
import enemiesDef from "../content/enemies.json";
import dialog from "../content/dialog.json";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hpEl = document.getElementById("hp");
const goldEl = document.getElementById("gold");
const coinsEl = document.getElementById("coins");
const timerEl = document.getElementById("timer");
const waveEl = document.getElementById("wave");
const messageEl = document.getElementById("message");
const healBtn = document.getElementById("heal-btn");

const SHRINE = { x: level.playerStart.x, y: level.playerStart.y - 40, radius: 24 };
const keys = new Set();

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
    lastSpawnTypes: enemiesDef.levelEnemyMap[level.id] ?? ["shadow"],
  };
}

let state = createState();

function say(text) {
  messageEl.textContent = text;
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
  say(dialog.onHeal);
  logEvent("heal");
}

function update(dt) {
  if (state.over) return;

  state.elapsed += dt;
  const timeLeft = Math.max(0, level.winCondition.surviveSeconds - state.elapsed);
  if (timeLeft <= 0 && state.coinsCollected < level.winCondition.coinsRequired) {
    state.over = true;
    say(dialog.onLose);
    logEvent("lose", { reason: "timeout" });
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
        state.over = true;
        state.won = false;
        say(dialog.onLose);
        logEvent("lose", { reason: "death" });
      } else if (state.player.hp < balance.player.maxHp * 0.3) {
        say(dialog.onLowHp);
      }
    }
  }

  if (
    state.coinsCollected >= level.winCondition.coinsRequired &&
    state.elapsed >= level.winCondition.surviveSeconds
  ) {
    state.over = true;
    state.won = true;
    say(dialog.onWin);
    logEvent("win");
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
  ctx.beginPath();
  ctx.arc(SHRINE.x, SHRINE.y, SHRINE.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Shrine", SHRINE.x, SHRINE.y + 4);

  for (const coin of state.coins) {
    if (coin.taken) continue;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of state.enemies) {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
  ctx.fill();

  hpEl.textContent = `HP: ${Math.max(0, Math.round(state.player.hp))}`;
  goldEl.textContent = `Gold: ${state.gold}`;
  coinsEl.textContent = `Crystals: ${state.coinsCollected}/${level.winCondition.coinsRequired}`;
  const timeLeft = Math.max(0, Math.ceil(level.winCondition.surviveSeconds - state.elapsed));
  timerEl.textContent = `Time: ${timeLeft}s`;
  waveEl.textContent = `Wave: ${state.wave}`;
}

function logEvent(type, data = {}) {
  const entry = {
    type,
    at: new Date().toISOString(),
    wave: state.wave,
    hp: state.player.hp,
    gold: state.gold,
    coins: state.coinsCollected,
    ...data,
  };
  const key = "evolving-game-telemetry";
  const existing = JSON.parse(localStorage.getItem(key) ?? "[]");
  existing.push(entry);
  localStorage.setItem(key, JSON.stringify(existing.slice(-500)));
}

function restart() {
  state = createState();
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

say(level.tutorialLines[0]);
requestAnimationFrame(loop);

export { balance, level, enemiesDef, dialog, createState, dist, clamp };
