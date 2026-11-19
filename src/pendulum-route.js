// 正篇第六单：钟摆工坊路线（34×24 上下两工作区取件图）。
// 工匠不打锤、不拿徽章：真踩到上零件 (26,5)、下零件 (26,17) 才各登记一件，
// 两件都带在手上、真走回入口兼交件点 (6,20) 才出评价。
// 检修板铺好整段跨度才可走（安全线）；没铺不能越过空隙。
// 选路把可避开的钟摆风险算进去：先比踩钟摆格数、再比步数、同价再比拐弯数——
// 铺了板就走安全线，没板才硬穿中廊/南廊的钟摆咽喉。
// 路牌在可走格上沿箭头直走一段（互指/绕圈有次数上限，超限回到目标导向）。
import { PENDULUM, buildGrid6 } from './map.js'
import { tileKey, isFloor } from './game.js'
import { DIRS, SIGN_DIRS, bfsWalkable, straightRun } from './route-utils.js'

export const PENDULUM_MOTION = {
  stepMs: 10,
  halfSwingMs: 1600,
  stopMs: 1800,
  maxAngle: 1.1,
  length: 1.5,
  bobRadius: 0.25,
  guestRadius: 0.2,
}

export function pendulumPose(p, businessMs, stopAt = null) {
  const held = stopAt == null ? 0 : Math.min(PENDULUM_MOTION.stopMs, Math.max(0, businessMs - stopAt))
  const phase = (Math.max(0, businessMs) - held + p.phaseMs) / PENDULUM_MOTION.halfSwingMs
  const angle = Math.cos(phase * Math.PI) * PENDULUM_MOTION.maxAngle
  const pivot = { x: p.x, y: p.y - PENDULUM_MOTION.length }
  return {
    id: p.id,
    name: p.name,
    angle,
    // cos 的整数半周期恰是两端转向，中线经过时不换趟。
    sweep: Math.floor(phase),
    pivot,
    bob: {
      x: pivot.x + Math.sin(angle) * PENDULUM_MOTION.length,
      y: pivot.y + Math.cos(angle) * PENDULUM_MOTION.length,
    },
    stopped: stopAt != null && businessMs >= stopAt && businessMs < stopAt + PENDULUM_MOTION.stopMs,
  }
}

export function pendulumContacts(guest, poses, lastHits) {
  const hits = []
  const radius = PENDULUM_MOTION.bobRadius + PENDULUM_MOTION.guestRadius
  for (const pose of poses) {
    if (lastHits.get(pose.id) === pose.sweep) continue
    if (Math.hypot(guest.x - pose.bob.x, guest.y - pose.bob.y) > radius) continue
    lastHits.set(pose.id, pose.sweep)
    hits.push(pose)
  }
  return hits
}

const PART_IDS = ['top', 'bottom']
// 选路三级字典序：先比踩钟摆格数，再比步数，最后比拐弯数（客人爱走直路）。
// 权重全整数：每步 1000，每踩一只钟摆格 +1000000，每拐一次弯 +1。
// 34×24 图简单路径最多 815 步、814 次拐弯，故 拐弯<步数<钟摆 严格分层。
const STEP_W = 1000
const PENDULUM_COST = 1000000
const TURN_W = 1

// 风险加权最短路（带朝向状态的 Dijkstra，二叉堆）：
// 节点 = (格, 进入朝向)，用来数拐弯；起点无朝向，第一步不算拐弯。
function riskPath(from, to, canWalk, pendKeys) {
  if (from.x === to.x && from.y === to.y) return { path: [from], cost: 0 }
  const nodeKey = (x, y, d) => tileKey(x, y) + ':' + d
  const startKey = nodeKey(from.x, from.y, -1)
  const dist = new Map([[startKey, 0]])
  const parent = new Map([[startKey, null]])
  const heap = [[0, from.x, from.y, -1]]
  const heapPush = (node) => {
    heap.push(node)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p][0] <= heap[i][0]) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const heapPop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  while (heap.length) {
    const [d, x, y, dir] = heapPop()
    const k = nodeKey(x, y, dir)
    if (d > (dist.get(k) ?? Infinity)) continue
    if (x === to.x && y === to.y) {
      const path = []
      let cur = { x, y, dir }
      while (cur) {
        path.push({ x: cur.x, y: cur.y })
        cur = parent.get(nodeKey(cur.x, cur.y, cur.dir))
      }
      path.reverse()
      return { path, cost: d }
    }
    for (let nd = 0; nd < DIRS.length; nd++) {
      const [dx, dy] = DIRS[nd]
      const nx = x + dx
      const ny = y + dy
      if (!canWalk(nx, ny)) continue
      const nk = nodeKey(nx, ny, nd)
      const turn = dir !== -1 && dir !== nd ? TURN_W : 0
      const w =
        STEP_W + turn + (pendKeys.has(tileKey(nx, ny)) ? PENDULUM_COST : 0)
      const total = d + w
      if (total < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, total)
        parent.set(nk, { x, y, dir })
        heapPush([total, nx, ny, nd])
      }
    }
  }
  return null
}

export function planRoutePendulum(game) {
  const grid = buildGrid6()
  const blocked = new Set((game.reserved || []).map((r) => tileKey(r.x, r.y)))
  const plankSpans = new Set()
  for (const [k, item] of game.items) {
    if (item.type === 'plank') plankSpans.add(item.y)
    if (item.type === 'barrier') blocked.add(k)
  }
  const zoneAt = (x, y) => (grid[y] ? grid[y][x] : 'wall')
  const canWalk = (x, y) => {
    const z = zoneAt(x, y)
    if (z === 'wall') return false
    if (z === 'plankSlot') return plankSpans.has(y)
    return isFloor(grid, x, y) && !blocked.has(tileKey(x, y))
  }
  const pendKeys = new Set(
    PENDULUM.pendulums.map((p) => tileKey(p.x, p.y)),
  )
  const routeTo = (from, to) => riskPath(from, to, canWalk, pendKeys)

  // 回入口的路必须通；隔栅封死入口时返回 null，开门留在布置
  if (!bfsWalkable(PENDULUM.spawn, PENDULUM.exit, canWalk)) return null
  // 出入口同格：入口四邻全被堵死时客人寸步难行，同样拒开门
  const spawnFree = DIRS.some(([dx, dy]) =>
    canWalk(PENDULUM.spawn.x + dx, PENDULUM.spawn.y + dy),
  )
  if (!spawnFree) return null

  const actions = []
  let cur = { ...PENDULUM.spawn }
  const takenParts = new Set() // 真踩到取件点才登记的零件
  const skipped = new Set() // 这趟走不到的取件点

  const partAt = (x, y) =>
    PENDULUM.parts.find((p) => p.x === x && p.y === y) || null

  const logPart = (part) => {
    takenParts.add(part.id)
    actions.push({ type: 'part', site: part.id, name: part.name, x: part.x, y: part.y })
    const left = PART_IDS.filter((id) => !takenParts.has(id))
    actions.push({
      type: 'bubble',
      text: left.length
        ? `${part.name}收进工具袋，还差${PENDULUM.parts.find((p) => p.id === left[0]).short}那一件。`
        : `${part.name}收进工具袋，两件齐了。`,
      wait: 850,
    })
  }

  const walkPath = (path) => {
    let segStart = 0
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      const part = partAt(t.x, t.y)
      if (part && !takenParts.has(part.id)) {
        actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
        logPart(part)
        segStart = i
      }
    }
    if (segStart < path.length - 1) {
      actions.push({ type: 'move', path: path.slice(segStart) })
    }
    cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }

  let signsIgnored = false
  let signRedirects = 0
  const signUses = new Map()

  actions.push({
    type: 'bubble',
    text: '我是钟摆工坊的工匠，上层、下层两件零件都要带回入口。',
    wait: 1200,
  })

  let guard = 0
  while (guard++ < 160) {
    // 脚下就是还没登记的取件点：先取件
    const here = partAt(cur.x, cur.y)
    if (here && !takenParts.has(here.id)) {
      logPart(here)
      continue
    }

    // 路牌在可走岔口/路段上直接沿箭头走一段
    if (!signsIgnored) {
      const sign = game.items.get(tileKey(cur.x, cur.y))
      if (sign && sign.type === 'sign') {
        const useKey = tileKey(cur.x, cur.y) + ':' + sign.dir
        const uses = signUses.get(useKey) || 0
        if (uses < 2 && signRedirects < 8) {
          const [dx, dy] = SIGN_DIRS[sign.dir] || SIGN_DIRS[0]
          if (canWalk(cur.x + dx, cur.y + dy)) {
            const seg = straightRun(cur, dx, dy, canWalk)
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

    // 目标：还没取到的零件里风险代价最小的一处；都取过或都走不到就收程
    let best = null
    for (const id of PART_IDS) {
      if (takenParts.has(id) || skipped.has(id)) continue
      const part = PENDULUM.parts.find((p) => p.id === id)
      const r = routeTo(cur, part)
      if (!r) {
        skipped.add(id)
        continue
      }
      if (
        !best ||
        r.cost < best.cost ||
        (r.cost === best.cost && r.path.length < best.path.length)
      ) {
        best = { id, path: r.path, cost: r.cost }
      }
    }
    if (!best) break
    if (best.path.length <= 1) {
      logPart(PENDULUM.parts.find((p) => p.id === best.id))
      continue
    }
    walkPath([best.path[0], best.path[1]])
  }

  // 返程：真的走回入口兼交件点 (6,20)，走到了才出评价
  const back = routeTo(cur, PENDULUM.exit)
  if (!back) return null
  const missing = PART_IDS.filter((id) => !takenParts.has(id))
  if (missing.length === 0) {
    actions.push({ type: 'bubble', text: '两件零件都齐了，回入口交差！', wait: 1000 })
  } else if (missing.length === 1) {
    const p = PENDULUM.parts.find((pp) => pp.id === missing[0])
    actions.push({
      type: 'bubble',
      text: `${p.name}的取件点走不到，缺${p.short}那一件，先回入口吧。`,
      wait: 1000,
    })
  } else {
    actions.push({ type: 'bubble', text: '两处取件点都走不到，空手回入口吧。', wait: 1000 })
  }
  walkPath(back.path)
  actions.push({ type: 'log', event: 'return', label: '回到工坊入口' })
  actions.push({ type: 'end' })

  return { start: PENDULUM.spawn, actions }
}