import { isWalkableTile } from "./map.js";

export function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tileKey(tx, ty) {
  return `${tx},${ty}`;
}

function parseKey(k) {
  const [tx, ty] = k.split(",").map(Number);
  return { tx, ty };
}

/** BFS reachable floor tiles */
export function reachableTiles(layout, start, openDoors = new Set()) {
  const seen = new Set();
  const q = [{ tx: start.tx, ty: start.ty }];
  seen.add(tileKey(start.tx, start.ty));

  while (q.length) {
    const { tx, ty } = q.shift();
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nx = tx + dx;
      const ny = ty + dy;
      const k = tileKey(nx, ny);
      if (seen.has(k)) continue;
      if (!isWalkableTile(layout, nx, ny, openDoors)) continue;
      seen.add(k);
      q.push({ tx: nx, ty: ny });
    }
  }
  return seen;
}

function allFloorTiles(layout) {
  const tiles = [];
  for (let ty = 0; ty < layout.length; ty++) {
    for (let tx = 0; tx < layout[0].length; tx++) {
      if (layout[ty][tx] === ".") tiles.push({ tx, ty });
    }
  }
  return tiles;
}

/** Recursive backtracker; loops optional (skip loops until door placed) */
export function carveMaze(cols, rows, rng, loopChance = 0) {
  const grid = Array.from({ length: rows }, () => Array(cols).fill("#"));

  function carve(x, y) {
    grid[y][x] = ".";
    for (const [dx, dy] of shuffle(
      [
        [0, -2],
        [0, 2],
        [-2, 0],
        [2, 0],
      ],
      rng
    )) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx <= 0 || ny <= 0 || nx >= cols - 1 || ny >= rows - 1) continue;
      if (grid[ny][nx] !== "#") continue;
      grid[y + dy / 2][x + dx / 2] = ".";
      carve(nx, ny);
    }
  }

  carve(1, 1);

  if (loopChance > 0) {
    for (let ty = 1; ty < rows - 1; ty++) {
      for (let tx = 1; tx < cols - 1; tx++) {
        if (grid[ty][tx] !== "#") continue;
        let floors = 0;
        if (grid[ty - 1]?.[tx] === ".") floors++;
        if (grid[ty + 1]?.[tx] === ".") floors++;
        if (grid[ty][tx - 1] === ".") floors++;
        if (grid[ty][tx + 1] === ".") floors++;
        if (floors >= 2 && rng() < loopChance) grid[ty][tx] = ".";
      }
    }
  }

  return grid.map((row) => row.join(""));
}

function pickSpread(tiles, count, rng, minDist = 3) {
  const picked = [];
  for (let dist = minDist; dist >= 1 && picked.length < count; dist--) {
    for (const t of shuffle(tiles.filter((x) => !picked.includes(x)), rng)) {
      if (picked.length >= count) break;
      if (picked.every((p) => Math.hypot(p.tx - t.tx, p.ty - t.ty) >= dist)) picked.push(t);
    }
  }
  return picked;
}

/** Pick a floor tile that splits the maze into start region + vault */
function findVaultDoor(layoutRows, playerStart, rng, minVaultSize) {
  const layout = layoutRows.map((r) => r.join(""));
  const floors = allFloorTiles(layout);
  for (const doorTile of shuffle(
    floors.filter((t) => !(t.tx === playerStart.tx && t.ty === playerStart.ty)),
    rng
  )) {
    const trial = layoutRows.map((r) => [...r]);
    trial[doorTile.ty][doorTile.tx] = "D";
    const trialLayout = trial.map((r) => r.join(""));
    const reach = reachableTiles(trialLayout, playerStart, new Set());
    const vault = floors.filter((t) => !reach.has(tileKey(t.tx, t.ty)));
    if (vault.length >= minVaultSize) {
      return { door: doorTile, regionA: reach, regionB: vault, layoutRows: trial };
    }
  }
  return null;
}

function addLoopsInRegion(layoutRows, regionKeys, rng, loopChance) {
  if (loopChance <= 0) return;
  const rows = layoutRows.length;
  const cols = layoutRows[0].length;
  for (let ty = 1; ty < rows - 1; ty++) {
    for (let tx = 1; tx < cols - 1; tx++) {
      if (!regionKeys.has(tileKey(tx, ty)) && layoutRows[ty][tx] !== "#") continue;
      if (layoutRows[ty][tx] !== "#") continue;
      let floors = 0;
      if (layoutRows[ty - 1][tx] === ".") floors++;
      if (layoutRows[ty + 1][tx] === ".") floors++;
      if (layoutRows[ty][tx - 1] === ".") floors++;
      if (layoutRows[ty][tx + 1] === ".") floors++;
      if (floors >= 2 && rng() < loopChance) layoutRows[ty][tx] = ".";
    }
  }
}

export function isSolvable(level) {
  const { layout, playerStart, coins, keys, doors, winCondition } = level;
  const startReach = reachableTiles(layout, playerStart, new Set());
  const key = keys[0];
  const door = doors[0];

  if (!startReach.has(tileKey(key.tx, key.ty))) return false;

  const openDoors = new Set([tileKey(door.tx, door.ty)]);
  const withDoor = reachableTiles(layout, playerStart, openDoors);
  const reachableCoins = coins.filter((c) => withDoor.has(tileKey(c.tx, c.ty)));
  return reachableCoins.length >= winCondition.coinsRequired;
}

export function generateLevel(config, seed = Date.now()) {
  const rng = createRng(typeof seed === "number" ? seed : hashSeed(seed));
  const maze = config.maze ?? { cols: 31, rows: 25, loopChance: 0.1 };
  const gen = config.generation ?? {};
  const coinCount = gen.coinCount ?? 10;
  const chestCount = gen.chestCount ?? 3;
  const hazardCount = gen.hazardCount ?? 2;
  const shrineCount = gen.shrineCount ?? 2;
  const coinsBehindDoorMin = gen.coinsBehindDoorMin ?? 3;
  const maxAttempts = gen.maxAttempts ?? 80;
  const loopChance = maze.loopChance ?? 0.1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let layoutRows = carveMaze(maze.cols, maze.rows, rng, 0).map((r) => r.split(""));
    const playerStart = { tx: 1, ty: 1 };

    const vault = findVaultDoor(layoutRows, playerStart, rng, coinsBehindDoorMin + 2);
    if (!vault) continue;

    layoutRows = vault.layoutRows;
    addLoopsInRegion(layoutRows, vault.regionA, rng, loopChance);

    const layout = layoutRows.map((r) => r.join(""));
    const aTiles = [...vault.regionA].map(parseKey).filter((t) => !(t.tx === 1 && t.ty === 1));
    const bTiles = vault.regionB;

    const keySpot = pickSpread(aTiles, 1, rng, 3)[0];
    if (!keySpot) continue;

    const bCoins = pickSpread(bTiles, Math.min(coinsBehindDoorMin, bTiles.length), rng, 2);
    const remaining = coinCount - bCoins.length;
    const aCoins = pickSpread(
      aTiles.filter((t) => tileKey(t.tx, t.ty) !== tileKey(keySpot.tx, keySpot.ty)),
      remaining,
      rng,
      2
    );
    if (aCoins.length + bCoins.length < config.winCondition.coinsRequired) continue;

    const used = new Set([
      tileKey(keySpot.tx, keySpot.ty),
      ...aCoins.map((c) => tileKey(c.tx, c.ty)),
      ...bCoins.map((c) => tileKey(c.tx, c.ty)),
    ]);

    const freeAll = allFloorTiles(layout).filter(
      (t) => !used.has(tileKey(t.tx, t.ty)) && !(t.tx === 1 && t.ty === 1)
    );

    const chests = pickSpread(freeAll, chestCount, rng, 2).map((t, i) => ({
      tx: t.tx,
      ty: t.ty,
      gold: [20, 15, 10][i] ?? 10,
    }));
    chests.forEach((c) => used.add(tileKey(c.tx, c.ty)));

    const shrines = pickSpread(
      aTiles.filter((t) => !used.has(tileKey(t.tx, t.ty))),
      shrineCount,
      rng,
      4
    ).map((t) => ({ tx: t.tx, ty: t.ty, type: "heal" }));
    shrines.forEach((s) => used.add(tileKey(s.tx, s.ty)));

    const hazards = pickSpread(
      freeAll.filter((t) => !used.has(tileKey(t.tx, t.ty))),
      hazardCount,
      rng,
      3
    ).map((t) => ({
      tx: t.tx,
      ty: t.ty,
      radius: 32 + Math.floor(rng() * 8),
      dps: 5 + Math.floor(rng() * 3),
    }));

    const spawnPool = allFloorTiles(layout).filter(
      (t) => !used.has(tileKey(t.tx, t.ty)) && Math.hypot(t.tx - 1, t.ty - 1) > 4
    );
    const enemySpawns = pickSpread(spawnPool, 5, rng, 2);

    const level = {
      ...config,
      layout,
      playerStart,
      coins: [...aCoins, ...bCoins],
      keys: [{ id: "iron", tx: keySpot.tx, ty: keySpot.ty }],
      doors: [{ keyId: "iron", tx: vault.door.tx, ty: vault.door.ty }],
      chests,
      shrines,
      hazards,
      enemySpawns,
      mazeSeed: seed,
    };

    if (isSolvable(level)) return level;
  }

  throw new Error("Failed to generate solvable maze");
}

function hashSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
