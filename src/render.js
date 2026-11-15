import { COLS, ROWS, TILE, SCALE, buildGrid, buildGrid2 } from './map.js'

const CELL = TILE * SCALE
const PX = 3 // 8x8 图案放大到 24x24

// ===== 场景美术：1 单位 = 4px（每格 8x8 单位） =====
const U = 4

const FLOORS = {
  entrance: { base: '#7a5533', light: '#866040', dark: '#6b4a2b' }, // 暖木入口
  corridor: { base: '#857c71', light: '#90877b', dark: '#786f64' },
  side: { base: '#8b8175', light: '#968c7f', dark: '#7d7468' },
  sideA: { base: '#63707a', light: '#6e7b85', dark: '#57646d' }, // 青灰地砖
  sideB: { base: '#55371f', light: '#5f3f25', dark: '#4a2f1a' }, // 深木
  challenge: { base: '#7f7367', light: '#8a7e71', dark: '#71665b' },
  supply: { base: '#6b4a30', light: '#78563a', dark: '#5d3f27' },
}

const WOOD_ZONES = new Set(['supply', 'entrance', 'sideB'])

const WALL = {
  base: '#5d5449',
  light: '#655c50',
  dark: '#564e44',
  mortar: '#453e36',
  highlight: '#7a6f61',
  capShadow: '#332d26',
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

const THRESHOLDS = [
  { x: 7, y: 14 }, // 入口门
  { x: 8, y: 5 }, // 侧室 A 门
  { x: 12, y: 11 }, // 侧室 B 门
  { x: 12, y: 4 }, // 挑战房门
]

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
    // 木质地面：横向板缝 + 错缝
    rect(ctx, ux, uy, 8, 8, hash === 0 ? f.light : hash === 7 ? f.dark : f.base)
    alphaRect(ctx, ux, uy, 8, 1, '#3a2a1a', 0.55)
    const off = (x + y) % 2 === 0 ? 0 : 4
    alphaRect(ctx, ux + off, uy, 1, 8, '#3a2a1a', 0.35)
    if (s === 3) rect(ctx, ux + 2, uy + 5, 1, 1, f.dark)
    if (s === 11) rect(ctx, ux + 5, uy + 2, 1, 1, f.light)
  } else {
    rect(ctx, ux, uy, 8, 8, hash === 0 ? f.light : hash === 7 ? f.dark : f.base)
    // 地砖纹理：克制的一点斑点与石缝
    if (s === 3) rect(ctx, ux + 2, uy + 5, 1, 1, f.dark)
    else if (s === 11) rect(ctx, ux + 5, uy + 2, 1, 1, f.light)
    alphaRect(ctx, ux, uy, 8, 1, '#2e2822', 0.13)
    alphaRect(ctx, ux, uy, 1, 8, '#2e2822', 0.09)
    // 偶发裂纹
    if ((x * 13 + y * 29) % 31 === 0) {
      rect(ctx, ux + 3, uy + 2, 1, 2, f.dark)
      rect(ctx, ux + 4, uy + 4, 1, 2, f.dark)
    }
  }

  // 靠墙环境阴影：给厚墙压出体积
  const isWall = (xx, yy) =>
    yy < 0 || yy >= ROWS || xx < 0 || xx >= COLS || grid[yy][xx] === 'wall'
  if (isWall(x, y - 1)) {
    alphaRect(ctx, ux, uy, 8, 1, '#17120e', 0.34)
    alphaRect(ctx, ux, uy + 1, 8, 1, '#17120e', 0.14)
  }
  if (isWall(x, y + 1)) alphaRect(ctx, ux, uy + 7, 8, 1, '#17120e', 0.28)
  if (isWall(x - 1, y)) alphaRect(ctx, ux, uy, 1, 8, '#17120e', 0.25)
  if (isWall(x + 1, y)) alphaRect(ctx, ux + 7, uy, 1, 8, '#17120e', 0.25)
}

// 只有紧贴走道/房间的一圈墙画砖；远处沉为暗石，只留零星旧痕
function isNearFloor(grid, x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx
      const ny = y + dy
      if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS) continue
      if (grid[ny][nx] !== 'wall') return true
    }
  }
  return false
}

function drawWallTile(ctx, grid, x, y) {
  const ux = x * 8
  const uy = y * 8
  if (!isNearFloor(grid, x, y)) {
    // 远景暗石：无砖纹，少量旧痕
    rect(ctx, ux, uy, 8, 8, '#241f19')
    const s = (x * 7 + y * 13) % 17
    if (s === 3) alphaRect(ctx, ux + 2, uy + 5, 2, 1, '#2e2822', 0.9)
    if (s === 9) alphaRect(ctx, ux + 5, uy + 2, 1, 1, '#1c1814', 0.9)
    return
  }
  rect(ctx, ux, uy, 8, 8, WALL.base)

  // 大块错缝砖：每格两排、每排 4 单位（16px），错缝、低对比
  for (let r = 0; r < 2; r++) {
    const vy = r * 4
    const tone = (x * 3 + r) % 3
    const brick = tone === 0 ? WALL.light : tone === 1 ? WALL.base : WALL.dark
    rect(ctx, ux, uy + vy + 1, 8, 3, brick)
    rect(ctx, ux, uy + vy + 1, 8, 1, WALL.highlight)
    alphaRect(ctx, ux, uy + vy + 3, 8, 1, '#2f2a24', 0.25)
    rect(ctx, ux, uy + vy, 8, 1, WALL.mortar)
    const off = (r + x) % 2 === 0 ? 0 : 4
    rect(ctx, ux + off, uy + vy, 1, 4, WALL.mortar)
  }

  // 斑驳旧痕
  if ((x * 5 + y * 3) % 11 === 0) alphaRect(ctx, ux + 5, uy + 2, 2, 1, '#3c362f', 0.5)
  if ((x * 11 + y * 7) % 23 === 0) alphaRect(ctx, ux + 1, uy + 5, 2, 1, '#6d6357', 0.4)

  // 下方是地板：墙面高光 + 接触阴影，读作“厚墙”
  if (y + 1 < ROWS && grid[y + 1][x] !== 'wall') {
    rect(ctx, ux, uy + 6, 8, 1, WALL.highlight)
    rect(ctx, ux, uy + 7, 8, 1, WALL.capShadow)
  }
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

function drawThreshold(ctx, tx, ty) {
  // 铜门槛对准实际可走门洞：居中一条竖带
  const ux = tx * 8
  const uy = ty * 8
  rect(ctx, ux + 3, uy + 1, 2, 6, '#7d5f35')
  rect(ctx, ux + 3, uy + 1, 2, 1, '#a98a52')
  alphaRect(ctx, ux + 5, uy + 1, 1, 6, '#1f1a16', 0.22)
}

function drawNiche(ctx, tx, ty, wTiles, inTop, inBottom) {
  // 墙格凹龛：陈设全部收进墙里，地面留给摆放
  const x = tx * 8
  const y = ty * 8
  const w = wTiles * 8
  rect(ctx, x, y + inTop, w, inBottom - inTop, '#241f19')
  rect(ctx, x, y + inTop, w, 1, '#171310')
  alphaRect(ctx, x, y + inBottom - 1, w, 1, '#171310', 0.45)
  rect(ctx, x, y + inTop + 1, 1, inBottom - inTop - 2, '#4a423a')
  rect(ctx, x + w - 1, y + inTop + 1, 1, inBottom - inTop - 2, '#4a423a')
  rect(ctx, x, y + inBottom, w, 1, '#7a6f61')
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
  const cx = (tx * 8 + 4) * U
  const cy = (ty * 8 + 4) * U
  // 烘焙进底图的暖光
  const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 30)
  g.addColorStop(0, 'rgba(255, 178, 90, 0.16)')
  g.addColorStop(1, 'rgba(255, 178, 90, 0)')
  ctx.fillStyle = g
  ctx.fillRect(cx - 30, cy - 30, 60, 60)
  // 铁架火把座（火苗在动态层）
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
  // 房间名移到墙上/门边，不再压在地面中央
  drawWallLabels(ctx, [
    { text: '入口', x: 3.5, y: 17.5 },
    { text: '通道', x: 12.5, y: 6.5 },
    { text: '侧室', x: 6.5, y: 2.5 },
    { text: '侧室', x: 19.5, y: 8.5 },
    { text: '挑战房', x: 18.5, y: 1.5 },
  ])
}

function drawWallLabels(ctx, labels) {
  ctx.font = 'bold 11px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const l of labels) {
    const px = l.x * 8 * U
    const py = l.y * 8 * U
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(20, 16, 12, 0.8)'
    ctx.strokeText(l.text, px, py)
    ctx.fillStyle = 'rgba(216, 201, 166, 0.92)'
    ctx.fillText(l.text, px, py)
  }
}

// ===== 像素道具（8x8 图案） =====
const SPRITES = {
  chest: {
    rows: [
      '........',
      '.oooooo.',
      'oLLLLLLo',
      'oLLLLLLo',
      'oooooooo',
      'oBBggBBo',
      'oBBggBBo',
      '.oooooo.',
    ],
    colors: { o: '#1a1c2c', L: '#b13e53', B: '#ef7d57', g: '#ffcd75' },
  },
  // 开过的箱子：盖板立起、内部变暗、金锁消失
  chestOpen: {
    rows: [
      '.o....o.',
      '.o....o.',
      'oooooooo',
      'oKKKKKKo',
      'oBBBBBBo',
      'oBBBBBBo',
      'oBBBBBBo',
      '.oooooo.',
    ],
    colors: { o: '#1a1c2c', K: '#0f1020', B: '#ef7d57' },
  },
  shield: {
    rows: [
      '.oooooo.',
      'oSSSSSSo',
      'oSSggSSo',
      'oSSggSSo',
      'oSSSSSSo',
      '.oSSSSo.',
      '..oSSo..',
      '.rrrrrr.',
    ],
    colors: { o: '#1a1c2c', S: '#94b0c2', g: '#ffcd75', r: '#ef7d57' },
  },
  // 盾被拿走后：只剩架子
  shieldEmpty: {
    rows: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '.o....o.',
      '..o..o..',
      '.rrrrrr.',
    ],
    colors: { o: '#1a1c2c', r: '#ef7d57' },
  },
  sign: {
    rows: [
      '...oo...',
      '..oAAo..',
      '.oAAAAo.',
      'oAAAAAAo',
      '...AA...',
      '...AA...',
      '...AA...',
      '...oo...',
    ],
    colors: { o: '#1a1c2c', A: '#ffcd75' },
  },
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

export function drawItem(ctx, type, ox, oy, dir = 0, opened = false, taken = false) {
  let sprite = SPRITES[type]
  if (type === 'chest' && opened) sprite = SPRITES.chestOpen
  if (type === 'shield' && taken) sprite = SPRITES.shieldEmpty
  if (!sprite) return
  ctx.save()
  ctx.translate(ox + CELL / 2, oy + CELL / 2)
  if (dir) ctx.rotate((dir * Math.PI) / 2) // 顺时针 90° * dir
  ctx.translate(-12, -12)
  drawPattern(ctx, sprite)
  ctx.restore()
}

// 客人：浮点格坐标；方向/步态由行走驱动；盾低持、格挡时抬盾压身
export function drawGuest(ctx, guest) {
  const variant = guest.variant === 'fan' ? 'fan' : 'knight'
  const sets = variant === 'fan' ? FAN_FRAMES : KNIGHT_FRAMES
  const palette = variant === 'fan' ? FAN_PALETTE : KNIGHT_PALETTE
  const cx = (guest.x + 0.5) * CELL + (guest.offsetX || 0)
  const crouch = guest.blocking ? 3 : 0
  const feetY = (guest.y + 1) * CELL - 3 + (guest.offsetY || 0) + crouch
  const facing = guest.facing || 'down'
  const phase = guest.moving ? guest.walkPhase || 0 : 0
  drawChar(ctx, sets, palette, facing, phase, cx, feetY)

  if (guest.hasBadge) {
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(cx - 3, feetY - 45, 7, 7)
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(cx - 2, feetY - 44, 5, 5)
    ctx.fillStyle = '#b13e53'
    ctx.fillRect(cx - 1, feetY - 43, 3, 3)
  }

  if (guest.hasShield) {
    const sx = facing === 'right' ? cx + 8 : cx - 17
    // 平时低持；格挡时抬起护住面门
    const top = feetY - (guest.blocking ? 34 : 22)
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(sx, top, 9, 15)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(sx + 1, top + 1, 7, 13)
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(sx + 3, top + 5, 3, 3)
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

export function drawSkeleton(ctx, sx, sy, pose) {
  const cx = (sx + 0.5) * CELL
  const feetY = (sy + 1) * CELL - 3
  const ox = cx - 12
  const oy = feetY - CHAR_H * CHAR_PX
  if (pose === 'down') {
    ctx.save()
    ctx.globalAlpha = 0.8
    ctx.translate(cx, oy + (CHAR_H * CHAR_PX) / 2)
    ctx.rotate(Math.PI / 2)
    ctx.translate(-12, -(CHAR_H * CHAR_PX) / 2)
    drawCharRows(ctx, SKELETON_ROWS, SKELETON_PALETTE, 0, 0)
    ctx.restore()
    return
  }
  drawCharRows(ctx, SKELETON_ROWS, SKELETON_PALETTE, ox, oy)
  drawSkeletonHammer(ctx, ox, oy, pose)
}

// fx: { kind: 'strike'|'block'|'hit'|'slash', at: {x,y}, t, ms }
function drawFx(ctx, fx) {
  const p = Math.min(1, fx.t / fx.ms)
  const cx = (fx.at.x + 0.5) * CELL
  const cy = (fx.at.y + 0.5) * CELL
  ctx.save()
  ctx.globalAlpha = 1 - p
  ctx.lineCap = 'round'
  if (fx.kind === 'strike') {
    ctx.strokeStyle = '#ffcd75'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(cx + 16, cy - 24)
    ctx.lineTo(cx - 10, cy + 4)
    ctx.stroke()
  } else if (fx.kind === 'block') {
    ctx.strokeStyle = '#73eff7'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(cx - 2, cy, 20, Math.PI * 0.5, Math.PI * 1.5)
    ctx.stroke()
  } else if (fx.kind === 'hit') {
    ctx.strokeStyle = '#b13e53'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(cx - 16, cy - 16)
    ctx.lineTo(cx + 16, cy + 16)
    ctx.moveTo(cx + 16, cy - 16)
    ctx.lineTo(cx - 16, cy + 16)
    ctx.stroke()
  } else if (fx.kind === 'slash') {
    ctx.strokeStyle = '#f4f4f4'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(cx - 20, cy - 18)
    ctx.lineTo(cx + 18, cy + 16)
    ctx.moveTo(cx - 18, cy + 14)
    ctx.lineTo(cx + 20, cy - 14)
    ctx.stroke()
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

  // 3. 砖砌厚墙
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === 'wall') drawWallTile(ctx, grid, x, y)
    }
  }

  // 4. 门边铜门槛
  for (const t of THRESHOLDS) drawThreshold(ctx, t.x, t.y)

  // 5. 靠墙陈设（全部收进墙格壁龛，地面保持可摆放）
  drawCounterNiche(ctx) // 入口北墙：柜台龛 + 黄铜小铃
  drawShelfNiche(ctx) // 侧室 A 北墙：书架龛
  drawCrateNiche(ctx) // 侧室 A 南墙：木箱龛
  drawTableNiche(ctx) // 侧室 B 北墙：桌凳龛 + 蜡烛
  drawBarrelNiche(ctx, 10, 2)
  drawBarrelNiche(ctx, 6, 17)
  drawBarrelNiche(ctx, 20, 14)
  drawBarrelNiche(ctx, 22, 7)

  // 6. 火把（火苗动态层）、灯与旧旗
  for (const t of TORCHES_BY_ORDER[1]) drawTorch(ctx, t.x, t.y)
  drawLamp(ctx, 4, 11) // 入口暖灯（柜台旁）
  drawLamp(ctx, 14, 8) // 右侧室烛灯
  drawFlag(ctx, 5, 11)
  drawFlag(ctx, 23, 4)

  // 7. 房间名上墙
  drawLabels(ctx)

  return c
}

function drawTorchFlames(ctx, now, torches) {
  for (let i = 0; i < torches.length; i++) {
    const t = torches[i]
    const phase = Math.floor(now / 170 + i * 0.7) % 2
    const cx = (t.x + 0.5) * CELL
    const cy = (t.y + 0.42) * CELL
    ctx.fillStyle = '#ef7d57'
    if (phase === 0) ctx.fillRect(cx - 5, cy - 10, 10, 8)
    else ctx.fillRect(cx - 4, cy - 11, 9, 9)
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(cx - 2, cy - 7, 4, 4)
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

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] === 'wall') drawWallTile(ctx, grid, x, y)
    }
  }

  // 三个门洞的铜门槛：入口、补给门、近路门
  drawThreshold(ctx, 5, 14)
  drawThreshold(ctx, 19, 4)
  drawThreshold(ctx, 19, 7)

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

  // 火把与旧旗
  for (const t of TORCHES_BY_ORDER[2]) drawTorch(ctx, t.x, t.y)
  drawFlag(ctx, 23, 4)

  drawWallLabels(ctx, [
    { text: '入口', x: 2.5, y: 17.5 },
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
    let alpha = 0.1
    let color = '#b13e53'
    if (cb.mode === 'warning') {
      alpha = 0.28 + 0.22 * pulse
      color = '#ef7d57'
    } else if (cb.mode === 'paused') {
      alpha = 0.1
      color = '#a7f070'
    }
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    for (let x = cb.beamLeft * CELL; x < cx - 12; x += 12) {
      ctx.fillRect(x, cy - 1, 7, 2)
    }
    ctx.restore()
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
export function renderScene(ctx, base, game, highlight, hiddenKey = null, scene = null) {
  ctx.drawImage(base, 0, 0)
  const now = performance.now()
  drawTorchFlames(ctx, now, (scene && scene.torches) || TORCHES_BY_ORDER[1])
  if (scene && scene.crossbow) drawCrossbow(ctx, scene.crossbow, now)
  if (scene && scene.guide) drawGuide(ctx, scene.guide, now)
  for (const [key, item] of game.items) {
    if (key === hiddenKey) continue
    drawItem(ctx, item.type, item.x * CELL, item.y * CELL, item.dir, item.opened, item.taken)
  }
  if (scene && scene.skeleton) {
    drawSkeleton(ctx, scene.skeleton.x, scene.skeleton.y, scene.skeleton.pose)
  }
  if (scene && scene.guest) drawGuest(ctx, scene.guest)
  if (scene && scene.fx) drawFx(ctx, scene.fx)
  if (scene && scene.crossbow) drawBolt(ctx, scene.crossbow)
  if (highlight) {
    ctx.lineWidth = 3
    ctx.strokeStyle = highlight.valid ? '#a7f070' : '#b13e53'
    ctx.strokeRect(
      highlight.x * CELL + 2,
      highlight.y * CELL + 2,
      CELL - 4,
      CELL - 4,
    )
  }
}