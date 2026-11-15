// 客人行走计划：BFS 寻路 + 基于岔口/拾取/战斗规则生成动作脚本。
// 动作：move | bubble | open | pickupShield | skeleton | effect | stagger | log | badge | wait | end

import { JUNCTIONS, ROOMS, SKELETON, buildGrid } from './map.js'
import { tileKey, isFloor } from './game.js'

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

export function planRoute(game) {
  const grid = buildGrid()
  const actions = []
  let cur = { ...WALK.SPAWN }
  let hasShield = false

  // 沿任意路径拆段：踩到未被拿走的盾牌架时停机 → 拿盾 + 台词（同一帧生效）
  const walkPath = (path) => {
    let segStart = 0
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      const item = game.items.get(tileKey(t.x, t.y))
      if (!hasShield && item && item.type === 'shield' && !item.taken) {
        actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
        actions.push({ type: 'pickupShield', x: t.x, y: t.y })
        actions.push({ type: 'bubble', text: '正好用得上！', wait: 1000 })
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
    actions.push({ type: 'pickupShield', x: WALK.SPAWN.x, y: WALK.SPAWN.y })
    actions.push({ type: 'bubble', text: '正好用得上！', wait: 1000 })
    hasShield = true
  }

  for (const j of JUNCTIONS) {
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
      actions.push({ type: 'bubble', text: '这个岔口没宝箱，直接走。', wait: 650 })
    }
  }

  addMove(WALK.CHALLENGE)

  // ---- 挑战房：骷髅守卫训练战 ----
  const guestAt = { ...cur }
  actions.push({ type: 'bubble', text: '挑战房到了！守卫就在前面。', wait: 1100 })
  actions.push({ type: 'skeleton', pose: 'raise' })
  actions.push({ type: 'bubble', text: '它举起大锤了……', wait: 900 }) // 停顿一拍
  actions.push({ type: 'skeleton', pose: 'strike' })
  actions.push({ type: 'effect', kind: 'strike', at: guestAt, ms: 250 })

  if (hasShield) {
    actions.push({ type: 'effect', kind: 'block', at: guestAt, ms: 350 })
    actions.push({ type: 'log', event: 'block' })
    actions.push({ type: 'bubble', text: '有盾！挡住了。', wait: 800 })
    actions.push({ type: 'effect', kind: 'slash', at: { x: SKELETON.x, y: SKELETON.y }, ms: 300 })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '反击得手！', wait: 900 })
  } else {
    actions.push({ type: 'effect', kind: 'hit', at: guestAt, ms: 350 })
    actions.push({ type: 'stagger', ms: 420 })
    actions.push({ type: 'log', event: 'hit' })
    actions.push({ type: 'bubble', text: '哎哟……被砸中了！', wait: 900 })
    actions.push({ type: 'bubble', text: '稳住，反击！', wait: 300 })
    actions.push({ type: 'effect', kind: 'slash', at: { x: SKELETON.x, y: SKELETON.y }, ms: 300 })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 700 })
  }

  actions.push({ type: 'log', event: 'badge' })
  actions.push({ type: 'badge' })
  actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600 })
  actions.push({ type: 'end' })

  return { start: WALK.SPAWN, actions }
}