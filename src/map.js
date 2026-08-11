/** Tile map: collision, rendering, world ↔ tile coords */

const WALL_INSET = 3;

export function parseLevel(level) {
  const tileSize = level.tileSize ?? 32;
  const layout = level.layout;
  const height = layout.length;
  const width = layout[0].length;
  const walls = [];
  const doors = new Map();

  for (const d of level.doors ?? []) {
    doors.set(`${d.tx},${d.ty}`, d.keyId);
  }

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const ch = layout[ty][tx];
      if (ch === "#" || ch === "D") {
        walls.push({ tx, ty, x: tx * tileSize, y: ty * tileSize, w: tileSize, h: tileSize, door: ch === "D", keyId: doors.get(`${tx},${ty}`) });
      }
    }
  }

  return {
    tileSize,
    layout,
    width: width * tileSize,
    height: height * tileSize,
    cols: width,
    rows: height,
    walls,
  };
}

export function tileCenter(tx, ty, tileSize) {
  return { x: tx * tileSize + tileSize / 2, y: ty * tileSize + tileSize / 2 };
}

/** Random position inside a floor tile, inset from edges */
export function randomPointInTile(tx, ty, tileSize, radius, walls, openDoors = new Set()) {
  const center = tileCenter(tx, ty, tileSize);
  const margin = radius + 2;
  const half = Math.max(0, tileSize / 2 - margin);
  for (let i = 0; i < 8; i++) {
    const x = center.x + (Math.random() * 2 - 1) * half;
    const y = center.y + (Math.random() * 2 - 1) * half;
    if (!circleHitsWall(x, y, radius, walls, openDoors)) return { x, y };
  }
  return center;
}

export function circleHitsWall(x, y, radius, walls, openDoors = new Set()) {
  for (const wall of walls) {
    if (wall.door && openDoors.has(`${wall.tx},${wall.ty}`)) continue;
    const inset = WALL_INSET;
    const wx = wall.x + inset;
    const wy = wall.y + inset;
    const ww = wall.w - inset * 2;
    const wh = wall.h - inset * 2;
    const nx = Math.max(wx, Math.min(x, wx + ww));
    const ny = Math.max(wy, Math.min(y, wy + wh));
    if ((x - nx) ** 2 + (y - ny) ** 2 < radius ** 2) return true;
  }
  return false;
}

export function moveCircle(entity, dx, dy, walls, bounds, openDoors = new Set()) {
  let { x, y, radius } = entity;
  const nx = x + dx;
  if (!circleHitsWall(nx, y, radius, walls, openDoors) && nx >= radius && nx <= bounds.width - radius) {
    x = nx;
  }
  const ny = y + dy;
  if (!circleHitsWall(x, ny, radius, walls, openDoors) && ny >= radius && ny <= bounds.height - radius) {
    y = ny;
  }
  return { x, y };
}

export function isWalkableTile(layout, tx, ty, openDoors = new Set()) {
  if (ty < 0 || ty >= layout.length || tx < 0 || tx >= layout[0].length) return false;
  const ch = layout[ty][tx];
  if (ch === "#") return false;
  if (ch === "D" && !openDoors.has(`${tx},${ty}`)) return false;
  return ch !== " ";
}

export function drawMap(ctx, map, openDoors, tileOverrides = {}) {
  const { layout, tileSize } = map;
  for (let ty = 0; ty < map.rows; ty++) {
    for (let tx = 0; tx < map.cols; tx++) {
      const key = `${tx},${ty}`;
      let ch = layout[ty][tx];
      if (ch === "D" && openDoors.has(key)) ch = ".";
      if (tileOverrides[key]) ch = tileOverrides[key];

      const x = tx * tileSize;
      const y = ty * tileSize;

      if (ch === "#" || ch === "D") {
        ctx.fillStyle = ch === "D" ? "#475569" : "#1e293b";
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = "#0f172a";
        ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
      } else if (ch === "." || ch === "S") {
        ctx.fillStyle = ((tx + ty) % 2 === 0) ? "#0b1220" : "#0d1526";
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }
  }
}
