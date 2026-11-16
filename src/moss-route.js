// 正篇第五图：苔火巡廊路线。
// 巡卫按铃位决定守北/守南；只有路线真的进到对应巡逻区才记遭遇。
// 样本不自动追踪，只有路牌把人带到旁边才取。
import { MOSS, buildGrid7, mossThreatZone } from './map.js'
import { tileKey, isFloor } from './game.js'
import { SIGN_DIRS, bfsWalkable, straightRun, faceToward } from './route-utils.js'

export function planRouteMoss(game) {
  const grid = buildGrid7()
  const blocked = new Set((game.reserved || []).map((r) => tileKey(r.x, r.y)))
  for (const [k, item] of game.items) {
    if (item.type === 'barrier') blocked.add(k)
  }

  const bellWest = game.items.get(tileKey(MOSS.bells[0].x, MOSS.bells[0].y))
  const bellEast = game.items.get(tileKey(MOSS.bells[1].x, MOSS.bells[1].y))
  const west = !!(bellWest && bellWest.type === 'bell')
  const east = !!(bellEast && bellEast.type === 'bell')
  const patrolSide = west && !east ? 'north' : east && !west ? 'south' : 'center'
  const threat = mossThreatZone(patrolSide)
  const inner = new Set()
  for (let y = 6; y <= 11; y++) {
    for (let x = 8; x <= 15; x++) inner.add(x + ',' + y)
  }

  const canWalk = (x, y) => isFloor(grid, x, y) && !blocked.has(tileKey(x, y))
  if (!bfsWalkable(MOSS.spawn, MOSS.challengeStop, canWalk)) return null

  const actions = []
  let cur = { ...MOSS.spawn }
  let hasShield = false
  let mossTaken = false
  let patrolLogged = false
  let bellNote = false

  const walkPath = (path) => {
    let seg = [path[0]]
    let touchedInner = false
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      seg.push(t)
      const k = tileKey(t.x, t.y)
      if (inner.has(k)) touchedInner = true
      const item = game.items.get(k)
      if (!hasShield && item && item.type === 'shield' && !item.taken) {
        if (seg.length > 1) actions.push({ type: 'move', path: seg })
        actions.push({
          type: 'pickupShield',
          x: t.x,
          y: t.y,
          say: '正好用得上！',
          hold: 1000,
        })
        hasShield = true
        seg = [{ x: t.x, y: t.y }]
      }
      const sampleNear =
        !mossTaken &&
        Math.abs(MOSS.sample.x - t.x) + Math.abs(MOSS.sample.y - t.y) <= 1
      // 踏入第一块危险格才触发巡卫；长路牌也按格拆开
      if (threat.has(k) && !patrolLogged) {
        if (seg.length > 1) actions.push({ type: 'move', path: seg })
        actions.push({ type: 'patrol', at: { x: t.x, y: t.y }, side: patrolSide })
        patrolLogged = true
        seg = [{ x: t.x, y: t.y }]
        if (sampleNear) {
          mossTaken = true
          actions.push({ type: 'moss', x: MOSS.sample.x, y: MOSS.sample.y, name: MOSS.sample.name })
          actions.push({ type: 'bubble', text: '苔火样本到手了。', wait: 850 })
        }
      } else if (sampleNear) {
        if (seg.length > 1) actions.push({ type: 'move', path: seg })
        mossTaken = true
        actions.push({ type: 'moss', x: MOSS.sample.x, y: MOSS.sample.y, name: MOSS.sample.name })
        actions.push({ type: 'bubble', text: '苔火样本到手了。', wait: 850 })
        seg = [{ x: t.x, y: t.y }]
      }
    }
    if (seg.length > 1) actions.push({ type: 'move', path: seg })
    if (!patrolLogged && touchedInner && !bellNote && (west || east)) {
      bellNote = true
      actions.push({ type: 'bubble', text: '铃声把巡卫引到另一边了。', wait: 850 })
    }
    cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }

  const adjacentSample = () =>
    !mossTaken &&
    Math.abs(MOSS.sample.x - cur.x) + Math.abs(MOSS.sample.y - cur.y) === 1

  let signsIgnored = false
  let signRedirects = 0
  const signUses = new Map()

  actions.push({
    type: 'bubble',
    text: '我是采苔火的，先绕开巡卫，再看能不能取样本。',
    wait: 1200,
  })
  const spawnItem = game.items.get(tileKey(MOSS.spawn.x, MOSS.spawn.y))
  if (spawnItem && spawnItem.type === 'shield' && !spawnItem.taken) {
    actions.push({
      type: 'pickupShield',
      x: MOSS.spawn.x,
      y: MOSS.spawn.y,
      say: '正好用得上！',
      hold: 1000,
    })
    hasShield = true
  }

  let guard = 0
  while (guard++ < 160) {
    if (cur.x === MOSS.challengeStop.x && cur.y === MOSS.challengeStop.y) break

    if (adjacentSample()) {
      mossTaken = true
      actions.push({ type: 'moss', x: MOSS.sample.x, y: MOSS.sample.y, name: MOSS.sample.name })
      actions.push({ type: 'bubble', text: '苔火样本到手了。', wait: 850 })
      continue
    }

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

    const path = bfsWalkable(cur, MOSS.challengeStop, canWalk)
    if (!path) return null
    if (path.length <= 1) break
    walkPath([path[0], path[1]])
  }

  if (cur.x !== MOSS.challengeStop.x || cur.y !== MOSS.challengeStop.y) {
    const path = bfsWalkable(cur, MOSS.challengeStop, canWalk)
    if (!path) return null
    walkPath(path)
  }

  const at = { ...cur }
  actions.push({ type: 'face', dir: faceToward(at, MOSS.skeleton) })
  actions.push({
    type: 'bubble',
    text: '巡廊到头了，挑战房就在前面。',
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
      at: { x: MOSS.skeleton.x, y: MOSS.skeleton.y },
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
      at: { x: MOSS.skeleton.x, y: MOSS.skeleton.y },
      ms: 300,
    })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 700, arena: true })
  }

  actions.push({ type: 'log', event: 'badge' })
  actions.push({ type: 'badge' })
  actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600, arena: true, tone: 'gold' })
  actions.push({ type: 'end' })

  return { start: MOSS.spawn, actions }
}