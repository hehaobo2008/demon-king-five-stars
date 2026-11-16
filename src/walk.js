// 客人行走计划：BFS 寻路 + 基于岔口/拾取/战斗规则生成动作脚本。
// 动作：move | bubble | open | pickupShield | skeleton | effect | stagger | log | badge | wait | end

import {
  JUNCTIONS,
  MAP2,
  ROOMS,
  SKELETON,
  buildGrid,
  buildGrid2,
} from './map.js'
import { tileKey, isFloor } from './game.js'
import { planRouteMarket } from './market-route.js'
import { planRouteTide } from './tide-route.js'
import { planRouteArchive } from './archive-route.js'

export const WALK = {
  STEP_MS: 170,
  SPAWN: { x: 3, y: 14 },
  CHALLENGE: { x: 18, y: 4 },
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// 面向某格的主朝向
const faceToward = (from, to) =>
  Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    ? to.x > from.x
      ? 'right'
      : 'left'
    : to.y > from.y
      ? 'down'
      : 'up'

export function bfsPath(grid, from, to) {
  if (from.x === to.x && from.y === to.y) return [from]
  const queue = [from]
  const parent = new Map([[tileKey(from.x, from.y), null]])
  while (queue.length) {
    const cur = queue.shift()
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      const k = tileKey(nx, ny)
      if (!isFloor(grid, nx, ny) || parent.has(k)) continue
      parent.set(k, cur)
      if (nx === to.x && ny === to.y) {
        const path = []
        let p = { x: nx, y: ny }
        while (p) {
          path.push(p)
          p = parent.get(tileKey(p.x, p.y))
        }
        return path.reverse()
      }
      queue.push({ x: nx, y: ny })
    }
  }
  return null
}

function inRoom(room, x, y) {
  return x >= room.x1 && x <= room.x2 && y >= room.y1 && y <= room.y2
}

// 房间内是否有未开宝箱（按 key 排序保证确定性）
function findUnopenedChest(game, room) {
  const hits = [...game.items.values()]
    .filter((it) => it.type === 'chest' && !it.opened && inRoom(room, it.x, it.y))
    .sort((a, b) => (tileKey(a.x, a.y) < tileKey(b.x, b.y) ? -1 : 1))
  return hits[0] || null
}

// 到宝箱旁边（相邻可站格里路径最短的），周围都不可站则退化为宝箱格
function pathToChest(grid, from, chest) {
  let best = null
  for (const [dx, dy] of DIRS) {
    const t = { x: chest.x + dx, y: chest.y + dy }
    if (!isFloor(grid, t.x, t.y)) continue
    const p = bfsPath(grid, from, t)
    if (p && (!best || p.length < best.length)) best = p
  }
  return best || bfsPath(grid, from, chest)
}

function signPointsToSide(game, junction) {
  const it = game.items.get(tileKey(junction.x, junction.y))
  return !!(it && it.type === 'sign' && it.dir === junction.dir)
}

export function planRoute(game, order = 1) {
  if (order === 2) return planRouteArmory(game)
  if (order === 3) return planRouteMarket(game)
  if (order === 4) return planRouteTide(game)
  if (order === 5) return planRouteArchive(game)
  const grid = buildGrid()
  const actions = []
  let cur = { ...WALK.SPAWN }
  let hasShield = false

  // 沿任意路径拆段：踩到未被拿走的盾牌架时停机 → 拿盾 + 台词（同一帧生效）
  // ignoreKeys：机关负责的格子（运行时拾取），计划期不拆段
  const walkPath = (path, ignoreKeys = null) => {
    let segStart = 0
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      const k = tileKey(t.x, t.y)
      const item = game.items.get(k)
      if (
        !hasShield &&
        !(ignoreKeys && ignoreKeys.has(k)) &&
        item &&
        item.type === 'shield' &&
        !item.taken
      ) {
        actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
        actions.push({
          type: 'pickupShield',
          x: t.x,
          y: t.y,
          say: '正好用得上！',
          hold: 1000,
        })
        hasShield = true
        segStart = i
      }
    }
    if (segStart < path.length - 1) {
      actions.push({ type: 'move', path: path.slice(segStart) })
    }
    cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }

  const addMove = (to) => {
    const path = bfsPath(grid, cur, to)
    if (!path) return false
    walkPath(path)
    return true
  }

  actions.push({
    type: 'bubble',
    text: '我是新手剑士，来拿勇者徽章。看见宝箱一定去看看！',
    wait: 1400,
  })

  // 出生格上的盾牌架也能拿（他开局就站在那格，不经过任何移动路径）
  const spawnItem = game.items.get(tileKey(WALK.SPAWN.x, WALK.SPAWN.y))
  if (spawnItem && spawnItem.type === 'shield' && !spawnItem.taken) {
    actions.push({
      type: 'pickupShield',
      x: WALK.SPAWN.x,
      y: WALK.SPAWN.y,
      say: '正好用得上！',
      hold: 1000,
    })
    hasShield = true
  }

  for (let ji = 0; ji < JUNCTIONS.length; ji++) {
    const j = JUNCTIONS[ji]
    if (!addMove({ x: j.x, y: j.y })) continue
    const chest = findUnopenedChest(game, ROOMS[j.room])

    if (chest) {
      actions.push({
        type: 'bubble',
        text: '侧室里有宝箱，我拐进去看看。',
        wait: 900,
      })
      const path = pathToChest(grid, cur, chest)
      if (path) {
        // 靠站路径同样走拾盾拆段（架子可能就摆在他要停下的那格）
        walkPath(path)
        // 开盖与台词同一拍
        actions.push({ type: 'open', x: chest.x, y: chest.y })
        actions.push({ type: 'bubble', text: '开了！战利品收下。', wait: 1150 })
        actions.push({ type: 'bubble', text: '回主路继续走。', wait: 500 })
        addMove({ x: j.x, y: j.y })
      }
    } else if (signPointsToSide(game, j)) {
      actions.push({
        type: 'bubble',
        text: '路牌指这边能走，去瞅一眼。',
        wait: 900,
      })
      addMove(j.lookAt)
      actions.push({ type: 'bubble', text: '嗯……什么都没有，回主路。', wait: 1100 })
      addMove({ x: j.x, y: j.y })
    } else {
      actions.push({ type: 'bubble', text: '这个岔口没宝箱，直接走。', wait: 350 })
    }
  }

  addMove(WALK.CHALLENGE)

  // ---- 挑战房：骷髅守卫训练战 ----
  const guestAt = { ...cur }
  actions.push({ type: 'face', dir: faceToward(guestAt, SKELETON) })
  actions.push({ type: 'bubble', text: '挑战房到了！守卫就在前面。', wait: 1100, arena: true })
  actions.push({ type: 'skeleton', pose: 'raise' })
  actions.push({ type: 'bubble', text: '它举起大锤了……', wait: 900, arena: true }) // 停顿一拍
  actions.push({ type: 'skeleton', pose: 'strike' })
  actions.push({ type: 'effect', kind: 'strike', at: guestAt, ms: 250 })

  if (hasShield) {
    actions.push({ type: 'effect', kind: 'block', at: guestAt, ms: 350 })
    actions.push({ type: 'log', event: 'block' })
    actions.push({ type: 'bubble', text: '有盾！挡住了。', wait: 800, arena: true })
    actions.push({ type: 'effect', kind: 'slash', at: { x: SKELETON.x, y: SKELETON.y }, ms: 300 })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '反击得手！', wait: 900, arena: true })
  } else {
    actions.push({ type: 'effect', kind: 'hit', at: guestAt, ms: 350 })
    actions.push({ type: 'stagger', ms: 420 })
    actions.push({ type: 'log', event: 'hit' })
    actions.push({ type: 'bubble', text: '哎哟……被砸中了！', wait: 900, arena: true, tone: 'hurt' })
    actions.push({ type: 'bubble', text: '稳住，反击！', wait: 300, arena: true })
    actions.push({ type: 'effect', kind: 'slash', at: { x: SKELETON.x, y: SKELETON.y }, ms: 300 })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 700, arena: true })
  }

  actions.push({ type: 'log', event: 'badge' })
  actions.push({ type: 'badge' })
  actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600, arena: true, tone: 'gold' })
  actions.push({ type: 'end' })

  return { start: WALK.SPAWN, actions }
}

// ===== 第二单：回形军械库 =====
// 岔口路牌朝上 → 补给廊（木廊、无弩线）；否则走近路（石廊 + 机械弩四秒窗口）。
// 两条路都在途中按「踩到就捡」拾盾，训练房打同一场。
function planRouteArmory(game) {
  const grid = buildGrid2()
  const actions = []
  const state = { cur: { ...MAP2.spawn }, hasShield: false }

  const walkPath = (path, ignoreKeys = null) => {
    let segStart = 0
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      const k = tileKey(t.x, t.y)
      const item = game.items.get(k)
      if (
        !state.hasShield &&
        !(ignoreKeys && ignoreKeys.has(k)) &&
        item &&
        item.type === 'shield' &&
        !item.taken
      ) {
        actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
        actions.push({
          type: 'pickupShield',
          x: t.x,
          y: t.y,
          say: '正好用得上！',
          hold: 1000,
        })
        state.hasShield = true
        segStart = i
      }
    }
    if (segStart < path.length - 1) {
      actions.push({ type: 'move', path: path.slice(segStart) })
    }
    state.cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }

  const addMove = (to, ignoreKeys = null) => {
    const path = bfsPath(grid, state.cur, to)
    if (!path) return false
    walkPath(path, ignoreKeys)
    return true
  }

  actions.push({
    type: 'bubble',
    text: '我是机关迷，想拿勇者徽章。先看看岔口的路牌。',
    wait: 1200,
  })

  // 岔前必经格 (6,14)：两条路都会经过，盾牌可以放这里
  addMove({ x: 6, y: 14 })
  addMove({ ...MAP2.junction })
  const sign = game.items.get(tileKey(MAP2.junction.x, MAP2.junction.y))
  const takeSupply = !!(sign && sign.type === 'sign' && sign.dir === MAP2.junction.dir)

  if (takeSupply) {
    actions.push({ type: 'bubble', text: '路牌朝上，我绕补给廊。', wait: 900 })
    // 先到左上转角，再沿上方补给廊进门；整段不经过弩线
    addMove({ x: 6, y: 4 })
    addMove({ ...MAP2.doors.supply })
    addMove({ ...MAP2.challenge })
    // 到达训练房后单独记「走补给廊」
    actions.push({ type: 'log', event: 'supply' })
    actions.push({ type: 'bubble', text: '补给廊绕过来了，稳稳当当。', wait: 700 })
  } else {
    actions.push({ type: 'bubble', text: '没有朝上的路牌，我走近路。', wait: 900 })
    // 亮线格与另一侧由机关运行时拾盾，计划期不拆段
    const trapIgnore = new Set([
      tileKey(MAP2.trapBeam.x, MAP2.trapBeam.y),
      tileKey(MAP2.trapFar.x, MAP2.trapFar.y),
    ])
    addMove({ ...MAP2.trapStop }, trapIgnore)
    const beamRack = game.items.get(tileKey(MAP2.trapBeam.x, MAP2.trapBeam.y))
    const farRack = game.items.get(tileKey(MAP2.trapFar.x, MAP2.trapFar.y))
    if (beamRack && beamRack.type === 'shield' && !beamRack.taken) state.hasShield = true
    if (farRack && farRack.type === 'shield' && !farRack.taken) state.hasShield = true
    actions.push({
      type: 'trap',
      guestAt: { ...MAP2.trapStop },
      stop: { ...MAP2.trapStop },
      beam: { ...MAP2.trapBeam },
      far: { ...MAP2.trapFar },
    })
    // 无论暂停还是中箭，运行时都会站到 (17,7)；续程从这一格逐格接着走
    state.cur = { ...MAP2.trapFar }
    addMove({ ...MAP2.challenge }, trapIgnore)
  }

  // ---- 训练房：骷髅守卫 ----
  const guestAt = { ...state.cur }
  const sk = MAP2.skeleton
  actions.push({ type: 'face', dir: faceToward(guestAt, sk) })
  actions.push({ type: 'bubble', text: '训练房到了，守卫就在前面。', wait: 1100, arena: true })
  actions.push({ type: 'skeleton', pose: 'raise' })
  actions.push({ type: 'bubble', text: '它举起大锤了……', wait: 900, arena: true })
  actions.push({ type: 'skeleton', pose: 'strike' })
  actions.push({ type: 'effect', kind: 'strike', at: guestAt, ms: 250 })

  if (state.hasShield) {
    actions.push({ type: 'effect', kind: 'block', at: guestAt, ms: 350 })
    actions.push({ type: 'log', event: 'block' })
    actions.push({ type: 'bubble', text: '有盾！挡住了。', wait: 800, arena: true })
    actions.push({ type: 'effect', kind: 'slash', at: { x: sk.x, y: sk.y }, ms: 300 })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '反击得手！', wait: 900, arena: true })
  } else {
    actions.push({ type: 'effect', kind: 'hit', at: guestAt, ms: 350 })
    actions.push({ type: 'stagger', ms: 420 })
    actions.push({ type: 'log', event: 'hit' })
    actions.push({ type: 'bubble', text: '哎哟……被砸中了！', wait: 900, arena: true, tone: 'hurt' })
    actions.push({ type: 'bubble', text: '稳住，反击！', wait: 300, arena: true })
    actions.push({ type: 'effect', kind: 'slash', at: { x: sk.x, y: sk.y }, ms: 300 })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 700, arena: true })
  }

  actions.push({ type: 'log', event: 'badge' })
  actions.push({ type: 'badge' })
  actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600, arena: true, tone: 'gold' })
  actions.push({ type: 'end' })

  return { start: MAP2.spawn, actions }
}