// 道具摆放规则：纯逻辑，不碰 DOM。
// 三种道具共用 放置扣钱 / 移动免费 / 收回全额退款；路牌额外有朝向（dir：0上 1右 2下 3左）。

export const ITEMS = {
  chest: { name: '宝箱', price: 20 },
  shield: { name: '盾牌架', price: 30 },
  sign: { name: '路牌', price: 15 },
  barrier: { name: '隔栅', price: 15 },
  bridge: { name: '桥板', price: 25 },
  plank: { name: '检修板', price: 25 },
  weight: { name: '重块', price: 20 },
  bell: { name: '古铃', price: 15 },
}

export const START_GOLD = 100
export const DIR_NAMES = ['上', '右', '下', '左']

// 营业事件：只记录真实发生的
export const EVENT_LABELS = {
  chest: '打开宝箱',
  shield: '捡起盾牌',
  block: '挡住守卫一锤',
  hit: '挨了守卫一锤',
  retreat: '撤退回南厅',
  badge: '勇者徽章到手',
  safe: '平安通过机械弩',
  shot: '被弩箭射中',
  supply: '绕行补给廊',
  gauge: '走到水尺',
  bridge: '跨过桥板',
  archive: '取到档案',
  redDoor: '穿过红门',
  yellowDoor: '穿过黄门',
  part: '取到零件',
  moss: '取到苔火样本',
  patrol: '被巡卫撞见',
  return: '回到南厅入口',
  returnMiss: '交档走错出口',
  pendulumHit: '被钟摆打到',
  pendulumStop: '及时止摆',
  nightSwitch: '换场',
}

export const tileKey = (x, y) => x + ',' + y

export function createGame(grid, reserved = []) {
  return {
    grid,
    gold: START_GOLD,
    items: new Map(),
    log: [],
    reserved,
    badgeTaken: false,
    takenArchives: new Set(),
    takenParts: new Set(),
    takenMoss: false,
  }
}

export function addLog(game, kind, extra = null) {
  const entry = { kind, label: EVENT_LABELS[kind] || kind, t: Date.now() }
  if (extra) Object.assign(entry, extra)
  game.log.push(entry)
}

export function isFloor(grid, x, y) {
  return (
    y >= 0 &&
    y < grid.length &&
    x >= 0 &&
    x < grid[0].length &&
    grid[y][x] !== 'wall' &&
    grid[y][x] !== 'water'
  )
}

// 占位判定（与金币无关）：'ok' | 'wall' | 'occupied' | 'reserved'
// ignoreKey：移动时忽略道具自身原格
export function placeReason(game, x, y, ignoreKey = null) {
  if (!isFloor(game.grid, x, y)) return 'wall'
  if (game.reserved && game.reserved.some((r) => r.x === x && r.y === y)) return 'reserved'
  const k = tileKey(x, y)
  if (game.items.has(k) && k !== ignoreKey) return 'occupied'
  return 'ok'
}

// 从侧栏放置新道具：'ok' | 'wall' | 'occupied' | 'poor'
export function placeFromShop(game, type, x, y) {
  const def = ITEMS[type]
  if (!def) return 'bad'
  if (game.gold < def.price) return 'poor'
  const r = placeReason(game, x, y)
  if (r !== 'ok') return r
  game.gold -= def.price
  game.items.set(tileKey(x, y), { type, x, y, dir: 0, opened: false })
  return 'ok'
}

export function moveItem(game, from, to) {
  const fk = tileKey(from.x, from.y)
  const tk = tileKey(to.x, to.y)
  if (fk === tk) return 'ok'
  const r = placeReason(game, to.x, to.y, fk)
  if (r !== 'ok') return r
  const item = game.items.get(fk)
  game.items.delete(fk)
  item.x = to.x
  item.y = to.y
  game.items.set(tk, item) // 原对象移动，dir 自然保留
  return 'ok'
}

// 只有路牌可转向；返回新 dir，不可转返回 null
export function rotateItem(game, x, y) {
  const item = game.items.get(tileKey(x, y))
  if (!item || item.type !== 'sign') return null
  item.dir = (item.dir + 1) % 4
  return item.dir
}

// 收回并按该道具价格全额退款
export function retrieveItem(game, x, y) {
  const k = tileKey(x, y)
  const item = game.items.get(k)
  if (!item) return null
  game.items.delete(k)
  game.gold += ITEMS[item.type].price
  return item
}

// 客人开箱：宝箱记录 opened 状态（保留在原格，外观变化）
export function openChest(game, x, y) {
  const item = game.items.get(tileKey(x, y))
  if (!item || item.type !== 'chest' || item.opened) return false
  item.opened = true
  return true
}

// 重新布置：保留摆法，把开过的箱子恢复、被拿走的盾补回架子
export function restoreItems(game) {
  for (const item of game.items.values()) {
    if (item.type === 'chest') item.opened = false
    if (item.type === 'shield') item.taken = false
  }
}