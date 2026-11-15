import { COLS, ROWS, TILE, SCALE, buildGrid, buildGrid2 } from './map.js'

const CELL = TILE * SCALE
const PX = 3 // 8x8 图案放大到 24x24

// ===== 场景美术：1 单位 = 4px（每格 8x8 单位） =====
const U = 4

const FLOORS = {
  entrance: { base: '#7a5533', light: '#866040', dark: '#6b4a2b' }, // 暖木入口
  corridor: { base: '#555264', light: '#5f5c70', dark: '#484557' }, // 冷石（蓝紫灰）
  side: { base: '#5a5d6e', light: '#646779', dark: '#4d5060' },
  sideA: { base: '#565d70', light: '#606779', dark: '#4a5063' }, // 青灰偏蓝紫
  sideB: { base: '#55371f', light: '#5f3f25', dark: '#4a2f1a' }, // 深木
  challenge: { base: '#4f4b5c', light: '#595567', dark: '#444052' }, // 冷石
  supply: { base: '#6b4a30', light: '#78563a', dark: '#5d3f27' },
}

const WOOD_ZONES = new Set(['supply', 'entrance', 'sideB'])

const WALL = {
  top: '#2b2835',
  topInner: '#1f1c28',
  topEdge: '#3d394b',
  brickA: '#4d4959',
  brickB: '#565264',
  brickC: '#454151',
  mortar: '#2a2735',
  highlight: '#6a6478',
  capShadow: '#1a1721',
}

export const TORCHES_BY_ORDER = {
  1: [
    { x: 7, y: 12 },
    { x: 9, y: 8 },
    { x: 12, y: 7 },
    { x: 1, y: 2 },
    { x: 13, y: 5 },
    { x: 21, y: 1 },
  ],
  2: [
    { x: 4, y: 4 }, // 补给廊口
    { x: 4, y: 9 }, // 补给廊中段
    { x: 8, y: 3 }, // 上侧补给廊
    { x: 13, y: 3 }, // 上侧补给廊
    { x: 19, y: 10 }, // 近路右廊
    { x: 20, y: 1 }, // 训练房北墙
  ],
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color
  ctx.fillRect(x * U, y * U, w * U, h * U)
}

function alphaRect(ctx, x, y, w, h, color, alpha) {
  ctx.globalAlpha = alpha
  rect(ctx, x, y, w, h, color)
  ctx.globalAlpha = 1
}

function drawFloorTile(ctx, grid, x, y, zone) {
  const f = FLOORS[zone]
  const ux = x * 8
  const uy = y * 8
  const hash = (x * 19 + y * 31) % 13
  const s = (x * 7 + y * 11) % 17

  if (WOOD_ZONES.has(zone)) {
    // 木板：横缝减淡 + 细木纹 + 少量结疤
    rect(ctx, ux, uy, 8, 8, hash === 0 ? f.light : hash === 7 ? f.dark : f.base)
    alphaRect(ctx, ux, uy, 8, 1, '#3a2a1a', 0.28)
    const off = (x + y) % 2 === 0 ? 0 : 4
    alphaRect(ctx, ux + off, uy, 1, 8, '#3a2a1a', 0.16)
    const g = (x * 5 + y * 7) % 5
    alphaRect(ctx, ux + 2, uy + 2 + g, 4, 1, '#4a3420', 0.24)
    alphaRect(ctx, ux + 1, uy + 5 - g, 5, 1, '#5a4028', 0.16)
    if ((x * 3 + y * 11) % 9 === 0) rect(ctx, ux + 3, uy + 3, 1, 1, f.dark)
  } else {
    // 2×2 大石砖：只在 2×2 边界画缝，打破格纸感
    const bx = Math.floor(x / 2)
    const by = Math.floor(y / 2)
    const blockHash = (bx * 17 + by * 29) % 9
    const tone = blockHash === 0 ? f.light : blockHash === 4 ? f.dark : f.base
    rect(ctx, ux, uy, 8, 8, tone)
    if (s === 3) rect(ctx, ux + 2, uy + 5, 1, 1, f.dark)
    else if (s === 11) rect(ctx, ux + 5, uy + 2, 1, 1, f.light)
    if (x % 2 === 0) alphaRect(ctx, ux, uy, 1, 8, '#201d2a', 0.5)
    if (y % 2 === 0) alphaRect(ctx, ux, uy, 8, 1, '#201d2a', 0.5)
    if ((bx * 13 + by * 31) % 7 === 0 && x % 2 === 1 && y % 2 === 1) {
      alphaRect(ctx, ux + 3, uy + 2, 1, 2, '#3f3c4b', 0.7)
      alphaRect(ctx, ux + 4, uy + 4, 1, 2, '#3f3c4b', 0.7)
    }

    // 靠墙苔点 / 碎石（固定装饰）
    const isWall = (xx, yy) =>
      yy < 0 || yy >= ROWS || xx < 0 || xx >= COLS || grid[yy][xx] === 'wall'
    const sides = []
    if (isWall(x, y - 1)) sides.push('n')
    if (isWall(x, y + 1)) sides.push('s')
    if (isWall(x - 1, y)) sides.push('w')
    if (isWall(x + 1, y)) sides.push('e')
    if (sides.length && (x * 3 + y * 5) % 7 < 3) {
      for (const side of sides) {
        const m1 = (x * 7 + y * 3) % 5
        const col = m1 % 2 === 0 ? '#5d6b52' : '#6f7d5f'
        if (side === 'n') alphaRect(ctx, ux + 1 + m1, uy + 1, 2, 1, col, 0.55)
        if (side === 's') alphaRect(ctx, ux + 5 - m1, uy + 6, 2, 1, col, 0.5)
        if (side === 'w') alphaRect(ctx, ux + 1, uy + 1 + m1, 1, 2, col, 0.55)
        if (side === 'e') alphaRect(ctx, ux + 6, uy + 5 - m1, 1, 2, col, 0.5)
      }
    }
    if ((x * 11 + y * 7) % 23 === 0) {
      rect(ctx, ux + 2, uy + 4, 1, 1, '#3f3c4b')
      rect(ctx, ux + 3, uy + 5, 2, 1, '#4a4657')
    }
  }

  // 靠墙环境阴影（冷色）
  const isWall = (xx, yy) =>
    yy < 0 || yy >= ROWS || xx < 0 || xx >= COLS || grid[yy][xx] === 'wall'
  if (isWall(x, y - 1)) {
    alphaRect(ctx, ux, uy, 8, 1, '#12101a', 0.36)
    alphaRect(ctx, ux, uy + 1, 8, 1, '#12101a', 0.15)
  }
  if (isWall(x, y + 1)) alphaRect(ctx, ux, uy + 7, 8, 1, '#12101a', 0.3)
  if (isWall(x - 1, y)) alphaRect(ctx, ux, uy, 1, 8, '#12101a', 0.26)
  if (isWall(x + 1, y)) alphaRect(ctx, ux + 7, uy, 1, 8, '#12101a', 0.26)
}

function drawWallTile(ctx, grid, x, y) {
  const ux = x * 8
  const uy = y * 8
  const isFloor = (xx, yy) =>
    yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS && grid[yy][xx] !== 'wall'
  const floorBelow = isFloor(x, y + 1)
  const nearFloor =
    isFloor(x - 1, y) ||
    isFloor(x + 1, y) ||
    isFloor(x, y - 1) ||
    floorBelow ||
    isFloor(x - 1, y - 1) ||
    isFloor(x + 1, y - 1) ||
    isFloor(x - 1, y + 1) ||
    isFloor(x + 1, y + 1)

  if (!nearFloor) {
    // 远景墙：大块暗石底，仅少量低对比旧痕（无逐格高光/内边）
    const tone = ((x >> 1) * 7 + (y >> 1) * 13) % 5
    const base = tone === 0 ? '#211e29' : tone === 3 ? '#252230' : '#232030'
    rect(ctx, ux, uy, 8, 8, base)
    const s = (x * 7 + y * 13) % 23
    if (s === 3) alphaRect(ctx, ux + 3, uy + 3, 3, 1, '#1b1823', 0.7)
    if (s === 9) alphaRect(ctx, ux + 1, uy + 6, 2, 1, '#2a2735', 0.45)
    if (s === 15) alphaRect(ctx, ux + 5, uy + 2, 1, 2, '#1b1823', 0.6)
    return
  }

  // 贴房间/走道的一圈：深顶 + 断续石边
  rect(ctx, ux, uy, 8, 8, floorBelow ? WALL.top : '#282532')
  const dash = (gx, gy, horiz) =>
    alphaRect(ctx, gx, gy, horiz ? 2 : 1, horiz ? 1 : 2, WALL.topEdge, 0.5)
  if (isFloor(x, y - 1)) {
    dash(ux + 1, uy, true)
    dash(ux + 5, uy, true)
  }
  if (isFloor(x, y + 1) && !floorBelow) {
    dash(ux + 2, uy + 7, true)
    dash(ux + 6, uy + 7, true)
  }
  if (isFloor(x - 1, y)) {
    dash(ux, uy + 1, false)
    dash(ux, uy + 5, false)
  }
  if (isFloor(x + 1, y)) {
    dash(ux + 7, uy + 2, false)
    dash(ux + 7, uy + 6, false)
  }

  if (!floorBelow) return

  // 下方有地板：冷砖立面
  rect(ctx, ux, uy, 8, 2, WALL.top)
  alphaRect(ctx, ux, uy, 8, 1, WALL.topInner, 0.9)
  rect(ctx, ux, uy + 2, 8, 6, WALL.brickB)
  for (let r = 0; r < 3; r++) {
    const vy = 2 + r * 2
    const tone = (x * 3 + r) % 3
    const brick = tone === 0 ? WALL.brickA : tone === 1 ? WALL.brickB : WALL.brickC
    rect(ctx, ux, uy + vy, 8, 2, brick)
    alphaRect(ctx, ux, uy + vy, 8, 1, WALL.highlight, 0.24)
    rect(ctx, ux, uy + vy, 8, 1, WALL.mortar)
    const off = (r + x) % 2 === 0 ? 0 : 4
    rect(ctx, ux + off, uy + vy, 1, 2, WALL.mortar)
  }
  rect(ctx, ux, uy + 7, 8, 1, WALL.capShadow)
  if ((x * 5 + y * 3) % 11 === 0) alphaRect(ctx, ux + 5, uy + 3, 2, 1, '#3c3645', 0.5)
  if ((x * 11 + y * 7) % 23 === 0) alphaRect(ctx, ux + 1, uy + 5, 2, 1, '#6a6478', 0.35)
}

function drawCarpet(ctx) {
  // 挑战房暗砖红旧地毯：x15..21, y3..5
  const x = 15 * 8
  const y = 3 * 8
  const w = 56
  const h = 24
  rect(ctx, x, y, w, h, '#4c221f')
  rect(ctx, x + 1, y + 1, w - 2, h - 2, '#6b2f2b')
  rect(ctx, x + 2, y + 2, w - 4, 1, '#7e3a33')
  rect(ctx, x + 2, y + h - 3, w - 4, 1, '#7e3a33')
  rect(ctx, x + 2, y + 2, 1, h - 4, '#7e3a33')
  rect(ctx, x + w - 3, y + 2, 1, h - 4, '#7e3a33')
  // 磨损露出的地面
  const holes = [
    [18, 5], [26, 9], [34, 4], [44, 12], [52, 7], [22, 15], [40, 17], [48, 3],
  ]
  for (const [hx, hy] of holes) rect(ctx, x + hx, y + hy, 1 + (hx % 2), 1, '#7d7165')
  // 两侧流苏
  for (let v = 1; v < h - 1; v += 2) {
    rect(ctx, x - 1, y + v, 1, 1, '#8a4a42')
    rect(ctx, x + w, y + v, 1, 1, '#8a4a42')
  }
}

function drawDoorPost(ctx, ux, uy) {
  // 门柱：细石柱（2×4 单位）
  rect(ctx, ux, uy, 2, 4, '#3a3646')
  rect(ctx, ux, uy, 2, 1, '#565264')
  rect(ctx, ux, uy + 3, 2, 1, '#1d1a26')
}

// 门洞：门槛贯穿整段实际开口，两端各一根石门柱；align 控制贴哪侧门沿
function drawDoorway(ctx, span) {
  const ux = span.x * 8
  const y1 = span.y1 * 8
  const y2 = span.y2 * 8 + 8
  const h = y2 - y1
  const align = span.align || 'center'
  const sx = align === 'right' ? ux + 6 : align === 'left' ? ux : ux + 3
  rect(ctx, sx, y1 + 1, 2, h - 2, '#7d5f35')
  rect(ctx, sx, y1 + 1, 2, 1, '#a98a52')
  alphaRect(ctx, sx + 2, y1 + 1, 1, h - 2, '#1f1a16', 0.22)
  if (span.topPost !== false) drawDoorPost(ctx, sx, y1 - 3)
  if (span.bottomPost !== false) drawDoorPost(ctx, sx, y2 - 1)
}

// 铁箍木门（入口，单格）
function drawIronDoor(ctx, tx, ty) {
  const ux = tx * 8
  const uy = ty * 8
  rect(ctx, ux + 1, uy + 1, 6, 7, '#4a3020')
  for (let i = 2; i < 7; i += 2) rect(ctx, ux + i, uy + 1, 1, 7, '#3a2718')
  rect(ctx, ux + 4, uy + 1, 1, 7, '#2f2115')
  rect(ctx, ux + 1, uy + 3, 6, 1, '#3d3a45')
  rect(ctx, ux + 1, uy + 6, 6, 1, '#3d3a45')
  rect(ctx, ux + 2, uy + 3, 1, 1, '#6a6478')
  rect(ctx, ux + 5, uy + 6, 1, 1, '#6a6478')
  rect(ctx, ux + 4, uy + 4, 1, 1, '#c9a24b')
}

// 石阶（军械库入口，单格）
function drawStairs(ctx, tx, ty) {
  const ux = tx * 8
  const uy = ty * 8
  rect(ctx, ux + 1, uy + 1, 6, 7, '#333041')
  rect(ctx, ux + 1, uy + 2, 6, 1, '#565264')
  rect(ctx, ux + 1, uy + 4, 6, 1, '#454151')
  rect(ctx, ux + 1, uy + 6, 6, 1, '#1d1a26')
  rect(ctx, ux + 2, uy + 7, 4, 1, '#12101a')
}

// 欢迎垫（单格，正对出生列；带两枚脚印）
function drawWelcomeMat(ctx, tx, ty) {
  const ux = tx * 8
  const uy = ty * 8
  rect(ctx, ux + 1, uy + 2, 6, 4, '#5c2a28')
  rect(ctx, ux + 1, uy + 2, 6, 1, '#7a3a34')
  for (let i = 2; i < 7; i += 2) rect(ctx, ux + i, uy + 6, 1, 1, '#7a3a34')
  rect(ctx, ux + 2, uy + 3, 1, 1, '#3a1c1a')
  rect(ctx, ux + 4, uy + 4, 1, 1, '#3a1c1a')
}

// 岔口罗盘插槽（铜边，教程收起后仍在）
function drawCompassSlot(ctx, tx, ty) {
  const x = tx * 8
  const y = ty * 8
  rect(ctx, x + 1, y + 1, 6, 6, '#2a2117')
  rect(ctx, x + 1, y + 1, 6, 1, '#8a6a2b')
  rect(ctx, x + 1, y + 6, 6, 1, '#8a6a2b')
  rect(ctx, x + 1, y + 1, 1, 6, '#8a6a2b')
  rect(ctx, x + 6, y + 1, 1, 6, '#8a6a2b')
  rect(ctx, x + 3, y + 2, 2, 1, '#c9a24b')
  rect(ctx, x + 3, y + 5, 2, 1, '#c9a24b')
  rect(ctx, x + 2, y + 3, 1, 2, '#c9a24b')
  rect(ctx, x + 5, y + 3, 1, 2, '#c9a24b')
  rect(ctx, x + 3, y + 3, 2, 2, '#1b1510')
}

// 守卫脚下的暗石座
function drawGuardPedestal(ctx, tx, ty) {
  const x = tx * 8
  const y = ty * 8
  rect(ctx, x + 1, y + 6, 6, 2, '#1e1b26')
  rect(ctx, x + 2, y + 5, 4, 1, '#2a2634')
  rect(ctx, x + 2, y + 7, 4, 1, '#14121b')
  rect(ctx, x + 1, y + 6, 6, 1, '#14121b')
}

// 五星好评锦旗（首单中段墙）
function drawPennant(ctx, tx, ty) {
  const x = tx * 8
  const y = ty * 8
  rect(ctx, x + 1, y + 1, 6, 1, '#3d3730')
  rect(ctx, x + 2, y, 1, 2, '#3d3730')
  rect(ctx, x + 1, y + 2, 6, 5, '#7a2e2e')
  rect(ctx, x + 1, y + 2, 6, 1, '#8c3b35')
  rect(ctx, x + 1, y + 2, 1, 5, '#c9a24b')
  for (let i = 0; i < 6; i++) {
    if (i % 2 === 0) rect(ctx, x + 1 + i, y + 7, 1, 1, '#7a2e2e')
  }
  ctx.save()
  ctx.font = '8px "Fusion Pixel 12px", "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#e8c97a'
  ctx.fillText('五星', (x + 4) * U, (y + 3.9) * U)
  ctx.fillText('好评', (x + 4) * U, (y + 5.3) * U)
  ctx.restore()
}

// 军械库中庭：暗铁栏里的一组低亮度齿轮（可见轮齿与轮心）
function drawGear(ctx, cx, cy, r, color) {
  // 轮体
  rect(ctx, cx - r + 1, cy - r + 1, 2 * r - 2, 2 * r - 2, color)
  // 八向轮齿
  rect(ctx, cx - 1, cy - r - 1, 3, 2, color)
  rect(ctx, cx - 1, cy + r - 1, 3, 2, color)
  rect(ctx, cx - r - 1, cy - 1, 2, 3, color)
  rect(ctx, cx + r - 1, cy - 1, 2, 3, color)
  rect(ctx, cx - r + 1, cy - r, 2, 2, color)
  rect(ctx, cx + r - 1, cy - r, 2, 2, color)
  rect(ctx, cx - r + 1, cy + r - 2, 2, 2, color)
  rect(ctx, cx + r - 1, cy + r - 2, 2, 2, color)
  // 轮心：暗孔 + 上沿微光 + 轴心
  const hole = Math.max(1, Math.round(r / 2))
  rect(ctx, cx - hole, cy - hole, hole * 2, hole * 2, '#191722')
  alphaRect(ctx, cx - hole, cy - hole, hole * 2, 1, '#3f3a49', 0.85)
  rect(ctx, cx - 1, cy - 1, 2, 2, '#5a4a2c')
}

function drawGearCage(ctx) {
  const x = 9 * 8
  const y = 8 * 8
  const w = 6 * 8
  const h = 3 * 8
  rect(ctx, x, y, w, h, '#221f2b')
  alphaRect(ctx, x, y, w, 1, '#15131c', 0.9)
  drawGear(ctx, 80, 74, 5, '#4b4353')
  drawGear(ctx, 92, 71, 3, '#3f3a49')
  drawGear(ctx, 100, 80, 4, '#5a4a2c')
  drawGear(ctx, 82, 83, 2, '#5a4a2c')
  // 铁栏
  for (let i = 2; i < w; i += 5) {
    rect(ctx, x + i, y, 1, h, '#15131c')
    alphaRect(ctx, x + i + 1, y, 1, h, '#2a2634', 0.6)
  }
  rect(ctx, x, y + 1, w, 1, '#15131c')
  rect(ctx, x, y + h - 2, w, 1, '#15131c')
}

// 地图暗角：中心通透、边缘约 0.55
function drawVignette(ctx) {
  const w = COLS * CELL
  const h = ROWS * CELL
  const g = ctx.createRadialGradient(
    w / 2,
    h / 2,
    Math.min(w, h) * 0.3,
    w / 2,
    h / 2,
    Math.hypot(w, h) * 0.58,
  )
  g.addColorStop(0, 'rgba(8,6,12,0)')
  g.addColorStop(0.6, 'rgba(8,6,12,0.2)')
  g.addColorStop(1, 'rgba(8,6,12,0.55)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

// 拖拽时给固有禁放格打淡红斜纹
function drawForbidden(ctx, tiles) {
  if (!tiles) return
  for (const t of tiles) {
    const px = t.x * CELL
    const py = t.y * CELL
    ctx.save()
    ctx.beginPath()
    ctx.rect(px + 2, py + 2, CELL - 4, CELL - 4)
    ctx.clip()
    ctx.strokeStyle = 'rgba(214, 96, 86, 0.3)'
    ctx.lineWidth = 2
    for (let d = -CELL; d < CELL * 2; d += 7) {
      ctx.beginPath()
      ctx.moveTo(px + d, py)
      ctx.lineTo(px + d - CELL, py + CELL)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function drawNiche(ctx, tx, ty, wTiles, inTop, inBottom) {
  // 墙格凹龛：阶梯小拱 + 下沿阴影
  const x = tx * 8
  const y = ty * 8
  const w = wTiles * 8
  rect(ctx, x, y + inTop, w, inBottom - inTop, '#241f19')
  // 阶梯小拱：两级内收
  rect(ctx, x + 1, y + inTop, w - 2, 1, '#171310')
  rect(ctx, x + 2, y + inTop + 1, w - 4, 1, '#2c251d')
  rect(ctx, x + 3, y + inTop + 2, w - 6, 1, '#171310')
  alphaRect(ctx, x, y + inBottom - 1, w, 1, '#171310', 0.5)
  alphaRect(ctx, x + 1, y + inBottom - 2, w - 2, 1, '#171310', 0.28)
  rect(ctx, x, y + inTop + 1, 1, inBottom - inTop - 2, '#4a423a')
  rect(ctx, x + w - 1, y + inTop + 1, 1, inBottom - inTop - 2, '#4a423a')
  rect(ctx, x, y + inBottom, w, 1, '#6b604f')
}

function drawCounterNiche(ctx) {
  // 入口北墙龛：深木柜台 + 黄铜小铃 + 账本（x1..3, y11）
  const x = 1 * 8
  const y = 11 * 8
  const w = 24
  drawNiche(ctx, 1, 11, 3, 1, 8)
  rect(ctx, x + 1, y + 4, w - 2, 4, '#4a3020')
  rect(ctx, x + 1, y + 4, w - 2, 1, '#3a2717')
  rect(ctx, x + 1, y + 3, w - 2, 1, '#7f5b3c')
  for (let i = 2; i < w - 3; i += 4) rect(ctx, x + 1 + i, y + 4, 1, 4, '#3a2717')
  rect(ctx, x + 9, y + 5, 8, 2, '#543823')
  rect(ctx, x + 10, y + 6, 6, 1, '#3a2717')
  // 账本与铜铃
  rect(ctx, x + 3, y + 1, 5, 2, '#8c6d4a')
  rect(ctx, x + 3, y + 1, 5, 1, '#a78a62')
  rect(ctx, x + 13, y + 2, 4, 1, '#8a6a2b')
  rect(ctx, x + 14, y + 0, 2, 2, '#d4a63f')
  rect(ctx, x + 14, y + 0, 1, 1, '#f2d479')
}

function drawShelfNiche(ctx) {
  drawShelf(ctx, 2, 2, 3)
}

// 任意位置的墙龛书架
function drawShelf(ctx, tx, ty, wTiles) {
  const x = tx * 8
  const y = ty * 8
  const w = wTiles * 8
  drawNiche(ctx, tx, ty, wTiles, 1, 7)
  rect(ctx, x + 1, y + 1, w - 2, 5, '#3b2718')
  rect(ctx, x + 1, y + 1, w - 2, 1, '#6d4a2f')
  rect(ctx, x + 2, y + 2, w - 4, 1, '#241811')
  rect(ctx, x + 2, y + 4, w - 4, 1, '#241811')
  rect(ctx, x + 1, y + 3, w - 2, 1, '#6d4a2f')
  const bottles = ['#a7f070', '#b13e53', '#73eff7', '#a7f070', '#ffcd75', '#b13e53']
  for (let i = 0; i < Math.max(1, Math.floor((w - 2) / 4)); i++) {
    rect(ctx, x + 2 + i * 4, y + 2, 1, 1, bottles[i % bottles.length])
    rect(ctx, x + 3 + i * 4, y + 4, 1, 1, bottles[(i + 2) % bottles.length])
  }
}

// 黄灯：暖黄光晕 + 黄铜烛台（静态，区别于火把的动态火苗）
function drawLamp(ctx, tx, ty) {
  const cx = (tx * 8 + 4) * U
  const cy = (ty * 8 + 4) * U
  const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 34)
  g.addColorStop(0, 'rgba(255, 214, 120, 0.22)')
  g.addColorStop(1, 'rgba(255, 214, 120, 0)')
  ctx.fillStyle = g
  ctx.fillRect(cx - 34, cy - 34, 68, 68)
  rect(ctx, tx * 8 + 3, ty * 8 + 4, 2, 3, '#3d3730')
  rect(ctx, tx * 8 + 2, ty * 8 + 6, 4, 1, '#24211c')
  rect(ctx, tx * 8 + 2, ty * 8 + 3, 4, 1, '#c9a24b')
  rect(ctx, tx * 8 + 3, ty * 8 + 1, 2, 2, '#f2e8d2')
  rect(ctx, tx * 8 + 3, ty * 8 + 0, 2, 1, '#ffcd75')
}

function drawCrateNiche(ctx) {
  // 侧室 A 南墙龛：木箱（x7, y8）
  const x = 7 * 8
  const y = 8 * 8
  drawNiche(ctx, 7, 8, 1, 2, 8)
  rect(ctx, x + 1, y + 3, 6, 4, '#5d3b26')
  rect(ctx, x + 1, y + 3, 6, 1, '#755033')
  rect(ctx, x + 1, y + 6, 6, 1, '#3b2718')
  for (let i = 1; i < 5; i++) rect(ctx, x + i, y + 3 + i, 1, 1, '#3b2718')
}

function drawTableNiche(ctx) {
  // 侧室 B 北墙龛：矮桌 + 蜡烛 + 凳子（x15..17, y8）
  const x = 15 * 8
  const y = 8 * 8
  drawNiche(ctx, 15, 8, 3, 2, 7)
  // 桌
  rect(ctx, x + 1, y + 4, 14, 2, '#6d4a2f')
  rect(ctx, x + 1, y + 4, 14, 1, '#7f5b3c')
  rect(ctx, x + 1, y + 6, 14, 1, '#3b2718')
  // 蜡烛
  rect(ctx, x + 5, y + 3, 3, 1, '#3b2718')
  rect(ctx, x + 6, y + 2, 1, 1, '#e8e2d0')
  rect(ctx, x + 6, y + 1, 1, 1, '#ffcd75')
  // 凳
  rect(ctx, x + 17, y + 4, 4, 2, '#5d3b26')
  rect(ctx, x + 17, y + 4, 4, 1, '#755033')
  rect(ctx, x + 17, y + 6, 1, 1, '#3b2718')
  rect(ctx, x + 20, y + 6, 1, 1, '#3b2718')
}

function drawBarrelNiche(ctx, tx, ty) {
  // 墙龛里的木桶
  const x = tx * 8
  const y = ty * 8
  drawNiche(ctx, tx, ty, 1, 2, 8)
  rect(ctx, x + 1, y + 3, 6, 4, '#4e3423')
  rect(ctx, x + 2, y + 2, 4, 1, '#6d4a2f')
  rect(ctx, x + 1, y + 3, 6, 1, '#5b3f28')
  for (let i = 2; i < 6; i += 2) rect(ctx, x + i, y + 4, 1, 3, '#43301f')
  rect(ctx, x + 1, y + 6, 6, 1, '#2b1d11')
}

function drawTorch(ctx, tx, ty) {
  // 铁架火把座（火焰、光晕与火星在动态层）
  rect(ctx, tx * 8 + 3, ty * 8 + 3, 2, 4, '#33302b')
  rect(ctx, tx * 8 + 3, ty * 8 + 3, 2, 1, '#566c86')
  rect(ctx, tx * 8 + 2, ty * 8 + 6, 4, 1, '#24211c')
}

function drawFlag(ctx, tx, ty) {
  const x = tx * 8
  const y = ty * 8
  rect(ctx, x + 1, y + 1, 6, 1, '#3d3730')
  rect(ctx, x + 1, y, 1, 2, '#3d3730')
  rect(ctx, x + 1, y + 2, 5, 4, '#7a2e2e')
  rect(ctx, x + 1, y + 2, 5, 1, '#8c3b35')
  for (let i = 0; i < 5; i++) {
    if (i % 2 === 0) rect(ctx, x + 1 + i, y + 6, 1, 1, '#7a2e2e')
  }
  rect(ctx, x + 3, y + 3, 1, 1, '#c9a94e')
}

function drawLabels(ctx) {
  // 房间名上墙：两钉木牌
  drawWallLabels(ctx, [
    { text: '入口', x: 4.6, y: 17.5 },
    { text: '通道', x: 12.5, y: 6.5 },
    { text: '侧室', x: 6.5, y: 2.5 },
    { text: '侧室', x: 19.5, y: 8.5 },
    { text: '挑战房', x: 18.5, y: 1.5 },
  ])
}

function drawWallLabels(ctx, labels) {
  for (const l of labels) {
    ctx.font = '12px "Fusion Pixel 12px", "Courier New", monospace'
    const tw = Math.ceil(ctx.measureText(l.text).width)
    const bw = Math.min(84, tw + 12)
    const bh = 15
    const cx = l.x * 8 * U
    const cy = l.y * 8 * U
    const left = Math.round(cx - bw / 2)
    const top = Math.round(cy - bh / 2)
    ctx.fillStyle = '#2f2115'
    ctx.fillRect(left - 1, top - 1, bw + 2, bh + 2)
    ctx.fillStyle = '#4e3826'
    ctx.fillRect(left, top, bw, bh)
    ctx.fillStyle = '#5f452e'
    ctx.fillRect(left + 1, top + 1, bw - 2, 1)
    ctx.fillStyle = '#3a2718'
    ctx.fillRect(left + 1, top + bh - 2, bw - 2, 1)
    ctx.fillStyle = '#c9a24b'
    ctx.fillRect(left + 3, Math.round(cy) - 1, 2, 2)
    ctx.fillRect(left + bw - 5, Math.round(cy) - 1, 2, 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#e8dcc0'
    ctx.fillText(l.text, cx, cy + 0.5)
  }
}

// ===== 道具：16×16 像素矩阵（2px/格），商店与地图同一套 =====
const ITEM_PAL = {
  o: '#1a1c2c',
  C: '#c9a24b',
  c: '#8a6a2b',
  W: '#6d4a2f',
  w: '#8a5f38',
  g: '#ffcd75',
  k: '#2a1c10',
  K: '#171310',
  S: '#94b0c2',
  s: '#566c86',
  e: '#3b5dc9',
  A: '#ffcd75',
}

const ITEM_MATRICES = {
  chest: [
    '................',
    '....oooooooo....',
    '...oCCCCCCCCo...',
    '..oCwwwwwwwwCo..',
    '..oCwWWWWWWwCo..',
    '..oCwWWWWWWwCo..',
    '..oCCCCCCCCCCo..',
    '..occcccccccco..',
    '..oWwwwwwwwwWo..',
    '..oWwwwggwwwwWo.',
    '..oWwwgkgwwwwWo.',
    '..oWwwwggwwwwWo.',
    '..oWwwwwwwwwWWo.',
    '..oCCCCCCCCCCo..',
    '...oooooooooo...',
    '................',
  ],
  chestOpen: [
    '....oooooooo....',
    '...oCCCCCCCCo...',
    '...occcccccco...',
    '....oooooooo....',
    '..oooooooooooo..',
    '..oKKKKKKKKKKo..',
    '..oKggKKKKggKo..',
    '..oKKKKgKKKKKo..',
    '..oWwwwwwwwwWo..',
    '..oWwwwwwwwwWo..',
    '..oWwwwwwwwwWo..',
    '..oWwwwwwwwwWo..',
    '..oWwwwwwwwwWo..',
    '..oCCCCCCCCCCo..',
    '...oooooooooo...',
    '................',
  ],
  shield: [
    '................',
    '...oooooooooo...',
    '..oSSSSSSSSSSo..',
    '..oSwSSSSSSwSo..',
    '..oSSSSeeSSSSo..',
    '..oSSSSegeSSSo..',
    '..oSSSSeeSSSSo..',
    '..oSSSSSSSSSSo..',
    '...oSSSSSSSSo...',
    '..w.oSSSSSSo.w..',
    '.wW..oSSSSo..Ww.',
    '.wW...oooo...Ww.',
    '.wW..........Ww.',
    '.wWWWWWWWWWWWWw.',
    '..oooooooooooo..',
    '................',
  ],
  shieldEmpty: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.wWWWWWWWWWWWWw.',
    '.wW..........Ww.',
    '.wW..........Ww.',
    '.wW..........Ww.',
    '.wWWWWWWWWWWWWw.',
    '..oooooooooooo..',
    '................',
    '................',
  ],
  // 只画“箭头木板”（朝上基准），木桩另绘且始终向下
  signArrow: [
    '................',
    '.....oooooo.....',
    '....oWWWWWWo....',
    '...oWWWWWWWWo...',
    '...oWWWAAWWWo...',
    '...oWWAAAAWWo...',
    '...oWWAAAAWWo...',
    '...oWWWAAWWWo...',
    '....oWWAAWWo....',
    '.....oWWWWo.....',
    '......oooo......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
}

function drawItemMatrix(ctx, rows, ox, oy) {
  const px = 2
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < 16; c++) {
      const ch = rows[r][c]
      if (!ch || ch === '.') continue
      ctx.fillStyle = ITEM_PAL[ch] || '#ff00ff'
      ctx.fillRect(ox + c * px, oy + r * px, px, px)
    }
  }
}

function drawSignItem(ctx, ox, oy, dir) {
  const cx = ox + CELL / 2
  const cy = oy + CELL / 2
  // 木桩先画（始终向下）
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(cx - 4, cy - 1, 8, 17)
  ctx.fillStyle = '#6d4a2f'
  ctx.fillRect(cx - 3, cy, 6, 16)
  ctx.fillStyle = '#8a5f38'
  ctx.fillRect(cx - 3, cy, 2, 16)
  ctx.fillStyle = '#c9a24b'
  ctx.fillRect(cx - 4, cy - 3, 8, 2)
  // 箭头木板固定在桩顶，绕桩顶转方向；朝下时亮色箭尖压在木桩之上
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(((dir || 0) * Math.PI) / 2)
  ctx.translate(-16, -16)
  drawItemMatrix(ctx, ITEM_MATRICES.signArrow, 0, 0)
  ctx.restore()
}

function drawItemShadow(ctx, ox, oy) {
  ctx.save()
  ctx.globalAlpha = 0.32
  ctx.fillStyle = '#0a0810'
  ctx.fillRect(ox + 8, oy + 27, 16, 3)
  ctx.fillRect(ox + 10, oy + 30, 12, 1)
  ctx.restore()
}

export function drawItem(ctx, type, ox, oy, dir = 0, opened = false, taken = false) {
  drawItemShadow(ctx, ox, oy)
  if (type === 'sign') {
    drawSignItem(ctx, ox, oy, dir)
    return
  }
  if (type === 'chest') {
    drawItemMatrix(ctx, opened ? ITEM_MATRICES.chestOpen : ITEM_MATRICES.chest, ox, oy)
    if (opened) {
      // 开箱后的余光
      ctx.save()
      ctx.globalAlpha = 0.5
      ctx.fillStyle = '#ffcd75'
      ctx.fillRect(ox + 10, oy + 6, 2, 2)
      ctx.fillRect(ox + 20, oy + 8, 2, 2)
      ctx.restore()
    }
    return
  }
  if (type === 'shield') {
    drawItemMatrix(ctx, taken ? ITEM_MATRICES.shieldEmpty : ITEM_MATRICES.shield, ox, oy)
    return
  }
}

function drawPattern(ctx, sprite) {
  for (let r = 0; r < sprite.rows.length; r++) {
    for (let c = 0; c < 8; c++) {
      const ch = sprite.rows[r][c]
      if (ch === '.') continue
      ctx.fillStyle = sprite.colors[ch]
      ctx.fillRect(c * PX, r * PX, PX, PX)
    }
  }
}

// ===== 角色像素：约 24×32（8×11 格，每格 3px），四向 + 两帧走路 =====
const CHAR_PX = 3
const CHAR_W = 8
const CHAR_H = 11

const KNIGHT_PALETTE = {
  o: '#1a1c2c',
  H: '#94b0c2', // 旧银盔
  h: '#566c86',
  F: '#e8c19a', // 露出的脸
  E: '#1a1c2c',
  A: '#5b6b80', // 胸前甲片
  g: '#ffcd75',
  C: '#3b5dc9', // 蓝斗篷
  b: '#2a2f3d', // 深色靴
}

const FAN_PALETTE = {
  o: '#1a1c2c',
  K: '#3a2a1c',
  k: '#54402c',
  F: '#e8c19a',
  E: '#1a1c2c',
  G: '#e0a83c', // 琥珀护目镜
  g: '#ffcd75',
  S: '#b98a3c', // 棕黄围巾
  T: '#6d4a2f',
  b: '#2a2018',
}

const KNIGHT_FRAMES = {
  down: [
    [
      '..oooo..',
      '.oHHHHo.',
      '.oHhhHo.',
      '.oFFFFo.',
      '.oFEFEo.',
      '.oFFFFo.',
      '.oAAAAo.',
      'CoAgAAoC',
      'CoAAAAoC',
      '.oAAAAo.',
      '..b..b..',
    ],
    [
      '..oooo..',
      '.oHHHHo.',
      '.oHhhHo.',
      '.oFFFFo.',
      '.oFEFEo.',
      '.oFFFFo.',
      '.oAAAAo.',
      'CoAgAAoC',
      'CoAAAAo.',
      '.oAAAAo.',
      '.b....b.',
    ],
  ],
  up: [
    [
      '..oooo..',
      '.oHHHHo.',
      '.oHHHHo.',
      '.oHHHHo.',
      '.oHhhHo.',
      '.oCCCCo.',
      '.oCCCCo.',
      'CoCCCCoC',
      'CoCCCCoC',
      '.oCCCCo.',
      '..b..b..',
    ],
    [
      '..oooo..',
      '.oHHHHo.',
      '.oHHHHo.',
      '.oHHHHo.',
      '.oHhhHo.',
      '.oCCCCo.',
      '.oCCCCo.',
      'CoCCCCoC',
      'CoCCCCo.',
      '.oCCCCo.',
      '.b....b.',
    ],
  ],
  left: [
    [
      '..oooo..',
      '.oHHHHo.',
      '.oHhhHo.',
      '.oFFHHo.',
      '.oFEHHo.',
      '.oFFHHo.',
      '.oAAAAo.',
      'oAAAACCo',
      'oAAAACCo',
      '.oAAAAo.',
      '..b..b..',
    ],
    [
      '..oooo..',
      '.oHHHHo.',
      '.oHhhHo.',
      '.oFFHHo.',
      '.oFEHHo.',
      '.oFFHHo.',
      '.oAAAAo.',
      'oAAAACCo',
      'oAAAACC.',
      '.oAAAAo.',
      '.b...b..',
    ],
  ],
}

const FAN_FRAMES = {
  down: [
    [
      '..oooo..',
      '.oKKKKo.',
      '.oKkkKo.',
      '.oFFFFo.',
      '.oGgGGo.',
      '.oFFFFo.',
      '.oSSSSo.',
      'SoTTTToS',
      'oTTTTTTo',
      '.oTTTTo.',
      '..b..b..',
    ],
    [
      '..oooo..',
      '.oKKKKo.',
      '.oKkkKo.',
      '.oFFFFo.',
      '.oGgGGo.',
      '.oFFFFo.',
      '.oSSSSo.',
      'SoTTTToS',
      'oTTTTTo.',
      '.oTTTTo.',
      '.b....b.',
    ],
  ],
  up: [
    [
      '..oooo..',
      '.oKKKKo.',
      '.oKkkKo.',
      '.oKKKKo.',
      '.okkkko.',
      '.oSSSSo.',
      '.oSSSSo.',
      'SoTTTToS',
      'oTTTTTTo',
      '.oTTTTo.',
      '..b..b..',
    ],
    [
      '..oooo..',
      '.oKKKKo.',
      '.oKkkKo.',
      '.oKKKKo.',
      '.okkkko.',
      '.oSSSSo.',
      '.oSSSSo.',
      'SoTTTToS',
      'oTTTTTo.',
      '.oTTTTo.',
      '.b....b.',
    ],
  ],
  left: [
    [
      '..oooo..',
      '.oKKKKo.',
      '.oKkkKo.',
      '.oFFKKo.',
      '.oGgKKo.',
      '.oFFKKo.',
      '.oSSSSo.',
      'oTTTSSo.',
      'oTTTSSo.',
      '.oTTTTo.',
      '..b..b..',
    ],
    [
      '..oooo..',
      '.oKKKKo.',
      '.oKkkKo.',
      '.oFFKKo.',
      '.oGgKKo.',
      '.oFFKKo.',
      '.oSSSSo.',
      'oTTTSSo.',
      'oTTTSS..',
      '.oTTTTo.',
      '.b...b..',
    ],
  ],
}

const SKELETON_PALETTE = {
  o: '#1a1c2c',
  W: '#e8e0cf',
  w: '#b8ad97',
  E: '#1a1c2c',
  R: '#8a5a3c', // 锈肩甲
}

const SKELETON_ROWS = [
  '..oooo..',
  '.oWWWWo.',
  '.oWEWEo.',
  '.oWWWWo.',
  '..oWWo..',
  'RoWWWWoR',
  '.oWwWWo.',
  '.oWWWWo.',
  '..oWWo..',
  '..o..o..',
  '.oo..oo.',
]

function drawCharRows(ctx, rows, palette, ox, oy) {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < CHAR_W; c++) {
      const ch = rows[r][c]
      if (ch === '.') continue
      ctx.fillStyle = palette[ch]
      ctx.fillRect(ox + c * CHAR_PX, oy + r * CHAR_PX, CHAR_PX, CHAR_PX)
    }
  }
}

function drawChar(ctx, sets, palette, facing, phase, cx, feetY) {
  // 右侧没有单独帧：用左侧帧水平镜像
  const base = sets[facing] ? facing : facing === 'right' ? 'left' : 'down'
  const set = sets[base]
  const rows = set[phase ? 1 : 0]
  ctx.save()
  if (facing === 'right') {
    ctx.translate(cx, 0)
    ctx.scale(-1, 1)
    ctx.translate(-cx, 0)
  }
  drawCharRows(ctx, rows, palette, cx - 12, feetY - CHAR_H * CHAR_PX)
  ctx.restore()
}

// 预约卡片头像：正脸半身裁切
export function charAvatarDataURL(variant) {
  const sets = variant === 'fan' ? FAN_FRAMES : KNIGHT_FRAMES
  const palette = variant === 'fan' ? FAN_PALETTE : KNIGHT_PALETTE
  const rows = sets.down[0].slice(0, 9)
  const c = document.createElement('canvas')
  c.width = CHAR_W * CHAR_PX
  c.height = rows.length * CHAR_PX
  drawCharRows(c.getContext('2d'), rows, palette, 0, 0)
  return c.toDataURL()
}

// 小管家头像（教学框）
const STEWARD_ROWS = [
  '..oooo..',
  '.oHHHHo.',
  '.oFFFFo.',
  '.oFEgFo.',
  '.oFFFFo.',
  '.oBBBBo.',
  '.oBgBBo.',
  '.oBBBBo.',
  '.oooooo.',
]
const STEWARD_PALETTE = {
  o: '#1a1c2c',
  H: '#3a2a1c',
  F: '#e8c19a',
  E: '#1a1c2c',
  g: '#c9a24b',
  B: '#2a2f3d',
}

export function stewardAvatarDataURL() {
  const c = document.createElement('canvas')
  c.width = CHAR_W * CHAR_PX
  c.height = STEWARD_ROWS.length * CHAR_PX
  drawCharRows(c.getContext('2d'), STEWARD_ROWS, STEWARD_PALETTE, 0, 0)
  return c.toDataURL()
}

// 原创小铁手像素光标（16×16，1px 步进；hotspot：手 3,0 / 抓 7,5）
const CURSOR_HAND = [
  '..oo............',
  '..oSSo..........',
  '..oSSo..........',
  '..oSSo..........',
  '..oSSo..oo......',
  '..oSSo.oSSo.....',
  '..oSSo.oSSo.....',
  '..oSSooSSo......',
  '..oSSSSSSo......',
  '..oSsSSSSo......',
  '.oSSSSSSSSo.....',
  '.oSSSssSSSSo....',
  '..oSSSSSSSSo....',
  '...oSSSSSSo.....',
  '....oooooo......',
  '................',
]

const CURSOR_GRAB = [
  '................',
  '....oooo........',
  '...oSSSSoo......',
  '...oSSSSSSo.....',
  '..oSSsSSSSSo....',
  '..oSSSSSSSSo....',
  '..oSSSSSSSSo....',
  '...oSSSSSSo.....',
  '...osSSSSo......',
  '....oooooo......',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
]

export function cursorDataURL(kind) {
  const rows = kind === 'grab' ? CURSOR_GRAB : CURSOR_HAND
  const colors = { o: '#141019', S: '#94b0c2', s: '#566c86' }
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 16
  const ctx = c.getContext('2d')
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < 16; i++) {
      const ch = rows[r][i]
      if (!ch || ch === '.') continue
      ctx.fillStyle = colors[ch]
      ctx.fillRect(i, r, 1, 1)
    }
  }
  return c.toDataURL()
}

// 受击闪白：用白色调色板重描一遍
function makeWhitePalette() {
  return new Proxy({}, { get: () => '#ffffff' })
}

function drawHeldShield(ctx, cx, feetY, facing, blocking) {
  if (blocking) {
    const sx = facing === 'right' ? cx + 6 : cx - 18
    const top = feetY - 34
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(sx, top, 12, 18)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(sx + 1, top + 1, 10, 16)
    ctx.fillStyle = '#3b5dc9'
    ctx.fillRect(sx + 4, top + 6, 4, 6)
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(sx + 5, top + 4, 2, 2)
    return
  }
  if (facing === 'left' || facing === 'right') {
    // 侧面只露窄边
    const sx = facing === 'right' ? cx + 9 : cx - 12
    const top = feetY - 24
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(sx, top, 3, 14)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(sx + 1, top + 1, 1, 12)
    return
  }
  if (facing === 'up') {
    // 朝上：盾在背侧（画在人物之前）
    const sx = cx - 14
    const top = feetY - 30
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(sx, top, 10, 14)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(sx + 1, top + 1, 8, 12)
    return
  }
  // 朝下：盾在手臂旁
  const sx = cx - 17
  const top = feetY - 22
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(sx, top, 9, 14)
  ctx.fillStyle = '#94b0c2'
  ctx.fillRect(sx + 1, top + 1, 7, 12)
  ctx.fillStyle = '#ffcd75'
  ctx.fillRect(sx + 3, top + 5, 3, 3)
}

// 勇者徽章：切角金纹章 + 下缘垂落的蓝绶带 + 少量星芒
export function drawHeroBadge(ctx, cx, cy, s = 1, opts = {}) {
  // 切角金纹章（八角切角轮廓）
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(cx - 4 * s, cy - 6 * s, 8 * s, 12 * s)
  ctx.fillRect(cx - 5 * s, cy - 4 * s, 10 * s, 8 * s)
  ctx.fillStyle = '#ffcd75'
  ctx.fillRect(cx - 3 * s, cy - 5 * s, 6 * s, 10 * s)
  ctx.fillRect(cx - 4 * s, cy - 3 * s, 8 * s, 6 * s)
  ctx.fillStyle = '#e8a53c'
  ctx.fillRect(cx - 3 * s, cy + 3 * s, 6 * s, 2 * s)
  // 中心星
  ctx.fillStyle = '#f4f4f4'
  ctx.fillRect(cx - 1 * s, cy - 1 * s, 2 * s, 2 * s)
  // 蓝绶带：从纹章下缘往下垂
  ctx.fillStyle = '#29366f'
  ctx.fillRect(cx - 3 * s, cy + 5 * s, 2 * s, 6 * s)
  ctx.fillRect(cx + 1 * s, cy + 5 * s, 2 * s, 6 * s)
  ctx.fillStyle = '#3b5dc9'
  ctx.fillRect(cx - 3 * s, cy + 6 * s, 1 * s, 3 * s)
  ctx.fillRect(cx + 2 * s, cy + 6 * s, 1 * s, 3 * s)
  // 星芒
  ctx.fillStyle = '#ffcd75'
  ctx.fillRect(cx - 7 * s, cy - 3 * s, s, s)
  if (opts.twinkle) {
    // 交替亮的小星点
    if (opts.phase === 0) ctx.fillRect(cx + 6 * s, cy - 5 * s, s, s)
    else ctx.fillRect(cx + 6 * s, cy + 1 * s, s, s)
  } else {
    ctx.fillRect(cx + 6 * s, cy - 2 * s, s, s)
  }
}

// 客人：浮点格坐标；方向/步态由行走驱动；影子、分层盾牌与受击闪白
export function drawGuest(ctx, guest) {
  const variant = guest.variant === 'fan' ? 'fan' : 'knight'
  const sets = variant === 'fan' ? FAN_FRAMES : KNIGHT_FRAMES
  const palette = variant === 'fan' ? FAN_PALETTE : KNIGHT_PALETTE
  const cx = (guest.x + 0.5) * CELL + (guest.offsetX || 0)
  const crouch = guest.blocking ? 3 : 0
  const feetY = (guest.y + 1) * CELL - 3 + (guest.offsetY || 0) + crouch
  const facing = guest.facing || 'down'
  const phase = guest.moving ? guest.walkPhase || 0 : 0

  // 脚下像素影子（走动时宽度微变）
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = '#0a0810'
  const wob = guest.moving ? (phase ? 2 : 0) : 1
  ctx.fillRect(cx - 8, feetY - 1, 16, 3)
  ctx.fillRect(cx - 6 + wob, feetY + 2, 12 - wob, 1)
  ctx.restore()

  // 朝上时盾先画（背在身后）
  if (guest.hasShield && facing === 'up' && !guest.blocking) {
    drawHeldShield(ctx, cx, feetY, facing, false)
  }
  if (guest.flash) {
    ctx.save()
    ctx.globalAlpha = 0.75
    drawChar(ctx, sets, makeWhitePalette(), facing, phase, cx, feetY)
    ctx.restore()
  }
  drawChar(ctx, sets, palette, facing, phase, cx, feetY)
  if (guest.hasShield && !(facing === 'up' && !guest.blocking)) {
    drawHeldShield(ctx, cx, feetY, facing, !!guest.blocking)
  }

  if (guest.hasBadge && !guest.hideBadge) {
    // 头顶徽章：轻轻浮动 + 交替小星点
    const tnow = performance.now()
    const bob = Math.round(Math.sin(tnow / 600))
    const phase = Math.floor(tnow / 320) % 2
    ctx.save()
    ctx.globalAlpha = 0.92
    drawHeroBadge(ctx, cx, feetY - 42 + bob, 0.8, { twinkle: true, phase })
    ctx.restore()
  }
}

function drawSkeletonHammer(ctx, ox, oy, pose) {
  if (pose === 'raise') {
    ctx.fillStyle = '#ef7d57'
    ctx.fillRect(ox + 17, oy - 6, 3, 18)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(ox + 10, oy - 16, 16, 8)
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(ox + 10, oy - 16, 16, 2)
  } else if (pose === 'strike') {
    ctx.fillStyle = '#ef7d57'
    ctx.fillRect(ox - 8, oy + 22, 20, 3)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(ox - 18, oy + 16, 11, 13)
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(ox - 18, oy + 16, 3, 13)
  } else {
    ctx.fillStyle = '#ef7d57'
    ctx.fillRect(ox + 17, oy + 10, 3, 18)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(ox + 12, oy + 4, 13, 7)
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(ox + 12, oy + 4, 13, 2)
  }
}

// 倒地：散骨 + 落下的锤 + 两点小星
function drawSkeletonDown(ctx, cx, feetY) {
  ctx.save()
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(cx - 19, feetY - 7, 16, 1)
  ctx.fillStyle = '#e8e0cf'
  ctx.fillRect(cx - 18, feetY - 6, 14, 3)
  ctx.fillRect(cx - 2, feetY - 4, 16, 3)
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(cx + 2, feetY - 16, 12, 10)
  ctx.fillStyle = '#e8e0cf'
  ctx.fillRect(cx + 3, feetY - 15, 10, 8)
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(cx + 5, feetY - 12, 2, 2)
  ctx.fillRect(cx + 9, feetY - 12, 2, 2)
  ctx.fillStyle = '#6d4a2f'
  ctx.fillRect(cx - 28, feetY - 2, 22, 3)
  ctx.fillStyle = '#94b0c2'
  ctx.fillRect(cx - 2, feetY - 7, 10, 9)
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(cx - 2, feetY - 7, 2, 9)
  ctx.fillStyle = '#ffcd75'
  ctx.fillRect(cx - 4, feetY - 20, 2, 2)
  ctx.fillRect(cx - 1, feetY - 22, 2, 2)
  ctx.restore()
}

export function drawSkeleton(ctx, sx, sy, pose, now = 0, flash = false) {
  const cx = (sx + 0.5) * CELL
  const feetY = (sy + 1) * CELL - 3

  ctx.save()
  ctx.globalAlpha = 0.32
  ctx.fillStyle = '#0a0810'
  ctx.fillRect(cx - 8, feetY - 1, 16, 3)
  ctx.restore()

  if (pose === 'down') {
    drawSkeletonDown(ctx, cx, feetY)
    return
  }
  const bob = pose === 'idle' ? Math.round(Math.sin(now / 700)) : 0
  const ox = cx - 12
  const oy = feetY - CHAR_H * CHAR_PX + bob
  if (flash) {
    ctx.save()
    ctx.globalAlpha = 0.75
    drawCharRows(ctx, SKELETON_ROWS, makeWhitePalette(), ox, oy)
    ctx.restore()
  }
  drawCharRows(ctx, SKELETON_ROWS, SKELETON_PALETTE, ox, oy)
  drawSkeletonHammer(ctx, ox, oy, pose)
  // 偶尔红眼（短暂）
  if (now % 4400 < 700) {
    ctx.fillStyle = '#d9534f'
    ctx.fillRect(ox + 9, oy + 6, 3, 3)
    ctx.fillRect(ox + 15, oy + 6, 3, 3)
  }
}

// fx: { kind: 'strike'|'block'|'hit'|'slash', at: {x,y}, t, ms } —— 像素帧与小方颗粒
function drawFx(ctx, fx) {
  const p = Math.min(1, fx.t / fx.ms)
  const cx = (fx.at.x + 0.5) * CELL
  const cy = (fx.at.y + 0.5) * CELL
  ctx.save()
  ctx.globalAlpha = 1 - p
  if (fx.kind === 'strike') {
    ctx.fillStyle = '#ffcd75'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(cx + 12 - i * 6, cy - 22 + i * 7, 6, 3)
    }
  } else if (fx.kind === 'block') {
    ctx.fillStyle = '#73eff7'
    const pts = [
      [-14, -10], [12, -12], [-18, 2], [14, 6], [-6, -18], [4, 14],
    ]
    for (const [dx, dy] of pts) {
      ctx.fillRect(cx + dx + Math.sign(dx) * p * 6, cy + dy - p * 4, 3, 3)
    }
  } else if (fx.kind === 'hit') {
    ctx.fillStyle = '#d9534f'
    const pts = [
      [-10, -12], [8, -14], [-16, -2], [14, 0], [-4, 10], [6, 12], [0, -18],
    ]
    for (const [dx, dy] of pts) {
      ctx.fillRect(cx + dx * (1 + p * 0.5), cy + dy * (1 + p * 0.5), 3, 3)
    }
  } else if (fx.kind === 'slash') {
    ctx.fillStyle = '#f4f4f4'
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(cx - 18 + i * 8, cy + 14 - i * 7, 4, 4)
    }
  }
  ctx.restore()
}

// 侧栏图标 / 拖拽幽灵用
export function itemDataURL(type, dir = 0) {
  const c = document.createElement('canvas')
  c.width = CELL
  c.height = CELL
  drawItem(c.getContext('2d'), type, 0, 0, dir)
  return c.toDataURL()
}

// 底图（地牢场景）只画一次，缓存离屏
export function makeBaseMap(order = 1) {
  if (order === 2) return makeArmoryBase()
  const c = document.createElement('canvas')
  c.width = COLS * CELL
  c.height = ROWS * CELL
  const ctx = c.getContext('2d')
  const grid = buildGrid()

  // 1. 地板
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== 'wall') drawFloorTile(ctx, grid, x, y, grid[y][x])
    }
  }

  // 2. 挑战房旧地毯
  drawCarpet(ctx)

  // 3. 地面装饰：入口欢迎垫 / 岔口罗盘槽 / 守卫石座（纯装饰，不改格子）
  drawWelcomeMat(ctx, 3, 16)
  drawCompassSlot(ctx, 11, 11)
  drawCompassSlot(ctx, 10, 5)
  drawGuardPedestal(ctx, 19, 4)
  drawBadgeStand(ctx, 23, 3)

  // 4. 砖砌厚墙（只有下方有地板的墙格画正面砖面）
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === 'wall') drawWallTile(ctx, grid, x, y)
    }
  }

  // 5. 中段墙的「五星好评」锦旗
  drawPennant(ctx, 9, 10)

  // 6. 门洞（门槛横跨实际开口 + 两端石门柱）与入口铁箍木门
  for (const s of [
    { x: 7, y1: 14, y2: 14 },
    { x: 8, y1: 5, y2: 5 },
    { x: 12, y1: 11, y2: 11 },
    { x: 12, y1: 4, y2: 4 },
  ]) {
    drawDoorway(ctx, s)
  }
  drawIronDoor(ctx, 3, 17)

  // 7. 靠墙陈设（全部收进墙格壁龛，地面保持可摆放）
  drawCounterNiche(ctx) // 入口北墙：柜台龛 + 黄铜小铃
  drawShelfNiche(ctx) // 侧室 A 北墙：书架龛
  drawCrateNiche(ctx) // 侧室 A 南墙：木箱龛
  drawTableNiche(ctx) // 侧室 B 北墙：桌凳龛 + 蜡烛
  drawBarrelNiche(ctx, 10, 2)
  drawBarrelNiche(ctx, 6, 17)
  drawBarrelNiche(ctx, 20, 14)
  drawBarrelNiche(ctx, 22, 7)

  // 8. 火把支架（火焰在动态层）、灯与旧旗
  for (const t of TORCHES_BY_ORDER[1]) drawTorch(ctx, t.x, t.y)
  drawLamp(ctx, 4, 11) // 入口暖灯（柜台旁）
  drawLamp(ctx, 14, 8) // 右侧室烛灯
  drawFlag(ctx, 5, 11)
  drawFlag(ctx, 23, 4)

  // 9. 地图暗角（中心通透到边缘 0.55）
  drawVignette(ctx)

  // 10. 房间名木牌（暗角之后再画，保证读得清）
  drawLabels(ctx)

  return c
}

function drawTorchFlames(ctx, now, torches) {
  for (let i = 0; i < torches.length; i++) {
    const t = torches[i]
    const cx = (t.x + 0.5) * CELL
    const cy = (t.y + 0.42) * CELL
    const phase = Math.floor(now / 170 + i * 0.7) % 2
    const breathe = 0.5 + 0.5 * Math.sin(now / 520 + i * 1.9)

    // 呼吸光晕（像素颗粒感的暖光）
    ctx.save()
    ctx.globalAlpha = 0.12 + 0.08 * breathe
    const g = ctx.createRadialGradient(cx, cy - 4, 3, cx, cy - 4, 26)
    g.addColorStop(0, 'rgba(255, 186, 96, 0.9)')
    g.addColorStop(1, 'rgba(255, 186, 96, 0)')
    ctx.fillStyle = g
    ctx.fillRect(cx - 26, cy - 30, 52, 52)
    ctx.restore()

    // 外焰（像素块，双帧交替）
    ctx.fillStyle = '#ef7d57'
    if (phase === 0) ctx.fillRect(cx - 5, cy - 11, 10, 9)
    else ctx.fillRect(cx - 4, cy - 12, 9, 10)
    ctx.fillStyle = '#c9a24b'
    ctx.fillRect(cx - 6, cy - 7, 2, 4)
    ctx.fillRect(cx + 4, cy - 8, 2, 5)

    // 内焰
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(cx - 2, cy - 8 + (phase ? 1 : 0), 4, 4)

    // 偶发火星（固定相位，不是随机数）
    const sparkT = (now / 700 + i * 3.1) % 6
    if (sparkT < 0.9) {
      const rise = Math.floor(sparkT * 10)
      ctx.fillStyle = breathe > 0.5 ? '#ffcd75' : '#ef7d57'
      ctx.fillRect(cx + 3, cy - 16 - rise, 1, 1)
      if (sparkT < 0.45) ctx.fillRect(cx - 4, cy - 14 - rise, 1, 1)
    }
  }
}

// ===== 第二单：回形军械库底图 =====
function drawArmoryCarpet(ctx) {
  const x = 19 * 8
  const y = 3 * 8
  const w = 32
  const h = 32
  rect(ctx, x, y, w, h, '#4c221f')
  rect(ctx, x + 1, y + 1, w - 2, h - 2, '#6b2f2b')
  rect(ctx, x + 2, y + 2, w - 4, 1, '#7e3a33')
  rect(ctx, x + 2, y + h - 3, w - 4, 1, '#7e3a33')
  rect(ctx, x + 2, y + 2, 1, h - 4, '#7e3a33')
  rect(ctx, x + w - 3, y + 2, 1, h - 4, '#7e3a33')
  const holes = [
    [6, 5], [13, 10], [22, 4], [27, 17], [10, 20], [24, 26],
  ]
  for (const [hx, hy] of holes) rect(ctx, x + hx, y + hy, 1 + (hx % 2), 1, '#7d7165')
}

function drawArmoryRack(ctx, tx, ty) {
  // 挂在军械库墙面的兵器架（横杆 + 三支枪）
  const x = tx * 8
  const y = ty * 8
  drawNiche(ctx, tx, ty, 1, 1, 7)
  rect(ctx, x + 1, y + 2, 6, 1, '#6d4a2f')
  rect(ctx, x + 2, y + 1, 1, 5, '#94b0c2')
  rect(ctx, x + 4, y + 1, 1, 5, '#b98a3c')
  rect(ctx, x + 6, y + 1, 1, 5, '#94b0c2')
  rect(ctx, x + 1, y + 6, 6, 1, '#3b2718')
}

function makeArmoryBase() {
  const c = document.createElement('canvas')
  c.width = COLS * CELL
  c.height = ROWS * CELL
  const ctx = c.getContext('2d')
  const grid = buildGrid2()

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== 'wall') drawFloorTile(ctx, grid, x, y, grid[y][x])
    }
  }

  drawArmoryCarpet(ctx)

  // 地面装饰：欢迎垫 / 岔口罗盘槽 / 守卫石座
  drawWelcomeMat(ctx, 2, 16)
  drawCompassSlot(ctx, 6, 13)
  drawGuardPedestal(ctx, 21, 5)
  drawBadgeStand(ctx, 23, 2)

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === 'wall') drawWallTile(ctx, grid, x, y)
    }
  }

  // 中庭：暗铁栏围住低亮度齿轮组
  drawGearCage(ctx)

  // 门洞：入口（两格宽）与训练房西侧两个独立门口（门槛贴门沿，不穿地毯）
  drawDoorway(ctx, { x: 5, y1: 13, y2: 14 })
  drawDoorway(ctx, { x: 18, y1: 4, y2: 5, align: 'right' })
  drawDoorway(ctx, { x: 18, y1: 6, y2: 7, align: 'right', topPost: false })

  // 入口石阶
  drawStairs(ctx, 2, 17)

  // 中庭军械库：南面与西面兵器架
  drawArmoryRack(ctx, 9, 12)
  drawArmoryRack(ctx, 13, 12)
  drawArmoryRack(ctx, 7, 6)
  drawArmoryRack(ctx, 7, 8)

  // 补给廊：黄灯 + 架子 + 沿墙木桶 / 木箱
  drawLamp(ctx, 4, 7)
  drawLamp(ctx, 17, 3)
  drawShelf(ctx, 10, 3, 3)
  drawBarrelNiche(ctx, 4, 6)
  drawBarrelNiche(ctx, 4, 10)
  drawCrateNiche(ctx, 6, 3)
  drawCrateNiche(ctx, 15, 3)

  // 火把支架与旧旗
  for (const t of TORCHES_BY_ORDER[2]) drawTorch(ctx, t.x, t.y)
  drawFlag(ctx, 23, 4)

  // 暗角
  drawVignette(ctx)

  drawWallLabels(ctx, [
    { text: '入口', x: 4.6, y: 17.5 },
    { text: '↑ 补给廊', x: 11.5, y: 2.5 },
    { text: '弩廊 →', x: 14.5, y: 15.5 },
    { text: '军械库', x: 11.5, y: 12.5 },
    { text: '训练房', x: 20.5, y: 1.5 },
  ])

  return c
}

// 机械弩：底座 + 横扫当前地图通道的射线；cb: { mode, boltT, x, y, beamLeft, stopX }
function drawCrossbow(ctx, cb, now) {
  const cx = (cb.x + 0.5) * CELL
  const cy = (cb.y + 0.5) * CELL
  const pulse = 0.5 + 0.5 * Math.sin(now / 90)

  // 射线
  if (cb.mode !== 'spent') {
    const beamStart = cb.beamLeft * CELL
    const beamEnd = cx - 12
    const beamW = beamEnd - beamStart
    ctx.save()
    if (cb.mode === 'warning') {
      // 预警：红橙实线 + 一层淡光 + 端点亮点
      ctx.fillStyle = '#ff5a36'
      ctx.globalAlpha = 0.1 + 0.08 * pulse
      ctx.fillRect(beamStart - 2, cy - 4, beamW + 4, 8)
      ctx.globalAlpha = 0.2 + 0.08 * pulse
      ctx.fillRect(beamStart - 1, cy - 2, beamW + 2, 5)
      ctx.fillStyle = '#ff8a4a'
      ctx.globalAlpha = 0.95
      ctx.fillRect(beamStart, cy - 1, beamW, 3)
      ctx.fillStyle = '#ffd9a0'
      ctx.fillRect(beamStart, cy, beamW, 1)
      ctx.globalAlpha = 0.75 + 0.25 * pulse
      ctx.fillStyle = '#ffcd75'
      ctx.fillRect(beamStart - 2, cy - 3, 4, 6)
      ctx.fillRect(beamEnd - 1, cy - 3, 4, 6)
    } else {
      // 平时：暗红虚线 + 两端微光点；暂停时换成暗绿
      const paused = cb.mode === 'paused'
      ctx.globalAlpha = paused ? 0.24 : 0.55
      ctx.fillStyle = paused ? '#7fbf6f' : '#8f3a42'
      for (let x = beamStart; x < beamEnd; x += 10) {
        ctx.fillRect(x, cy - 1, Math.min(6, beamEnd - x), 2)
      }
      ctx.globalAlpha = paused ? 0.4 : 0.8
      ctx.fillStyle = paused ? '#a7f070' : '#b3545c'
      ctx.fillRect(beamStart - 1, cy - 2, 3, 4)
      ctx.fillRect(beamEnd - 1, cy - 2, 3, 4)
    }
    ctx.restore()

    // 危险小靶标：标在弩线真正经过的亮线格上，而不是旁边的等待格
    if (cb.mode === 'warning') {
      const tx = (cb.beamLeft + 0.5) * CELL
      const ty = cy
      const r = 9
      const L = 5
      ctx.save()
      ctx.globalAlpha = 0.55 + 0.35 * pulse
      ctx.fillStyle = '#ffb066'
      // 四角准心
      ctx.fillRect(tx - r, ty - r, L, 2)
      ctx.fillRect(tx - r, ty - r, 2, L)
      ctx.fillRect(tx + r - L, ty - r, L, 2)
      ctx.fillRect(tx + r - 2, ty - r, 2, L)
      ctx.fillRect(tx - r, ty + r - 2, L, 2)
      ctx.fillRect(tx - r, ty + r - L, 2, L)
      ctx.fillRect(tx + r - L, ty + r - 2, L, 2)
      ctx.fillRect(tx + r - 2, ty + r - L, 2, L)
      // 中央准点与四角小点
      ctx.globalAlpha = 0.9
      ctx.fillStyle = '#ffe0b0'
      ctx.fillRect(tx - 1, ty - 1, 2, 2)
      ctx.fillRect(tx - 5, ty - 5, 2, 2)
      ctx.fillRect(tx + 3, ty - 5, 2, 2)
      ctx.fillRect(tx - 5, ty + 3, 2, 2)
      ctx.fillRect(tx + 3, ty + 3, 2, 2)
      ctx.restore()
    }
  }

  // 壁板与弩臂
  ctx.fillStyle = '#3d3730'
  ctx.fillRect(cx - 12, cy - 9, 22, 18)
  ctx.fillStyle = '#332d27'
  ctx.fillRect(cx - 12, cy + 5, 22, 4)
  ctx.fillStyle = '#94b0c2'
  ctx.fillRect(cx - 11, cy - 8, 2, 16)
  ctx.fillRect(cx - 13, cy - 8, 2, 4)
  ctx.fillRect(cx - 13, cy + 4, 2, 4)
  // 弦
  ctx.save()
  ctx.globalAlpha = 0.6
  ctx.fillStyle = '#d8c9a3'
  ctx.fillRect(cx - 9, cy - 6, 1, 12)
  ctx.restore()
  // 弩身（黄铜）
  ctx.fillStyle = '#8a6a2b'
  ctx.fillRect(cx - 8, cy - 2, 16, 5)
  ctx.fillStyle = '#c9a24b'
  ctx.fillRect(cx - 8, cy - 2, 16, 1)
  ctx.fillStyle = '#4a2f1e'
  ctx.fillRect(cx - 8, cy + 2, 16, 1)
  // 待发弩箭
  if (cb.mode === 'idle' || cb.mode === 'warning') {
    ctx.fillStyle = '#e8e2d0'
    ctx.fillRect(cx - 10, cy, 12, 1)
  }
  // 指示灯
  let lamp = '#566c86'
  if (cb.mode === 'warning') lamp = pulse > 0.5 ? '#ef7d57' : '#ffcd75'
  else if (cb.mode === 'paused') lamp = '#a7f070'
  else if (cb.mode === 'spent' || cb.mode === 'firing') lamp = '#33302b'
  ctx.fillStyle = lamp
  ctx.fillRect(cx + 6, cy - 9, 4, 4)
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(cx + 6, cy - 9, 4, 1)
}

function drawBolt(ctx, cb) {
  if (cb.mode !== 'firing') return
  // 中箭者已步入亮线格：箭沿亮线水平飞过去
  const p = Math.min(1, cb.boltT / 260)
  const x0 = (cb.x + 0.5) * CELL - 12
  const y = (cb.y + 0.5) * CELL
  const x1 = (cb.stopX + 0.5) * CELL
  const x = x0 + (x1 - x0) * p
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(-9, -2, 16, 5)
  ctx.fillStyle = '#e8e2d0'
  ctx.fillRect(-8, -1, 13, 3)
  ctx.fillStyle = '#94b0c2'
  ctx.beginPath()
  ctx.moveTo(-12, 0)
  ctx.lineTo(-5, -3)
  ctx.lineTo(-5, 3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// 上手引导：侧室柔光 / 建议格虚线框（都在道具与人物之下）
function drawGuide(ctx, guide, now) {
  if (!guide) return
  const pulse = 0.5 + 0.5 * Math.sin(now / 350)
  if (guide.room) {
    const { x1, y1, x2, y2 } = guide.room
    const px = x1 * CELL
    const py = y1 * CELL
    const w = (x2 - x1 + 1) * CELL
    const h = (y2 - y1 + 1) * CELL
    ctx.save()
    ctx.globalAlpha = 0.05 + 0.05 * pulse
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(px + 2, py + 2, w - 4, h - 4)
    ctx.globalAlpha = 0.3 + 0.3 * pulse
    ctx.strokeStyle = '#ffcd75'
    ctx.lineWidth = 2
    ctx.setLineDash([7, 5])
    ctx.strokeRect(px + 4, py + 4, w - 8, h - 8)
    ctx.restore()
  }
  if (guide.tile) {
    const px = guide.tile.x * CELL
    const py = guide.tile.y * CELL
    ctx.save()
    ctx.globalAlpha = 0.1 + 0.08 * pulse
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(px + 3, py + 3, CELL - 6, CELL - 6)
    ctx.globalAlpha = 0.55 + 0.35 * pulse
    ctx.strokeStyle = '#e8c97a'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    ctx.strokeRect(px + 4, py + 4, CELL - 8, CELL - 8)
    ctx.restore()
  }
}

// highlight: { x, y, valid } | null
// hiddenKey: 拖拽中的道具原格 key，跳过绘制（避免与幽灵重影）
// scene: { guest, skeleton, fx } | null
// 勇者徽章展示台（挂在训练房右侧不可摆的墙面上；徽章本体动态）
function drawBadgeStand(ctx, tx, ty) {
  const x = tx * 8
  const y = ty * 8
  rect(ctx, x + 1, y + 2, 6, 5, '#241f19')
  rect(ctx, x + 1, y + 2, 6, 1, '#171310')
  rect(ctx, x + 2, y + 3, 4, 1, '#2c251d')
  rect(ctx, x, y + 6, 8, 1, '#6b604f')
  rect(ctx, x + 2, y + 5, 4, 1, '#c9a24b')
  rect(ctx, x + 3, y + 4, 2, 1, '#8a6a2b')
}

// 本地闪亮旋转金币（16×16，四帧）
export function drawCoinFrame(ctx, f) {
  ctx.clearRect(0, 0, 16, 16)
  const widths = [10, 6, 2, 6]
  const w = widths[f % 4]
  const x = 8 - w / 2
  ctx.fillStyle = '#1a1c2c'
  ctx.fillRect(x - 1, 3, w + 2, 11)
  ctx.fillStyle = '#e8a53c'
  ctx.fillRect(x, 4, w, 9)
  ctx.fillStyle = '#ffcd75'
  ctx.fillRect(x, 4, w, 3)
  if (f % 4 === 0) {
    ctx.fillStyle = '#fff3c0'
    ctx.fillRect(6, 6, 2, 2)
    ctx.fillStyle = '#c9a24b'
    ctx.fillRect(6, 10, 3, 1)
  } else if (f % 4 === 2) {
    ctx.fillStyle = '#b4832f'
    ctx.fillRect(7, 4, 2, 9)
  }
}

// 营业记录小图标：12×12 像素矩阵（金绿=得分事件，暗红叉=受挫）
const LOG_ICON_ART = {
  chest: {
    pal: { o: '#1a1c2c', Y: '#ffcd75', y: '#c9a24b', b: '#8a6a2b', G: '#7fd66a' },
    rows: [
      '............',
      '.oooooooooo.',
      '.oYyyyyyyYo.',
      '.oYyyyyyyYo.',
      '.oooooooooo.',
      '.oyyyyyyyyo.',
      '.oyybbbyyyo.',
      '.oyybGGbyyo.',
      '.oyybbbyyyo.',
      '.oyyyyyyyyo.',
      '..oooooooo..',
      '............',
    ],
  },
  shield: {
    pal: { o: '#1a1c2c', Y: '#ffcd75', y: '#c9a24b', G: '#5fbf5f', l: '#a7f070' },
    rows: [
      '............',
      '.oooooooooo.',
      '.oYyyyyyyYo.',
      '.oYyyyyyyYo.',
      '.oYyGGGGyYo.',
      '.oYyGllGyYo.',
      '.oYyGllGyYo.',
      '..oYyGGyYo..',
      '...oYyyYo...',
      '....oYYo....',
      '.....oo.....',
      '............',
    ],
  },
  block: {
    pal: { o: '#1a1c2c', Y: '#ffcd75', y: '#c9a24b', G: '#5fbf5f', l: '#a7f070' },
    rows: [
      '............',
      '.oooooooooo.',
      '.oYyyyyyyYo.',
      '.oYyyyyyyYo.',
      '.oYyyGGyyYo.',
      '.oYyGllGyYo.',
      '.oYyyGGyyYo.',
      '..oYyGGyYo..',
      '...oYyyYo...',
      '....oYYo....',
      '.....oo.....',
      '............',
    ],
  },
  safe: {
    pal: { o: '#1a1c2c', G: '#5fbf5f', l: '#a7f070' },
    rows: [
      '............',
      '..........oo',
      '.........oGo',
      '........oGo.',
      '..oo...oGo..',
      '.oGo..oGo...',
      '..oGooGo....',
      '...oGoGo....',
      '....oGo.....',
      '.....o......',
      '............',
      '............',
    ],
  },
  hit: {
    pal: { o: '#1a1c2c', R: '#b34c54' },
    rows: [
      '............',
      '.oo......oo.',
      '.oRRo..oRRo.',
      '..oRRooRRo..',
      '...oRRRRo...',
      '....oRRo....',
      '...oRRRRo...',
      '..oRRooRRo..',
      '.oRRo..oRRo.',
      '.oo......oo.',
      '............',
      '............',
    ],
  },
  badge: {
    pal: { o: '#1a1c2c', Y: '#ffcd75', y: '#c9a24b' },
    rows: [
      '............',
      '.o..o..o..o.',
      '.oYoYoYoYoY.',
      '.oYyyyyyyYo.',
      '.oYyyyyyyYo.',
      '.oYyYYYyyYo.',
      '.oYyyyyyyYo.',
      '..oooooooo..',
      '............',
      '............',
      '............',
      '............',
    ],
  },
  supply: {
    pal: { y: '#c9a24b', G: '#5fbf5f' },
    rows: [
      '............',
      '..y.........',
      '..yGGo......',
      '..yGGGo.....',
      '..yGGo......',
      '..y.........',
      '..y.........',
      '..y.........',
      '..y.........',
      '..y.........',
      '..y.........',
      '............',
    ],
  },
}
LOG_ICON_ART.shot = LOG_ICON_ART.hit

const logIconCache = new Map()

export function logIconDataURL(kind) {
  if (logIconCache.has(kind)) return logIconCache.get(kind)
  const def = LOG_ICON_ART[kind]
  if (!def) return ''
  const w = 12
  const h = def.rows.length
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  for (let r = 0; r < h; r++) {
    const row = def.rows[r]
    for (let i = 0; i < w; i++) {
      const ch = row[i]
      if (!ch || ch === '.') continue
      ctx.fillStyle = def.pal[ch] || '#ffcd75'
      ctx.fillRect(i, r, 1, 1)
    }
  }
  const url = c.toDataURL()
  logIconCache.set(kind, url)
  return url
}

// 木匾边的像素喇叭：静音时变灰并带一道暗红斜杠
const SPEAKER_ROWS = [
  '................',
  '................',
  '....YYY.........',
  '....YYY.........',
  '..YYYYYYY.......',
  '.YYYYYYYYY......',
  '.YYYYYYYYY......',
  '.YYYYYYYYY......',
  '..YYYYYYY.......',
  '....YYY.........',
  '....YYY.........',
  '................',
  '................',
  '................',
  '................',
  '................',
]
const WAVE_PIXELS = [
  [11, 4],
  [12, 5],
  [12, 6],
  [11, 7],
  [13, 3],
  [14, 4],
  [14, 5],
  [14, 6],
  [14, 7],
  [13, 8],
]
const speakerCache = new Map()

export function speakerDataURL(muted = false) {
  const key = muted ? 'muted' : 'on'
  if (speakerCache.has(key)) return speakerCache.get(key)
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 16
  const ctx = c.getContext('2d')
  const stamp = (color, ox = 0, oy = 0) => {
    ctx.fillStyle = color
    for (let r = 0; r < SPEAKER_ROWS.length; r++) {
      const row = SPEAKER_ROWS[r]
      for (let i = 0; i < 16; i++) {
        if (row[i] !== 'Y') continue
        ctx.fillRect(i + ox, r + oy, 1, 1)
      }
    }
  }
  stamp('#1a1c2c', 1, 1)
  stamp(muted ? '#8a8070' : '#e8c97a')
  if (muted) {
    ctx.fillStyle = '#d95757'
    for (let i = 0; i < 9; i++) ctx.fillRect(4 + i, 12 - i, 2, 2)
  } else {
    ctx.fillStyle = '#a7f070'
    for (const [x, y] of WAVE_PIXELS) ctx.fillRect(x, y, 1, 1)
  }
  const url = c.toDataURL()
  speakerCache.set(key, url)
  return url
}

// 简洁像素沙漏（8×10）
export function hourglassDataURL() {
  const rows = [
    'oooooooo',
    'oSSSSSSo',
    'oSo..oSo',
    '.oSSoSo.',
    '..oSo...',
    '..oSo...',
    '.oSSoSo.',
    'oSo..oSo',
    'oSSSSSSo',
    'oooooooo',
  ]
  const pal = { o: '#1a1c2c', S: '#c9a24b' }
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 10
  const ctx = c.getContext('2d')
  for (let r = 0; r < rows.length; r++) {
    for (let i = 0; i < 8; i++) {
      const ch = rows[r][i]
      if (ch === '.') continue
      ctx.fillStyle = pal[ch] || '#ffcd75'
      ctx.fillRect(i, r, 1, 1)
    }
  }
  return c.toDataURL()
}

// 布置期路线脚印（很淡，流动点缓慢前进）
function drawFootprints(ctx, data, now) {
  const tiles = data.tiles
  if (!tiles || tiles.length < 2) return
  ctx.save()
  const baseAlpha = data.preview ? 0.22 : 0.13
  ctx.fillStyle = data.preview ? '#e6c98a' : '#cfd3da'
  for (let i = 1; i < tiles.length; i++) {
    const a = tiles[i - 1]
    const b = tiles[i]
    const dx = Math.sign(b.x - a.x)
    const dy = Math.sign(b.y - a.y)
    const px = (b.x + 0.5) * CELL
    const py = (b.y + 0.72) * CELL
    const ox = dy !== 0 ? (i % 2 ? -3 : 3) : 0
    const oy = dx !== 0 ? (i % 2 ? -3 : 3) : 0
    ctx.globalAlpha = baseAlpha
    ctx.fillRect(px + ox - 1, py + oy - 2, 2, 3)
  }
  const n = tiles.length - 1
  const p = (now / 3800) % 1
  const pos = p * n
  const i0 = Math.min(n - 1, Math.floor(pos))
  const fr = pos - i0
  const A = tiles[i0]
  const B = tiles[i0 + 1]
  const lx = (A.x + (B.x - A.x) * fr + 0.5) * CELL
  const ly = (A.y + (B.y - A.y) * fr + 0.5) * CELL
  ctx.globalAlpha = 0.32
  ctx.fillStyle = data.preview ? '#f2d99e' : '#f2e2b8'
  ctx.fillRect(lx - 1, ly - 1, 3, 3)
  ctx.restore()
}

// 呼吸四角标：绿=可放 / 红=不可放
function drawCornerBrackets(ctx, x, y, valid, now) {
  const px = x * CELL
  const py = y * CELL
  const pulse = 0.5 + 0.5 * Math.sin(now / 200)
  const L = 9
  const T = 2
  ctx.save()
  ctx.globalAlpha = 0.55 + 0.35 * pulse
  ctx.fillStyle = valid ? '#a7f070' : '#d95757'
  // 左上
  ctx.fillRect(px + 2, py + 2, L, T)
  ctx.fillRect(px + 2, py + 2, T, L)
  // 右上
  ctx.fillRect(px + CELL - 2 - L, py + 2, L, T)
  ctx.fillRect(px + CELL - 2 - T, py + 2, T, L)
  // 左下
  ctx.fillRect(px + 2, py + CELL - 2 - T, L, T)
  ctx.fillRect(px + 2, py + CELL - 2 - L, T, L)
  // 右下
  ctx.fillRect(px + CELL - 2 - L, py + CELL - 2 - T, L, T)
  ctx.fillRect(px + CELL - 2 - T, py + CELL - 2 - L, T, L)
  ctx.restore()
}

export function renderScene(ctx, base, game, highlight, hiddenKey = null, scene = null) {
  ctx.drawImage(base, 0, 0)
  const now = performance.now()
  drawTorchFlames(ctx, now, (scene && scene.torches) || TORCHES_BY_ORDER[1])
  if (scene && scene.crossbow) drawCrossbow(ctx, scene.crossbow, now)
  if (scene && scene.guide) drawGuide(ctx, scene.guide, now)
  if (scene && scene.dragging && scene.forbidden) drawForbidden(ctx, scene.forbidden)
  if (scene && scene.footprints) drawFootprints(ctx, scene.footprints, now)
  for (const [key, item] of game.items) {
    if (key === hiddenKey) continue
    if (scene && scene.pop && scene.pop.key === key) continue
    drawItem(ctx, item.type, item.x * CELL, item.y * CELL, item.dir, item.opened, item.taken)
  }
  // 落位回弹 + 四粒像素灰
  if (scene && scene.pop) {
    const p = Math.min(1, scene.pop.t / scene.pop.ms)
    const lift = Math.sin(p * Math.PI) * 4
    drawItem(
      ctx,
      scene.pop.type,
      scene.pop.x * CELL,
      scene.pop.y * CELL - lift,
      scene.pop.dir || 0,
      false,
      false,
    )
    ctx.save()
    ctx.globalAlpha = 0.5 * (1 - p)
    ctx.fillStyle = '#9aa0aa'
    const bx = scene.pop.x * CELL + 16
    const by = scene.pop.y * CELL + 27
    const spread = 4 + p * 10
    ctx.fillRect(bx - spread, by - 2, 2, 2)
    ctx.fillRect(bx + spread, by - 2, 2, 2)
    ctx.fillRect(bx - 8 - spread, by + 3, 2, 2)
    ctx.fillRect(bx + 8 + spread, by + 3, 2, 2)
    ctx.restore()
  }
  // 徽章展示台（墙面原位陈列）
  if (scene && scene.stand && scene.standBadge) {
    drawHeroBadge(
      ctx,
      (scene.stand.x + 0.5) * CELL,
      scene.stand.y * CELL + 18,
      1,
    )
  }
  if (scene && scene.skeleton) {
    drawSkeleton(
      ctx,
      scene.skeleton.x,
      scene.skeleton.y,
      scene.skeleton.pose,
      now,
      scene.flash === 'skeleton',
    )
  }
  if (scene && scene.guest) drawGuest(ctx, scene.guest)
  if (scene && scene.fx) drawFx(ctx, scene.fx)
  // 开箱金光
  if (scene && scene.spark) {
    const p = Math.min(1, scene.spark.t / scene.spark.ms)
    const sx = scene.spark.x * CELL + 6 + p * 10
    const sy = scene.spark.y * CELL - 6 - Math.sin(p * Math.PI) * 14
    ctx.save()
    ctx.globalAlpha = 1 - p
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(sx, sy, 6, 6)
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(sx + 1, sy + 1, 4, 4)
    ctx.restore()
  }
  // 徽章从展示台飞到客人头边
  if (scene && scene.badgeFly && scene.guest) {
    const p = Math.min(1, scene.badgeFly.p)
    const fx0 = (scene.stand.x + 0.5) * CELL
    const fy0 = scene.stand.y * CELL + 18
    const fx1 = (scene.guest.x + 0.5) * CELL
    const fy1 = (scene.guest.y + 1) * CELL - 46
    const bx = fx0 + (fx1 - fx0) * p
    const by = fy0 + (fy1 - fy0) * p - Math.sin(p * Math.PI) * 20
    drawHeroBadge(ctx, bx, by, 1)
  }
  if (scene && scene.crossbow) drawBolt(ctx, scene.crossbow)
  if (highlight) {
    if (highlight.type && highlight.valid) {
      // 合法落点：格里先显示半透明道具
      ctx.save()
      ctx.globalAlpha = 0.45
      drawItem(
        ctx,
        highlight.type,
        highlight.x * CELL,
        highlight.y * CELL,
        highlight.dir || 0,
        false,
        false,
      )
      ctx.restore()
    }
    drawCornerBrackets(ctx, highlight.x, highlight.y, highlight.valid, now)
  }
}