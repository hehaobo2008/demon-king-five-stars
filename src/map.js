// 占位地图数据：首单与第三单 32 x 24 格，其余关 24 x 18；每格 8px，放大 4 倍渲染
// 后续轮次可直接改这里的房间矩形，或换成正式的关卡数据格式。

export const COLS = 24
export const ROWS = 18
export const TILE = 8
export const SCALE = 4

// 每个分区：名称 + 两档地板色（棋盘格微纹理）+ 标签锚点（格坐标）
export const ZONES = {
  wall: { name: '墙体', colors: ['#1a1c2c', '#1a1c2c'] },
  entrance: {
    name: '入口',
    colors: ['#29366f', '#3b5dc9'],
    label: { x: 15.5, y: 21.5 },
  },
  corridor: {
    name: '通道',
    colors: ['#333c57', '#566c86'],
    label: { x: 15.5, y: 16 },
  },
  side: {
    name: '侧室',
    colors: ['#257179', '#38b764'],
    label: null, // 两个侧室单独标注
  },
  challenge: {
    name: '挑战房',
    colors: ['#5d275d', '#b13e53'],
    label: { x: 16, y: 3.5 },
  },
}

// 房间/走廊矩形（含边界，单位：格）——首单 32×24
export const ROOMS = {
  entrance: { x1: 12, y1: 20, x2: 19, y2: 22 },
  sideA: { x1: 2, y1: 8, x2: 8, y2: 14 },
  sideB: { x1: 23, y1: 7, x2: 29, y2: 13 },
  challenge: { x1: 11, y1: 1, x2: 20, y2: 5 },
}

const RECTS = [
  { ...ROOMS.entrance, zone: 'entrance' },
  { zone: 'corridor', x1: 15, y1: 7, x2: 16, y2: 18 }, // 主路：南厅 → 挑战厅
  { ...ROOMS.sideA, zone: 'sideA' }, // 左室（青灰地砖）
  { ...ROOMS.sideB, zone: 'sideB' }, // 右室（深木）
  { ...ROOMS.challenge, zone: 'challenge' }, // 北挑战厅
  { zone: 'corridor', x1: 15, y1: 6, x2: 16, y2: 6 }, // 挑战厅南门
  { zone: 'corridor', x1: 15, y1: 19, x2: 16, y2: 19 }, // 南厅北门
  { zone: 'corridor', x1: 9, y1: 12, x2: 14, y2: 12 }, // 左室南口 → 主路
  { zone: 'corridor', x1: 9, y1: 9, x2: 14, y2: 9 }, // 左室北口 → 主路
  { zone: 'corridor', x1: 17, y1: 11, x2: 22, y2: 11 }, // 右室南口 → 主路
  { zone: 'corridor', x1: 17, y1: 8, x2: 22, y2: 8 }, // 右室北口 → 主路
  { zone: 'corridor', x1: 1, y1: 3, x2: 10, y2: 3 }, // 左外侧廊北排 → 挑战厅西门
  { zone: 'corridor', x1: 1, y1: 4, x2: 1, y2: 8 }, // 左外侧廊西列，(1,8) 接左室
  { zone: 'corridor', x1: 21, y1: 2, x2: 30, y2: 2 }, // 右外侧廊北排 → 挑战厅东门
  { zone: 'corridor', x1: 30, y1: 3, x2: 30, y2: 7 }, // 右外侧廊东列，(30,7) 接右室
]

// 室内半截实墙：挡视线但两端都能绕（左室横在 y11，右室横在 y10）
const HALF_WALLS = [
  [4, 11],
  [5, 11],
  [6, 11],
  [25, 10],
  [26, 10],
  [27, 10],
]

// 客人路线经过的岔口：站在岔口格上、路牌箭头指向 dir 时，他会进那边侧室
// dir：0上 1右 2下 3左；room 用于「侧室里有没有宝箱」判定
export const JUNCTIONS = [
  { x: 15, y: 12, dir: 3, room: 'sideA', lookAt: { x: 8, y: 12 } },
  { x: 16, y: 11, dir: 1, room: 'sideB', lookAt: { x: 23, y: 11 } },
]

// 挑战厅固定骷髅守卫：占据 (16,3)，该格不可摆道具；客人停在 (16,4) 与它对峙
export const SKELETON = { x: 16, y: 3 }

// ===== 第二单：回形军械库（与首单完全独立的第二张地图） =====
// 回形环廊：左/上是木质补给廊，右/下是石廊近路；中央是军械库实体块。
// 岔口 (6,13) 摆路牌，朝上(0) → 补给廊；其他方向或不摆 → 右转近路（经过机械弩）。
export const MAP2 = {
  spawn: { x: 2, y: 15 },
  junction: { x: 6, y: 13, dir: 0 },
  skeleton: { x: 21, y: 5 },
  challenge: { x: 20, y: 5 },
  crossbow: { x: 19, y: 8 },
  beamLeft: 17,
  trapStop: { x: 17, y: 9 },
  trapBeam: { x: 17, y: 8 },
  trapFar: { x: 17, y: 7 },
  doors: {
    entrance: { x: 5, y: 14 },
    supply: { x: 19, y: 4 },
    short: { x: 19, y: 7 },
  },
}

const RECTS2 = [
  { zone: 'entrance', x1: 1, y1: 13, x2: 4, y2: 16 },
  { zone: 'corridor', x1: 5, y1: 13, x2: 18, y2: 14 }, // 下侧石廊
  { zone: 'corridor', x1: 17, y1: 6, x2: 18, y2: 12 }, // 右侧石廊（弩线所在）
  { zone: 'supply', x1: 5, y1: 4, x2: 6, y2: 12 }, // 左侧补给廊（木质）
  { zone: 'supply', x1: 5, y1: 4, x2: 18, y2: 5 }, // 上侧补给廊
  { zone: 'challenge', x1: 19, y1: 2, x2: 22, y2: 7 }, // 训练房
]

export function buildGrid2() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('wall'))
  for (const r of RECTS2) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        grid[y][x] = r.zone
      }
    }
  }
  return grid
}

// ===== 正篇第三关：回声集市（32×24 新地形） =====
// 南厅接南巷；北巷/南巷两条横巷夹住中央广场，广场中心扣掉喷泉挡路；
// 西铺/东铺各是 L 形，南北各开门接两条巷，另有短巷通向广场。
// 真实岔口由 MARKET.junctions 标记，路牌只在那里生效。
export const MARKET = {
  spawn: { x: 15, y: 21 },
  exit: { x: 16, y: 21 }, // 南厅离场格：两件货带回这里才出评价
  skeleton: { x: 16, y: 2 }, // 守卫只是北厅陈设，淘货客不去打锤
  arena: { x: 14.5, y: 3.1 },
  stand: { x: 18, y: 2 },
  shops: {
    west: {
      rects: [
        { x1: 2, y1: 7, x2: 9, y2: 10 },
        { x1: 2, y1: 11, x2: 7, y2: 14 },
      ],
      name: '西铺',
      label: '西铺 · 草料',
    },
    east: {
      rects: [
        { x1: 23, y1: 8, x2: 29, y2: 12 },
        { x1: 25, y1: 13, x2: 29, y2: 16 },
      ],
      name: '东铺',
      label: '东铺 · 陶器',
    },
  },
  junctions: [
    { x: 4, y: 6 }, // 西铺北门 / 北巷
    { x: 4, y: 17 }, // 西铺南门 / 南巷
    { x: 27, y: 6 }, // 东铺北门 / 北巷
    { x: 27, y: 17 }, // 东铺南门 / 南巷
    { x: 13, y: 6 }, // 广场西北口 / 北巷
    { x: 18, y: 6 }, // 广场东北口 / 北巷
    { x: 13, y: 17 }, // 广场西南口 / 南巷
    { x: 18, y: 17 }, // 广场东南口 / 南巷
    { x: 15, y: 18 }, // 南厅入口 / 南巷
    { x: 15, y: 5 }, // 北厅南门西
    { x: 16, y: 5 }, // 北厅南门东
  ],
  doors: {
    west: [
      { x: 4, y: 7 },
      { x: 4, y: 14 },
    ],
    east: [
      { x: 27, y: 8 },
      { x: 27, y: 16 },
    ],
    plaza: [
      { x: 15, y: 7 },
      { x: 16, y: 7 },
      { x: 15, y: 16 },
      { x: 16, y: 16 },
    ],
    challenge: [
      { x: 15, y: 4 },
      { x: 16, y: 4 },
    ],
  },
}

const RECTS3 = [
  { zone: 'entrance', x1: 12, y1: 20, x2: 19, y2: 22 }, // 南厅
  { zone: 'market', x1: 15, y1: 19, x2: 16, y2: 19 }, // 南厅北门 → 南巷
  { zone: 'market', x1: 4, y1: 17, x2: 28, y2: 18 }, // 南巷
  { zone: 'market', x1: 4, y1: 5, x2: 27, y2: 6 }, // 北巷
  { zone: 'plaza', x1: 13, y1: 8, x2: 18, y2: 16 }, // 中央广场
  { zone: 'market', x1: 13, y1: 7, x2: 18, y2: 7 }, // 广场北口 → 北巷
  { zone: 'challenge', x1: 11, y1: 1, x2: 20, y2: 4 }, // 北厅（挑战房）
  { zone: 'westShop', x1: 2, y1: 7, x2: 9, y2: 10 }, // 西铺上段
  { zone: 'westShop', x1: 2, y1: 11, x2: 7, y2: 14 }, // 西铺下段（L 形）
  { zone: 'market', x1: 4, y1: 15, x2: 4, y2: 16 }, // 西铺南门 → 南巷
  { zone: 'market', x1: 10, y1: 9, x2: 12, y2: 9 }, // 西铺 → 广场短巷 y9
  { zone: 'market', x1: 8, y1: 13, x2: 12, y2: 13 }, // 西铺 → 广场短巷 y13
  { zone: 'eastShop', x1: 23, y1: 8, x2: 29, y2: 12 }, // 东铺上段
  { zone: 'eastShop', x1: 25, y1: 13, x2: 29, y2: 16 }, // 东铺下段（L 形）
  { zone: 'market', x1: 27, y1: 7, x2: 27, y2: 7 }, // 东铺北门 → 北巷
  { zone: 'market', x1: 19, y1: 9, x2: 22, y2: 9 }, // 广场 → 东铺短巷 y9
  { zone: 'market', x1: 19, y1: 15, x2: 24, y2: 15 }, // 广场 → 东铺短巷 y15
]

// 广场中心喷泉：实墙挡路，从两侧绕
const FOUNTAIN3 = [
  [15, 11],
  [16, 11],
  [15, 12],
  [16, 12],
  [15, 13],
  [16, 13],
]

// 店内半截货架：挡路但两端都能绕（西铺横在 y9，东铺横在 y10）
const SHELVES3 = [
  [4, 9],
  [5, 9],
  [6, 9],
  [7, 9],
  [25, 10],
  [26, 10],
  [27, 10],
]

export function buildGrid3() {
  const cols = 32
  const rows = 24
  const grid = Array.from({ length: rows }, () => Array(cols).fill('wall'))
  for (const r of RECTS3) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        grid[y][x] = r.zone
      }
    }
  }
  for (const [x, y] of FOUNTAIN3) grid[y][x] = 'wall'
  for (const [x, y] of SHELVES3) grid[y][x] = 'wall'
  return grid
}

// 侧室标签单独给锚点
export const SIDE_LABELS = [
  { x: 5, y: 12.5 },
  { x: 26, y: 11.5 },
]

export function buildGrid() {
  const cols = 32
  const rows = 24
  const grid = Array.from({ length: rows }, () => Array(cols).fill('wall'))
  for (const r of RECTS) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        grid[y][x] = r.zone
      }
    }
  }
  for (const [x, y] of HALF_WALLS) grid[y][x] = 'wall'
  return grid
}

// ===== 正篇第四单：潮汐蓄水厅（32×24 两岸经营图） =====
// 水道纵贯 x13..18（y2..19），北桥 y7、中桥 y13 各整段跨 x13..18；
// 南端 y20..22 是干堤，不架桥也能绕两岸。西岸/东岸各有一道矮墙隔出内外两条走线：
// 西矮墙 x8（y5..16，y11 留口），东矮墙 x23（y5..16，y13 留口），上下都能绕。
// 两把水尺各自缩在矮墙兜里：西尺 (5,15) 兜口 (7,13)/(7,17)，
// 东尺 (26,10) 兜口 (24,8)/(24,12)——各两格隔栅就能堵死一岸。
// 东岸南端 y19 留堤门 x28..29；西岸南端直接漫上干堤。出入口都在 (6,21)。
export const TIDE = {
  spawn: { x: 6, y: 21 },
  exit: { x: 6, y: 21 }, // 干堤入口：两把尺的读数带回这里才出评价
  gauges: {
    west: { x: 5, y: 15, name: '西岸水尺', short: '西岸' },
    east: { x: 26, y: 10, name: '东岸水尺', short: '东岸' },
  },
  spans: [
    { y: 7, x1: 13, x2: 18, name: '北桥' },
    { y: 13, x1: 13, x2: 18, name: '中桥' },
  ],
  bridgeSlots: new Set(
    [7, 13].flatMap((y) =>
      Array.from({ length: 6 }, (_, i) => 13 + i + ',' + y),
    ),
  ),
}

export function buildGrid4() {
  const cols = 32
  const rows = 24
  const grid = Array.from({ length: rows }, () => Array(cols).fill('wall'))
  const fill = (x1, y1, x2, y2, zone) => {
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) grid[y][x] = zone
    }
  }
  fill(1, 2, 12, 19, 'tideWest') // 西岸（南端直接接干堤）
  fill(19, 2, 30, 18, 'tideEast') // 东岸
  fill(1, 20, 30, 22, 'tideCross') // 南干堤
  fill(13, 2, 18, 19, 'water') // 水道
  for (const span of TIDE.spans) fill(span.x1, span.y, span.x2, span.y, 'bridgeSlot')
  fill(19, 19, 30, 19, 'wall') // 东岸南墙
  fill(28, 19, 29, 19, 'tideEast') // 堤门
  fill(8, 5, 8, 16, 'wall') // 西岸矮墙
  grid[11][8] = 'tideWest' // 西墙口
  fill(23, 5, 23, 16, 'wall') // 东岸矮墙
  grid[13][23] = 'tideEast' // 东墙口（对中桥）
  fill(1, 13, 6, 13, 'wall') // 西尺兜北沿
  fill(1, 17, 6, 17, 'wall') // 西尺兜南沿
  fill(25, 8, 30, 8, 'wall') // 东尺兜北沿
  fill(25, 12, 30, 12, 'wall') // 东尺兜南沿
  return grid
}

// ===== 正篇第五单：双锁档案库（32×24 双档经营图） =====
// 南厅 y19..21 横贯东西：入口 (15,20)，西出口 (4,20)、东出口 (27,20) 两个交档口。
// 西档 (5,7)、东档 (26,8) 各缩在北面档案区；y6 横廊串起两区。
// 红近门 (7,11)、黄近门 (25,11) 各接一条内侧通道（x5..8 / x24..27，y12..18），
// 压板在门下侧通道里（(7,13) / (25,13)），重块压对才开对应门。
// 东西外侧后路（x2 / x29 纵廊）不开门也能绕进两区——开门是近路，不开门仍可满分。
// 1/2 = 红/黄近门，* = 档案或出口，S = 入口；非 # 一律 library 木地板。
const ARCHIVE_ROWS = [
  '################################',
  '################################',
  '################################',
  '################################',
  '###........###########.......###',
  '##.........###########.......###',
  '##...........................###',
  '##...*.........###......##....##',
  '##.....###.###########....*...##',
  '##.........###########........##',
  '##.........###########........##',
  '##.####1#################2###.##',
  '##.##....###############....#.##',
  '##.##....###############....#.##',
  '##.##....###############....#.##',
  '##.##....###############....#.##',
  '##.##....###############....#.##',
  '##.##....###############....#.##',
  '##.##....###############....#.##',
  '##............................##',
  '##..*..........S...........*..##',
  '####.........................###',
  '################################',
  '################################',
]

export const ARCHIVE = {
  spawn: { x: 15, y: 20 },
  exits: {
    west: { x: 4, y: 20, name: '西出口', short: '西门' },
    east: { x: 27, y: 20, name: '东出口', short: '东门' },
  },
  archives: [
    { id: 'west', x: 5, y: 7, name: '西档案间', short: '西档' },
    { id: 'east', x: 26, y: 8, name: '东档案间', short: '东档' },
  ],
  doors: [
    {
      id: 'red',
      color: '红',
      x: 7,
      y: 11,
      plate: { x: 7, y: 13 },
      name: '红门',
      archive: 'west',
    },
    {
      id: 'yellow',
      color: '黄',
      x: 25,
      y: 11,
      plate: { x: 25, y: 13 },
      name: '黄门',
      archive: 'east',
    },
  ],
  plates: [
    { x: 7, y: 13, door: 'red' },
    { x: 25, y: 13, door: 'yellow' },
  ],
}

export function buildGrid5() {
  const cols = 32
  const rows = 24
  const grid = Array.from({ length: rows }, () => Array(cols).fill('wall'))
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (ARCHIVE_ROWS[y][x] !== '#') grid[y][x] = 'library'
    }
  }
  return grid
}

// ===== 正篇第六单：钟摆工坊（34×24 上下两工作区取件图） =====
// 入口兼交件点 (6,20)；上零件 (26,5)、下零件 (26,17) 各缩在东端工作区。
// 1/2 = 上/下检修板合法跨度，各跨 x16..18（y6 / y16）：铺好整段可走安全线，
// 没铺不能越过空隙。中段横廊（y9..10）与南段横廊（y19..20）是两条常规过道，
// 各有一对斜角钟摆封住咽喉；靠东的联络廊（x22..24，y8..14）让上下两区能换路。
const PENDULUM_ROWS = [
  '##################################',
  '##################################',
  '##################################',
  '#######################.......####',
  '#######################.......####',
  '########........###.......*...####',
  '########...##...111.......###.####',
  '######..........###...........####',
  '######........#########..#########',
  '######...................#########',
  '######...................#########',
  '######........########..##########',
  '######....############..##########',
  '######....############..##########',
  '######....############..##########',
  '######..........###...........####',
  '######..........222......###..####',
  '######..........###.......*...####',
  '###.......#...########........####',
  '###.......#...................####',
  '###...S...###............#########',
  '###.......########################',
  '##################################',
  '##################################',
]

export const PENDULUM = {
  spawn: { x: 6, y: 20 },
  exit: { x: 6, y: 20 }, // 入口兼交件点：两件零件带回这里才出评价
  parts: [
    { id: 'top', x: 26, y: 5, name: '上层零件', short: '上层' },
    { id: 'bottom', x: 26, y: 17, name: '下层零件', short: '下层' },
  ],
  spans: [
    { y: 6, x1: 16, x2: 18, name: '上检修板' },
    { y: 16, x1: 16, x2: 18, name: '下检修板' },
  ],
  plankSlots: new Set(
    [6, 16].flatMap((y) =>
      Array.from({ length: 3 }, (_, i) => 16 + i + ',' + y),
    ),
  ),
  pendulums: [
    { id: 'midA', x: 16, y: 9, phaseMs: 0, name: '中廊钟摆' },
    { id: 'midB', x: 17, y: 10, phaseMs: 0, name: '中廊钟摆' },
    { id: 'southA', x: 17, y: 19, phaseMs: 800, name: '南廊钟摆' },
    { id: 'southB', x: 18, y: 20, phaseMs: 800, name: '南廊钟摆' },
  ],
}

export function buildGrid6() {
  const cols = 34
  const rows = 24
  const grid = Array.from({ length: rows }, () => Array(cols).fill('wall'))
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ch = PENDULUM_ROWS[y][x]
      if (ch === '1' || ch === '2') grid[y][x] = 'plankSlot'
      else if (ch !== '#') grid[y][x] = 'workshop'
    }
  }
  return grid
}

// ===== 正篇第五图：苔火巡廊 =====
const MOSS_ROWS = [
  '########################',
  '########################',
  '########################',
  '###....................#',
  '###.######.#######...A.#',
  '###..B.###.#######.....#',
  '###........P...........#',
  '###.###.#......#.###.###',
  '###.....#......#.....###',
  '###.###.#...o..#.###.###',
  '###.###.#......#.###.###',
  '###.##............B..###',
  '###.##..#####.###....###',
  '#.......#####.######.###',
  '#....................###',
  '#.E...##################',
  '#.....##################',
  '########################',
]

function mossZone(x1, y1, x2, y2) {
  const out = new Set()
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) out.add(x + ',' + y)
  return out
}

const mossCenterThreat = new Set([
  ...mossZone(9, 6, 14, 6),
  ...mossZone(9, 7, 14, 10),
  ...mossZone(9, 11, 14, 11),
])
const mossNorthThreat = new Set([
  ...mossZone(6, 5, 8, 6),
  ...mossZone(9, 6, 14, 6),
  ...mossZone(9, 7, 14, 9),
])
const mossSouthThreat = new Set([
  ...mossZone(9, 9, 14, 10),
  ...mossZone(9, 11, 19, 11),
  ...mossZone(17, 12, 20, 12),
])

export const MOSS = {
  spawn: { x: 2, y: 15 },
  challengeStop: { x: 21, y: 4 },
  skeleton: { x: 22, y: 4 },
  stand: { x: 23, y: 4 },
  arena: { x: 19, y: 4.5 },
  sample: { x: 12, y: 9, name: '苔火样本' },
  patrolStart: { x: 11, y: 6 },
  bells: [
    { id: 'west', x: 5, y: 5, name: '西铃' },
    { id: 'east', x: 18, y: 11, name: '东铃' },
  ],
  loops: {
    center: [
      { x: 10, y: 7 },
      { x: 13, y: 7 },
      { x: 13, y: 10 },
      { x: 10, y: 10 },
    ],
    north: [
      { x: 6, y: 5 },
      { x: 8, y: 5 },
      { x: 8, y: 6 },
      { x: 6, y: 6 },
    ],
    south: [
      { x: 17, y: 11 },
      { x: 19, y: 11 },
      { x: 19, y: 12 },
      { x: 17, y: 12 },
    ],
  },
  threat: {
    center: mossCenterThreat,
    north: mossNorthThreat,
    south: mossSouthThreat,
  },
}

export function buildGrid7() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('wall'))
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (MOSS_ROWS[y][x] !== '#') grid[y][x] = 'moss'
    }
  }
  return grid
}

// 巡卫实际巡逻小圈周边：古铃换边时，危险区跟着同一组小圈移动
const MOSS_THREAT_CACHE = new Map()
export function mossThreatZone(side) {
  if (MOSS_THREAT_CACHE.has(side)) return MOSS_THREAT_CACHE.get(side)
  const loop = MOSS.loops[side]
  const grid = buildGrid7()
  const minX = Math.min(...loop.map((p) => p.x)) - 1
  const maxX = Math.max(...loop.map((p) => p.x)) + 1
  const minY = Math.min(...loop.map((p) => p.y)) - 1
  const maxY = Math.max(...loop.map((p) => p.y)) + 1
  const out = new Set()
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (grid[y] && grid[y][x] && grid[y][x] !== 'wall') out.add(x + ',' + y)
    }
  }
  MOSS_THREAT_CACHE.set(side, out)
  return out
}

// ===== 正篇第六图：夜场总店 =====
const NIGHT_ROWS = [
  '########################',
  '########################',
  '##......########......##',
  '##..A...########...a..##',
  '##......########......##',
  '##......########......##',
  '####................####',
  '####..#.#.####.#.#..####',
  '##....#.#......#.#....##',
  '##....#.#......#.#....##',
  '##....................##',
  '####..#.#......#.#..####',
  '####..#.#......#.#..####',
  '#......................#',
  '#.......########.......#',
  '#.E.....########.....e.#',
  '#.......########.......#',
  '########################',
]

export const NIGHT = {
  guests: [
    {
      id: 1,
      name: '西门寻宝客',
      title: '夜场西门 · 寻宝客',
      variant: 'nightWest',
      spawn: { x: 2, y: 15 },
      stop: { x: 4, y: 3 },
      skeleton: { x: 5, y: 3 },
      stand: { x: 8, y: 2 },
      arena: { x: 4.5, y: 4.3 },
      quote:
        '「我走西门，想拿<em class="kw">勇者徽章</em>。今晚只要让我开一只<em class="kw">宝箱</em>，这趟就算没白来。」',
    },
    {
      id: 2,
      name: '东门护卫客',
      title: '夜场东门 · 护卫客',
      variant: 'nightEast',
      spawn: { x: 21, y: 15 },
      stop: { x: 19, y: 3 },
      skeleton: { x: 18, y: 3 },
      stand: { x: 15, y: 2 },
      arena: { x: 18.5, y: 4.3 },
      quote:
        '「我走东门，也要<em class="kw">勇者徽章</em>。路上得给我留一面<em class="kw">盾</em>，守卫那锤我要挡下来。」',
    },
  ],
}

export function buildGrid8() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('wall'))
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (NIGHT_ROWS[y][x] !== '#') {
        grid[y][x] = x <= 8 ? 'nightWest' : x >= 16 ? 'nightEast' : 'nightHall'
      }
    }
  }
  return grid
}
