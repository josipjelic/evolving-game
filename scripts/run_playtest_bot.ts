import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

interface Vec2 {
  x: number;
  y: number;
}

interface Level {
  width: number;
  height: number;
  playerStart: Vec2;
  coins: Vec2[];
  enemySpawns: Vec2[];
  winCondition: { coinsRequired: number; surviveSeconds: number };
}

interface Balance {
  player: { maxHp: number; speed: number };
  enemy: { hp: number; speed: number; damage: number; spawnIntervalMs: number };
  waves: { maxEnemiesOnScreen: number; difficultyScalePerWave: number };
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Headless greedy bot: collect nearest coin, flee if enemy close */
function simulate(seed = 42) {
  let rng = seed;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0;
    return rng / 0xffffffff;
  };

  const balance: Balance = JSON.parse(readFileSync(join(ROOT, "rules/balance.json"), "utf8"));
  const level: Level = JSON.parse(readFileSync(join(ROOT, "content/levels/level_1.json"), "utf8"));

  const player = { ...level.playerStart, hp: balance.player.maxHp, radius: 12 };
  const coins = level.coins.map((c) => ({ ...c, taken: false }));
  let gold = 0;
  let collected = 0;
  let elapsed = 0;
  let wave = 1;
  const enemies: Array<Vec2 & { speed: number; damage: number; radius: number }> = [];
  let spawnTimer = 0;

  const dt = 1 / 60;
  const maxSteps = level.winCondition.surviveSeconds * 60 + 600;
  let deaths = 0;

  for (let step = 0; step < maxSteps; step++) {
    elapsed += dt;
    spawnTimer += dt * 1000;

    if (spawnTimer >= balance.enemy.spawnIntervalMs && enemies.length < balance.waves.maxEnemiesOnScreen) {
      spawnTimer = 0;
      const spawn = level.enemySpawns[Math.floor(rand() * level.enemySpawns.length)];
      const scale = 1 + (wave - 1) * balance.waves.difficultyScalePerWave;
      enemies.push({
        ...spawn,
        speed: balance.enemy.speed * (1 + (wave - 1) * 0.05),
        damage: Math.round(balance.enemy.damage * scale),
        radius: 16,
      });
      if (enemies.length >= balance.waves.maxEnemiesOnScreen) wave += 1;
    }

    const nearestEnemy = enemies.reduce<{ d: number; e: (typeof enemies)[0] | null }>(
      (best, e) => {
        const d = dist(player, e);
        return d < best.d ? { d, e } : best;
      },
      { d: Infinity, e: null }
    );

    let target: Vec2 | null = null;
    if (nearestEnemy.e && nearestEnemy.d < 80) {
      const e = nearestEnemy.e;
      const d = nearestEnemy.d || 1;
      target = { x: player.x - (e.x - player.x) / d * 100, y: player.y - (e.y - player.y) / d * 100 };
    } else {
      const remaining = coins.filter((c) => !c.taken);
      if (remaining.length) {
        target = remaining.reduce((best, c) => (dist(player, c) < dist(player, best) ? c : best));
      }
    }

    if (target) {
      const d = dist(player, target) || 1;
      player.x += ((target.x - player.x) / d) * balance.player.speed;
      player.y += ((target.y - player.y) / d) * balance.player.speed;
    }

    player.x = Math.max(16, Math.min(level.width - 16, player.x));
    player.y = Math.max(16, Math.min(level.height - 16, player.y));

    for (const coin of coins) {
      if (!coin.taken && dist(player, coin) < player.radius + 10) {
        coin.taken = true;
        collected += 1;
        gold += 5;
      }
    }

    for (const enemy of enemies) {
      const d = dist(enemy, player) || 1;
      enemy.x += ((player.x - enemy.x) / d) * enemy.speed;
      enemy.y += ((player.y - enemy.y) / d) * enemy.speed;
      if (dist(enemy, player) < enemy.radius + player.radius) {
        player.hp -= enemy.damage * dt;
      }
    }

    if (player.hp <= 0) {
      deaths += 1;
      player.hp = balance.player.maxHp;
      player.x = level.playerStart.x;
      player.y = level.playerStart.y;
    }

    if (collected >= level.winCondition.coinsRequired && elapsed >= level.winCondition.surviveSeconds) {
      break;
    }
    if (elapsed >= level.winCondition.surviveSeconds && collected < level.winCondition.coinsRequired) {
      break;
    }
  }

  const won = collected >= level.winCondition.coinsRequired && elapsed >= level.winCondition.surviveSeconds;

  return {
    date: new Date().toISOString().slice(0, 10),
    seed,
    won,
    deaths,
    coinsCollected: collected,
    coinsRequired: level.winCondition.coinsRequired,
    elapsedSeconds: Math.round(elapsed),
    finalWave: wave,
    finalHp: Math.round(player.hp),
    gold,
  };
}

export function runPlaytest(runs = 20) {
  const results = Array.from({ length: runs }, (_, i) => simulate(1000 + i));
  const wins = results.filter((r) => r.won).length;
  const summary = {
    date: new Date().toISOString().slice(0, 10),
    runs,
    win_rate: wins / runs,
    avg_deaths: results.reduce((s, r) => s + r.deaths, 0) / runs,
    avg_coins: results.reduce((s, r) => s + r.coinsCollected, 0) / runs,
    avg_wave: results.reduce((s, r) => s + r.finalWave, 0) / runs,
    results,
  };

  const out = join(ROOT, "telemetry", "playtest.json");
  writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`Playtest: ${wins}/${runs} wins (${(summary.win_rate * 100).toFixed(1)}%)`);
  console.log(`Wrote ${out}`);
  return summary;
}

runPlaytest(Number(process.env.PLAYTEST_RUNS ?? 20));
