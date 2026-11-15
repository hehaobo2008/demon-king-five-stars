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
  { ...ROOMS.sideA, zone: 'side' }, // 侧室 A（左上）
  { zone: 'corridor', x1: 8, y1: 5, x2: 9, y2: 5 }, // 侧室 A → 主通道
  { ...ROOMS.sideB, zone: 'side' }, // 侧室 B（右中）
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