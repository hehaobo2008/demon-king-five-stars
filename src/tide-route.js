// 正篇第二图：潮汐蓄水厅路线。
// 客人先走到水尺，再去挑战房；桥板让整段桥位可走，隔栅可封干路。
// 真实跨过一次桥会记 bridge，评价用来判断第五星。
import { TIDE, buildGrid4 } from './map.js'
import { tileKey, isFloor } from './game.js'
import { DIRS, SIGN_DIRS, bfsWalkable, straightRun, faceToward } from './route-utils.js'

export function planRouteTide(game) {
  const grid = buildGrid4()
  const blocked = new Set((game.reserved || []).map((r) => tileKey(r.x, r.y)))
  const bridgeSpans = new Set()
  for (const [k, item] of game.items) {
    if (item.type === 'bridge') bridgeSpans.add(item.y)
    if (item.type === 'barrier') blocked.add(k)
  }
  const zoneAt = (x, y) => (grid[y] ? grid[y][x] : 'wall')
  const canWalk = (x, y) => {
    const z = zoneAt(x, y)
    if (z === 'wall' || z === 'water') return false
    if (z === 'bridgeSlot') return bridgeSpans.has(y)
    return isFloor(grid, x, y) && !blocked.has(tileKey(x, y))
  }

  if (!bfsWalkable(TIDE.spawn, TIDE.challengeStop, canWalk)) return null

  const actions = []
  let cur = { ...TIDE.spawn }
  let hasShield = false
  let gaugeDone = false
  let gaugeSkipped = false
  let bridgeLogged = false

  const walkPath = (path) => {
    let segStart = 0
    let crossedBridge = false
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      if (zoneAt(t.x, t.y) === 'bridgeSlot') crossedBridge = true
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
    if (crossedBridge && !bridgeLogged) {
      bridgeLogged = true
      actions.push({ type: 'log', event: 'bridge' })
    }
  }

  let signsIgnored = false
  let signRedirects = 0
  const signUses = new Map()

  actions.push({
    type: 'bubble',
    text: '我是潮汐工，先去看水尺，再拿勇者徽章。',
    wait: 1200,
  })
  const spawnItem = game.items.get(tileKey(TIDE.spawn.x, TIDE.spawn.y))
  if (spawnItem && spawnItem.type === 'shield' && !spawnItem.taken) {
    actions.push({
      type: 'pickupShield',
      x: TIDE.spawn.x,
      y: TIDE.spawn.y,
      say: '正好用得上！',
      hold: 1000,
    })
    hasShield = true
  }

  // 水尺只在水路可走时作为先手目标；走不到就只奔挑战房
  if (!bfsWalkable(cur, TIDE.gauge, canWalk)) gaugeSkipped = true

  let guard = 0
  while (guard++ < 130) {
    if (cur.x === TIDE.challengeStop.x && cur.y === TIDE.challengeStop.y) break
    if (!gaugeDone && !gaugeSkipped && cur.x === TIDE.gauge.x && cur.y === TIDE.gauge.y) {
      gaugeDone = true
      actions.push({ type: 'log', event: 'gauge' })
      actions.push({ type: 'bubble', text: '水尺读数到顶了，得记一笔。', wait: 850 })
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

    const target = !gaugeDone && !gaugeSkipped ? TIDE.gauge : TIDE.challengeStop
    const path = bfsWalkable(cur, target, canWalk)
    if (!path) {
      if (target === TIDE.gauge) {
        gaugeSkipped = true
        continue
      }
      return null
    }
    if (path.length <= 1) {
      if (target === TIDE.gauge) {
        gaugeSkipped = true
        continue
      }
      break
    }
    walkPath([path[0], path[1]])
  }

  if (cur.x !== TIDE.challengeStop.x || cur.y !== TIDE.challengeStop.y) {
    const path = bfsWalkable(cur, TIDE.challengeStop, canWalk)
    if (!path) return null
    walkPath(path)
  }

  const at = { ...cur }
  actions.push({ type: 'face', dir: faceToward(at, TIDE.skeleton) })
  actions.push({
    type: 'bubble',
    text: '水尺看过了，挑战房就在前面。',
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
      at: { x: TIDE.skeleton.x, y: TIDE.skeleton.y },
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
      at: { x: TIDE.skeleton.x, y: TIDE.skeleton.y },
      ms: 300,
    })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 700, arena: true })
  }

  actions.push({ type: 'log', event: 'badge' })
  actions.push({ type: 'badge' })
  actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600, arena: true, tone: 'gold' })
  actions.push({ type: 'end' })

  return { start: TIDE.spawn, actions }
}