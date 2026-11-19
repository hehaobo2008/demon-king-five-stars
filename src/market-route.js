// 正篇第三关：回声集市路线。
// 淘货客进西铺开一只箱取草料纪念品、进东铺开一只箱取陶器，谁先都有效；
// 开过一铺的一只就去找另一铺，每铺只取一件，站位必须在铺内（站门外开不算）。
// 另一铺没摆箱或走不到也先回去；不打锤、不拿徽章，守卫只是北厅陈设。
// 岔口路牌可强制走一段相邻路，隔栅占格挡路；路牌互指/绕圈有次数上限，
// 超限后回到目标导向，保证收束。结尾真的走回南厅 (16,21) 才出评价。
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

  // 回南厅的路必须通；隔栅封死出口时返回 null，开门留在布置
  if (!bfsWalkable(MARKET.spawn, MARKET.exit, canWalk)) return null

  const actions = []
  let cur = { ...MARKET.spawn }
  const opened = new Set()
  const collected = new Set() // 已取过货的铺面：每铺只开一只，不拿同铺两箱凑两件
  const chests = [...game.items.values()]
    .filter((it) => it.type === 'chest' && !it.opened && shopOf(it.x, it.y))
    .map((it) => ({ x: it.x, y: it.y, shop: shopOf(it.x, it.y), key: tileKey(it.x, it.y) }))

  // 淘货客不打锤，沿途不拾盾；走路就是纯走路
  const walkPath = (path) => {
    actions.push({ type: 'move', path })
    cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }

  // 站位必须也在同一间铺面里——站在门外开盖不算取货；
  // 铺内四邻都不可站则这只箱不排开箱
  const standPath = (chest) => {
    let best = null
    for (const [dx, dy] of DIRS) {
      const t = { x: chest.x + dx, y: chest.y + dy }
      if (!canWalk(t.x, t.y)) continue
      if (shopOf(t.x, t.y) !== chest.shop) continue
      const p = bfsWalkable(cur, t, canWalk)
      if (p && (!best || p.length < best.length)) best = p
    }
    return best
  }

  // 只找还没取过货的铺面里最近的箱；两铺都取齐 / 另一箱没摆或走不到 → null
  const nextChestPath = () => {
    const left = chests.filter((c) => !opened.has(c.key) && !collected.has(c.shop))
    let best = null
    let bestChest = null
    for (const c of left) {
      const p = standPath(c)
      if (p && (!best || p.length < best.length)) {
        best = p
        bestChest = c
      }
    }
    return bestChest ? { chest: bestChest, path: best } : null
  }

  const junctionSet = new Set(MARKET.junctions.map((j) => tileKey(j.x, j.y)))
  let signRedirects = 0
  let signsIgnored = false
  const signUses = new Map()

  // 从岔口沿箭头直走，直到下一处岔口、铺面、广场或北厅
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
      const z = zoneAt(x, y)
      if (z === 'westShop' || z === 'eastShop' || z === 'plaza' || z === 'challenge') break
      if (junctionSet.has(tileKey(x, y))) break
    }
    return seg
  }

  // adjacentChest：人站在铺内、箱在身旁且这铺还没取过货，才开
  const adjacentChest = () =>
    chests.find(
      (c) =>
        !opened.has(c.key) &&
        !collected.has(c.shop) &&
        shopOf(cur.x, cur.y) === c.shop &&
        Math.abs(c.x - cur.x) + Math.abs(c.y - cur.y) === 1,
    )

  const openChest = (c) => {
    actions.push({ type: 'open', x: c.x, y: c.y, shop: c.shop })
    opened.add(c.key)
    collected.add(c.shop)
    actions.push({
      type: 'bubble',
      text:
        c.shop === 'west'
          ? '西铺的草料纪念品，收进包里。'
          : '东铺的陶器，收进包里。',
      wait: 850,
    })
  }

  actions.push({
    type: 'bubble',
    text: '我是回声集市的淘货客，西铺的草料纪念品、东铺的陶器，各带一件回去。',
    wait: 1200,
  })

  let guard = 0
  while (guard++ < 110) {
    // 站到铺内箱子旁就开；每铺一件，开过就去找另一铺
    const near = adjacentChest()
    if (near) {
      openChest(near)
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

    // 目标：还没取货的铺面里最近的箱；没有就收程回南厅
    const chestTarget = nextChestPath()
    if (!chestTarget) break
    const path = chestTarget.path
    if (path.length <= 1) {
      openChest(chestTarget.chest)
      continue
    }
    walkPath([path[0], path[1]])
  }

  // 回程：真的走回南厅离场格 (16,21)，走到了才出评价
  const back = bfsWalkable(cur, MARKET.exit, canWalk)
  if (!back) return null
  const gotWest = collected.has('west')
  const gotEast = collected.has('east')
  if (gotWest && gotEast) {
    actions.push({ type: 'bubble', text: '两件都齐了，回南厅交差！', wait: 1000 })
  } else if (gotWest || gotEast) {
    const missingName = gotWest ? '东铺的陶器' : '西铺的草料纪念品'
    actions.push({ type: 'bubble', text: `${missingName}没寻着，先回南厅吧。`, wait: 1000 })
  } else {
    actions.push({ type: 'bubble', text: '两只宝箱都没寻着，空手回南厅吧。', wait: 1000 })
  }
  walkPath(back)
  actions.push({ type: 'log', event: 'return' })
  actions.push({ type: 'end' })

  return { start: MARKET.spawn, actions }
}