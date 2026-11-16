// 正篇第四图：钟摆工坊路线。
// 客人默认走向挑战房；经过钟摆格才插入预警，没经过的钟摆不响。
// 零件不自动追踪，只有路线真走到旁边才取。
import { PENDULUM, buildGrid6 } from './map.js'
import { tileKey, isFloor } from './game.js'
import { SIGN_DIRS, bfsWalkable, straightRun, faceToward } from './route-utils.js'

export function planRoutePendulum(game) {
  const grid = buildGrid6()
  const blocked = new Set((game.reserved || []).map((r) => tileKey(r.x, r.y)))
  for (const [k, item] of game.items) {
    if (item.type === 'barrier') blocked.add(k)
  }
  const canWalk = (x, y) => isFloor(grid, x, y) && !blocked.has(tileKey(x, y))
  if (!bfsWalkable(PENDULUM.spawn, PENDULUM.challengeStop, canWalk)) return null

  const actions = []
  let cur = { ...PENDULUM.spawn }
  let hasShield = false
  const takenParts = new Set()
  const pendulumByKey = new Map(
    PENDULUM.pendulums.map((p) => [tileKey(p.x, p.y), p]),
  )

  const walkPath = (path) => {
    let seg = [path[0]]
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      seg.push(t)
      const item = game.items.get(tileKey(t.x, t.y))
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
      // 长路牌/长段也按实际经过的每一格检查零件
      const part = PENDULUM.parts.find(
        (p) =>
          !takenParts.has(p.id) &&
          Math.abs(p.x - t.x) + Math.abs(p.y - t.y) <= 1,
      )
      if (part) {
        if (seg.length > 1) actions.push({ type: 'move', path: seg })
        takenParts.add(part.id)
        actions.push({ type: 'part', site: part.id, name: part.name, x: part.x, y: part.y })
        actions.push({ type: 'bubble', text: `${part.name}，收进工具袋。`, wait: 800 })
        seg = [{ x: t.x, y: t.y }]
      }
      const pend = pendulumByKey.get(tileKey(t.x, t.y))
      if (pend) {
        if (seg.length > 1) actions.push({ type: 'move', path: seg })
        actions.push({
          type: 'pendulum',
          id: pend.id,
          at: { x: pend.x, y: pend.y },
          name: pend.name,
        })
        seg = [{ x: t.x, y: t.y }]
      }
    }
    if (seg.length > 1) actions.push({ type: 'move', path: seg })
    cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }

  const adjacentPart = () =>
    PENDULUM.parts.find(
      (p) =>
        !takenParts.has(p.id) &&
        Math.abs(p.x - cur.x) + Math.abs(p.y - cur.y) <= 1,
    )

  let signsIgnored = false
  let signRedirects = 0
  const signUses = new Map()

  actions.push({
    type: 'bubble',
    text: '我是钟摆工坊的工匠，去挑战房拿徽章，顺路捡零件。',
    wait: 1200,
  })
  const spawnItem = game.items.get(tileKey(PENDULUM.spawn.x, PENDULUM.spawn.y))
  if (spawnItem && spawnItem.type === 'shield' && !spawnItem.taken) {
    actions.push({
      type: 'pickupShield',
      x: PENDULUM.spawn.x,
      y: PENDULUM.spawn.y,
      say: '正好用得上！',
      hold: 1000,
    })
    hasShield = true
  }

  let guard = 0
  while (guard++ < 150) {
    if (cur.x === PENDULUM.challengeStop.x && cur.y === PENDULUM.challengeStop.y) break

    const part = adjacentPart()
    if (part) {
      takenParts.add(part.id)
      actions.push({ type: 'part', site: part.id, name: part.name, x: part.x, y: part.y })
      actions.push({ type: 'bubble', text: `${part.name}，收进工具袋。`, wait: 800 })
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

    const path = bfsWalkable(cur, PENDULUM.challengeStop, canWalk)
    if (!path) return null
    if (path.length <= 1) break
    walkPath([path[0], path[1]])
  }

  if (cur.x !== PENDULUM.challengeStop.x || cur.y !== PENDULUM.challengeStop.y) {
    const path = bfsWalkable(cur, PENDULUM.challengeStop, canWalk)
    if (!path) return null
    walkPath(path)
  }

  const at = { ...cur }
  actions.push({ type: 'face', dir: faceToward(at, PENDULUM.skeleton) })
  actions.push({
    type: 'bubble',
    text: '工坊到头了，守卫就在挑战房。',
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
      at: { x: PENDULUM.skeleton.x, y: PENDULUM.skeleton.y },
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
      at: { x: PENDULUM.skeleton.x, y: PENDULUM.skeleton.y },
      ms: 300,
    })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 700, arena: true })
  }

  actions.push({ type: 'log', event: 'badge' })
  actions.push({ type: 'badge' })
  actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600, arena: true, tone: 'gold' })
  actions.push({ type: 'end' })

  return { start: PENDULUM.spawn, actions }
}