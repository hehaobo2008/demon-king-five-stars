// 占位地图数据：24 x 18 格，每格 8px，放大 4 倍渲染（768 x 576）
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
    label: { x: 4, y: 14.5 },
  },
  corridor: {
    name: '通道',
    colors: ['#333c57', '#566c86'],
    label: { x: 11, y: 8 },
  },
  side: {
    name: '侧室',
    colors: ['#257179', '#38b764'],
    label: null, // 两个侧室单独标注
  },
  challenge: {
    name: '挑战房',
    colors: ['#5d275d', '#b13e53'],
    label: { x: 18.5, y: 4.5 },
  },
}

// 房间/走廊矩形（含边界，单位：格）
export const ROOMS = {
  entrance: { x1: 1, y1: 12, x2: 6, y2: 16 },
  sideA: { x1: 1, y1: 3, x2: 7, y2: 7 },
  sideB: { x1: 14, y1: 9, x2: 20, y2: 13 },
  challenge: { x1: 14, y1: 2, x2: 22, y2: 6 },
}

const RECTS = [
  { ...ROOMS.entrance, zone: 'entrance' },
  { zone: 'corridor', x1: 10, y1: 3, x2: 11, y2: 15 },
  { zone: 'corridor', x1: 7, y1: 14, x2: 9, y2: 14 }, // 入口 → 主通道
  { ...ROOMS.sideA, zone: 'sideA' }, // 侧室 A（左上，青灰地砖）
  { zone: 'corridor', x1: 8, y1: 5, x2: 9, y2: 5 }, // 侧室 A → 主通道
  { ...ROOMS.sideB, zone: 'sideB' }, // 侧室 B（右中，深木）
  { zone: 'corridor', x1: 12, y1: 11, x2: 13, y2: 11 }, // 侧室 B → 主通道
  { ...ROOMS.challenge, zone: 'challenge' }, // 挑战房（右上）
  { zone: 'corridor', x1: 12, y1: 4, x2: 13, y2: 4 }, // 挑战房 → 主通道
]

// 客人路线经过的岔口：站在岔口格上、路牌箭头指向 dir 时，他会去看一眼
// dir：0上 1右 2下 3左；room 用于「侧室里有没有宝箱」判定
export const JUNCTIONS = [
  { x: 11, y: 11, dir: 1, room: 'sideB', lookAt: { x: 17, y: 11 } },
  { x: 10, y: 5, dir: 3, room: 'sideA', lookAt: { x: 4, y: 5 } },
]

// 挑战房固定骷髅守卫：占据 (19,4)，该格不可摆道具；客人停在 (18,4) 与它对峙
export const SKELETON = { x: 19, y: 4 }

// 通道机械弩：装在东墙 (12,9)，射线横扫通道第 9 行；客人停在射线前 (10,10)
export const CROSSBOW = { x: 12, y: 9 }
export const TRAP_STOP = { x: 10, y: 10 }

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

// ===== 正篇第三关：回声集市 =====
// 中央岛被一圈一宽的回廊围住；西铺/东铺各有两个门，南广场有三个入口，
// 北侧挑战房有东西两扇门。真实岔口由 MARKET.junctions 标记，路牌只在那里生效。
export const MARKET = {
  spawn: { x: 11, y: 16 },
  challengeStop: { x: 14, y: 2 },
  skeleton: { x: 15, y: 2 },
  arena: { x: 12.5, y: 3.1 },
  stand: { x: 17, y: 2 },
  shops: {
    west: { x1: 1, y1: 7, x2: 4, y2: 11, name: '西铺', label: '西铺 · 草料' },
    east: { x1: 19, y1: 7, x2: 22, y2: 11, name: '东铺', label: '东铺 · 陶器' },
  },
  junctions: [
    { x: 6, y: 7 }, // 西铺北门 / 西回廊
    { x: 6, y: 11 }, // 西铺南门 / 西回廊
    { x: 17, y: 7 }, // 东铺北门 / 东回廊
    { x: 17, y: 11 }, // 东铺南门 / 东回廊
    { x: 7, y: 12 }, // 南回廊西
    { x: 11, y: 12 }, // 南回廊中 / 主入口
    { x: 16, y: 12 }, // 南回廊东
    { x: 9, y: 6 }, // 挑战房西门
    { x: 10, y: 6 },
    { x: 15, y: 6 }, // 挑战房东门
    { x: 16, y: 6 },
  ],
  doors: {
    west: [
      { x: 5, y: 7 },
      { x: 5, y: 11 },
    ],
    east: [
      { x: 18, y: 7 },
      { x: 18, y: 11 },
    ],
    plaza: [
      { x: 7, y: 13 },
      { x: 11, y: 13 },
      { x: 16, y: 13 },
    ],
    challenge: [
      { x: 9, y: 5 },
      { x: 10, y: 5 },
      { x: 15, y: 5 },
      { x: 16, y: 5 },
    ],
  },
}

const RECTS3 = [
  { zone: 'plaza', x1: 4, y1: 14, x2: 19, y2: 16 },
  { zone: 'plaza', x1: 7, y1: 13, x2: 7, y2: 13 },
  { zone: 'plaza', x1: 11, y1: 13, x2: 11, y2: 13 },
  { zone: 'plaza', x1: 16, y1: 13, x2: 16, y2: 13 },
  { zone: 'market', x1: 6, y1: 6, x2: 17, y2: 6 },
  { zone: 'market', x1: 6, y1: 12, x2: 17, y2: 12 },
  { zone: 'market', x1: 6, y1: 6, x2: 6, y2: 12 },
  { zone: 'market', x1: 17, y1: 6, x2: 17, y2: 12 },
  { zone: 'challenge', x1: 9, y1: 1, x2: 16, y2: 4 },
  { zone: 'market', x1: 9, y1: 5, x2: 10, y2: 5 },
  { zone: 'market', x1: 15, y1: 5, x2: 16, y2: 5 },
  { zone: 'westShop', x1: 1, y1: 7, x2: 4, y2: 11 },
  { zone: 'westShop', x1: 5, y1: 7, x2: 5, y2: 7 },
  { zone: 'westShop', x1: 5, y1: 11, x2: 5, y2: 11 },
  { zone: 'eastShop', x1: 19, y1: 7, x2: 22, y2: 11 },
  { zone: 'eastShop', x1: 18, y1: 7, x2: 18, y2: 7 },
  { zone: 'eastShop', x1: 18, y1: 11, x2: 18, y2: 11 },
]

export function buildGrid3() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('wall'))
  for (const r of RECTS3) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        grid[y][x] = r.zone
      }
    }
  }
  return grid
}

// 侧室标签单独给锚点
export const SIDE_LABELS = [
  { x: 4.5, y: 5.5 },
  { x: 17.5, y: 11.5 },
]

export function buildGrid() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('wall'))
  for (const r of RECTS) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        grid[y][x] = r.zone
      }
    }
  }
  return grid
}
// ===== 正篇第二图：潮汐蓄水厅 =====
// 草图原样转成 24×18：~ 水，+ 整段可架桥位，M 水尺，E 入口，A 挑战。
const TIDE_ROWS = [
  '########################',
  '########################',
  '####.................###',
  '####.####~~~~~~~.###.###',
  '####.####~~~~~~~.....###',
  '##.......~~~~~~~.#.....#',
  '##...###.+++++++.#...A.#',
  '##...###.~~~~~~~.#.....#',
  '####.###.~~~~~~~.......#',
  '####.....~~~~~~~.###.###',
  '####.#.M.~~~~~~~.###.###',
  '####.#...+++++++.###.###',
  '####.....~~~~~~~.#.....#',
  '#....####~~~~~~~.......#',
  '#.E..####~~~~~~~.#.....#',
  '#....................###',
  '#....###################',
  '########################',
]

export const TIDE = {
  spawn: { x: 2, y: 14 },
  gauge: { x: 7, y: 10 },
  challengeStop: { x: 21, y: 6 },
  skeleton: { x: 22, y: 6 },
  stand: { x: 23, y: 6 },
  arena: { x: 19, y: 7 },
  spans: [
    { y: 6, x1: 9, x2: 15 },
    { y: 11, x1: 9, x2: 15 },
  ],
  bridgeSlots: new Set(
    TIDE_ROWS.flatMap((row, y) =>
      [...row].map((ch, x) => (ch === '+' ? x + ',' + y : null)).filter(Boolean),
    ),
  ),
}

export function buildGrid4() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('wall'))
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = TIDE_ROWS[y][x]
      if (ch === '#') continue
      if (ch === '~') {
        grid[y][x] = 'water'
        continue
      }
      if (ch === '+') {
        grid[y][x] = 'bridgeSlot'
        continue
      }
      grid[y][x] = x < 9 ? 'tideWest' : x > 15 ? 'tideEast' : 'tideCross'
    }
  }
  return grid
}

// ===== 正篇第三图：双锁档案库 =====
// R/Y 近门，r/y 对应压板，a 两份档案，E 入口，A 挑战。
const ARCHIVE_ROWS = [
  '########################',
  '########################',
  '##....................##',
  '##.#######.##########.##',
  '##.#######.#######.....#',
  '##.#######.#######...A.#',
  '##.###.................#',
  '##.###.##R###.###.###.##',
  '##..r...a..##.....###.##',
  '##.###.....##..a..###.##',
  '##.###.###.###Y##..y..##',
  '##.###............###.##',
  '##.########.#########.##',
  '##.########.#########.##',
  '#....######.#########.##',
  '#.....................##',
  '#.E..###################',
  '########################',
]

export const ARCHIVE = {
  spawn: { x: 2, y: 16 },
  challengeStop: { x: 21, y: 5 },
  skeleton: { x: 22, y: 5 },
  stand: { x: 23, y: 5 },
  arena: { x: 19, y: 5.5 },
  archives: [
    { id: 'west', x: 8, y: 8, name: '西档案间', short: '西档' },
    { id: 'east', x: 15, y: 9, name: '东档案间', short: '东档' },
  ],
  doors: [
    {
      id: 'red',
      color: '红',
      x: 9,
      y: 7,
      plate: { x: 4, y: 8 },
      name: '红门',
      archive: 'west',
    },
    {
      id: 'yellow',
      color: '黄',
      x: 14,
      y: 10,
      plate: { x: 19, y: 10 },
      name: '黄门',
      archive: 'east',
    },
  ],
  plates: [
    { x: 4, y: 8, door: 'red' },
    { x: 19, y: 10, door: 'yellow' },
  ],
}

export function buildGrid5() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('wall'))
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (ARCHIVE_ROWS[y][x] !== '#') grid[y][x] = 'library'
    }
  }
  // 草图校订：西室/东室两侧各补两格墙，让近门与后门分开
  for (const [x, y] of [
    [7, 8],
    [7, 9],
    [16, 8],
    [16, 9],
  ]) {
    grid[y][x] = 'wall'
  }
  return grid
}
