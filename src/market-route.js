// 正篇第三关：回声集市路线。
// 客人会主动找铺面里的宝箱，再去北侧挑战房；岔口路牌可强制走一段相邻路，
// 隔栅占格挡路。路牌互指/绕圈有次数上限，超限后回到目标导向，保证收束。
import { MARKET, buildGrid3 } from './map.js'
import { tileKey, isFloor } from './game.js'

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

const SIGN_DIRS = [
  [0, -1], // 0 上
  [1, 0], // 1 右
  [0, 1], // 2 下
  [-1, 0], // 3 左
]

const faceToward = (from, to) =>
  Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    ? to.x > from.x
      ? 'right'
      : 'left'
    : to.y > from.y
      ? 'down'
      : 'up'

function bfsWalkable(from, to, canWalk) {
  if (from.x === to.x && from.y === to.y) return [from]
  const queue = [from]
  const parent = new Map([[tileKey(from.x, from.y), null]])
  while (queue.length) {
    const cur = queue.shift()
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      const k = tileKey(nx, ny)
      if (!canWalk(nx, ny) || parent.has(k)) continue
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

export function planRouteMarket(game) {
  const grid = buildGrid3()
  const blocked = new Set((game.reserved || []).map((r) => tileKey(r.x, r.y)))
  for (const [k, item] of game.items) {
    if (item.type === 'barrier') blocked.add(k)
  }
  const canWalk = (x, y) => isFloor(grid, x, y) && !blocked.has(tileKey(x, y))
  const zoneAt = (x, y) => (grid[y] ? grid[y][x] : 'wall')
  const shopOf = (x, y) => {
    const z = zoneAt(x, y)
    return z === 'westShop' ? 'west' : z === 'eastShop' ? 'east' : null
  }

  // 挑战房必须可达；隔栅封死必经路时返回 null，开门留在布置
  if (!bfsWalkable(MARKET.spawn, MARKET.challengeStop, canWalk)) return null

  const actions = []
  let cur = { ...MARKET.spawn }
  let hasShield = false
  const opened = new Set()
  const chests = [...game.items.values()]
    .filter((it) => it.type === 'chest' && !it.opened && shopOf(it.x, it.y))
    .map((it) => ({ x: it.x, y: it.y, shop: shopOf(it.x, it.y), key: tileKey(it.x, it.y) }))

  const walkPath = (path) => {
    let segStart = 0
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      const item = game.items.get(tileKey(t.x, t.y))
      if (!hasShield && item && item.type === 'shield' && !item.taken) {
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

  const standPath = (chest) => {
    let best = null
    for (const [dx, dy] of DIRS) {
      const t = { x: chest.x + dx, y: chest.y + dy }
      if (!canWalk(t.x, t.y)) continue
      const p = bfsWalkable(cur, t, canWalk)
      if (p && (!best || p.length < best.length)) best = p
    }
    return best
  }

  const nextChestPath = () => {
    const here = shopOf(cur.x, cur.y)
    const left = chests.filter((c) => !opened.has(c.key))
    let pool = left
    if (here) {
      const local = left.filter((c) => c.shop === here)
      if (local.length) pool = local
    }
    let best = null
    let bestChest = null
    for (const c of pool) {
      const p = standPath(c)
      if (p && (!best || p.length < best.length)) {
        best = p
        bestChest = c
      }
    }
    if (!bestChest && pool !== left) {
      for (const c of left) {
        const p = standPath(c)
        if (p && (!best || p.length < best.length)) {
          best = p
          bestChest = c
        }
      }
    }
    return bestChest ? { chest: bestChest, path: best } : null
  }

  const junctionSet = new Set(MARKET.junctions.map((j) => tileKey(j.x, j.y)))
  let signRedirects = 0
  let signsIgnored = false
  const signUses = new Map()

  // 从岔口沿箭头直走，直到下一处岔口、铺面、广场或挑战房
  const signSegment = (from, dx, dy) => {
    const seg = [from]
    let x = from.x
    let y = from.y
    for (let i = 0; i < 14; i++) {
      const nx = x + dx
      const ny = y + dy
      if (!canWalk(nx, ny)) break
      x = nx
      y = ny
      seg.push({ x, y })
      if (x === MARKET.challengeStop.x && y === MARKET.challengeStop.y) break
      const z = zoneAt(x, y)
      if (z === 'westShop' || z === 'eastShop' || z === 'plaza' || z === 'challenge') break
      if (junctionSet.has(tileKey(x, y))) break
    }
    return seg
  }

  const adjacentChest = () =>
    chests.find(
      (c) =>
        !opened.has(c.key) &&
        Math.abs(c.x - cur.x) + Math.abs(c.y - cur.y) === 1,
    )

  actions.push({
    type: 'bubble',
    text: '我是回声集市的淘货客，来找宝箱和勇者徽章。',
    wait: 1200,
  })
  const spawnItem = game.items.get(tileKey(MARKET.spawn.x, MARKET.spawn.y))
  if (spawnItem && spawnItem.type === 'shield' && !spawnItem.taken) {
    actions.push({
      type: 'pickupShield',
      x: MARKET.spawn.x,
      y: MARKET.spawn.y,
      say: '正好用得上！',
      hold: 1000,
    })
    hasShield = true
  }

  let guard = 0
  while (guard++ < 110) {
    if (cur.x === MARKET.challengeStop.x && cur.y === MARKET.challengeStop.y) break

    // 站到箱子旁就开；开箱事件带铺面，评价按「另一处铺面」判五星
    const near = adjacentChest()
    if (near) {
      actions.push({ type: 'open', x: near.x, y: near.y, shop: near.shop })
      opened.add(near.key)
      actions.push({
        type: 'bubble',
        text: near.shop === 'west' ? '西铺这只箱子，我收了。' : '东铺这只箱子，我收了。',
        wait: 850,
      })
      continue
    }

    // 岔口路牌：只认罗盘岔口，箭头指向可走相邻路段才改道
    if (!signsIgnored && junctionSet.has(tileKey(cur.x, cur.y))) {
      const sign = game.items.get(tileKey(cur.x, cur.y))
      if (sign && sign.type === 'sign') {
        const useKey = tileKey(cur.x, cur.y) + ':' + sign.dir
        const uses = signUses.get(useKey) || 0
        if (uses < 2 && signRedirects < 8) {
          const [dx, dy] = SIGN_DIRS[sign.dir] || SIGN_DIRS[0]
          if (canWalk(cur.x + dx, cur.y + dy)) {
            const seg = signSegment(cur, dx, dy)
            if (seg.length > 1) {
              signUses.set(useKey, uses + 1)
              signRedirects++
              if (signRedirects >= 8) signsIgnored = true
              walkPath(seg)
              continue
            }
          }
        }
      }
    }

    // 目标：本铺面的箱子优先，否则最近的铺面箱子，最后挑战房
    const chestTarget = nextChestPath()
    let path
    if (chestTarget) {
      path = chestTarget.path
    } else {
      path = bfsWalkable(cur, MARKET.challengeStop, canWalk)
    }
    if (!path) break
    if (path.length <= 1) {
      if (chestTarget && !opened.has(chestTarget.chest.key)) {
        const c = chestTarget.chest
        actions.push({ type: 'open', x: c.x, y: c.y, shop: c.shop })
        opened.add(c.key)
        continue
      }
      break
    }
    walkPath([path[0], path[1]])
  }

  // 路牌绕圈或走太久：直接回到挑战房，保证整趟能结束
  if (cur.x !== MARKET.challengeStop.x || cur.y !== MARKET.challengeStop.y) {
    const path = bfsWalkable(cur, MARKET.challengeStop, canWalk)
    if (!path) return null
    walkPath(path)
  }

  const at = { ...cur }
  actions.push({ type: 'face', dir: faceToward(at, MARKET.skeleton) })
  actions.push({
    type: 'bubble',
    text: '挑战房到了！摊子逛完，该拿徽章了。',
    wait: 1100,
    arena: true,
  })
  actions.push({ type: 'skeleton', pose: 'raise' })
  actions.push({ type: 'bubble', text: '它举起大锤了……', wait: 900, arena: true })
  actions.push({ type: 'skeleton', pose: 'strike' })
  actions.push({ type: 'effect', kind: 'strike', at, ms: 250 })

  if (hasShield) {
    actions.push({ type: 'effect', kind: 'block', at, ms: 350 })
    actions.push({ type: 'log', event: 'block' })
    actions.push({ type: 'bubble', text: '有盾！挡住了。', wait: 800, arena: true })
    actions.push({
      type: 'effect',
      kind: 'slash',
      at: { x: MARKET.skeleton.x, y: MARKET.skeleton.y },
      ms: 300,
    })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '徽章归我了！', wait: 900, arena: true })
  } else {
    actions.push({ type: 'effect', kind: 'hit', at, ms: 350 })
    actions.push({ type: 'stagger', ms: 420 })
    actions.push({ type: 'log', event: 'hit' })
    actions.push({
      type: 'bubble',
      text: '哎哟……被砸中了！',
      wait: 900,
      arena: true,
      tone: 'hurt',
    })
    actions.push({ type: 'bubble', text: '稳住，反击！', wait: 300, arena: true })
    actions.push({
      type: 'effect',
      kind: 'slash',
      at: { x: MARKET.skeleton.x, y: MARKET.skeleton.y },
      ms: 300,
    })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 700, arena: true })
  }

  actions.push({ type: 'log', event: 'badge' })
  actions.push({ type: 'badge' })
  actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600, arena: true, tone: 'gold' })
  actions.push({ type: 'end' })

  return { start: MARKET.spawn, actions }
}