// 正篇第三图：双锁档案库路线。
// 重块压住红/黄压板才开对应门；客人会找两份档案，再前往挑战房。
// 门开着被实际穿过会记红门/黄门，评价据此判断「一份档案 + 近门」的五星线。
import { ARCHIVE, buildGrid5 } from './map.js'
import { tileKey, isFloor } from './game.js'
import { DIRS, SIGN_DIRS, bfsWalkable, straightRun, faceToward } from './route-utils.js'

export function planRouteArchive(game) {
  const grid = buildGrid5()
  const blocked = new Set((game.reserved || []).map((r) => tileKey(r.x, r.y)))
  for (const [k, item] of game.items) {
    if (item.type === 'barrier') blocked.add(k)
  }
  const doorByKey = new Map(ARCHIVE.doors.map((d) => [tileKey(d.x, d.y), d]))
  const doorOpen = {}
  for (const d of ARCHIVE.doors) {
    const item = game.items.get(tileKey(d.plate.x, d.plate.y))
    doorOpen[d.id] = !!(item && item.type === 'weight')
  }
  const canWalk = (x, y) => {
    if (!isFloor(grid, x, y)) return false
    const k = tileKey(x, y)
    if (blocked.has(k)) return false
    const door = doorByKey.get(k)
    if (door && !doorOpen[door.id]) return false
    return true
  }

  if (!bfsWalkable(ARCHIVE.spawn, ARCHIVE.challengeStop, canWalk)) return null

  const actions = []
  let cur = { ...ARCHIVE.spawn }
  let hasShield = false
  const taken = new Set()
  const doorsLogged = new Set()

  const archives = ARCHIVE.archives.map((a) => ({ ...a, key: tileKey(a.x, a.y) }))

  const standPath = (archive) => {
    let best = null
    for (const [dx, dy] of DIRS) {
      const t = { x: archive.x + dx, y: archive.y + dy }
      if (!canWalk(t.x, t.y)) continue
      const p = bfsWalkable(cur, t, canWalk)
      if (p && (!best || p.length < best.length)) best = p
    }
    return best
  }

  // 门开着时优先走对应的近门；路牌若已把人带到后门旁，
  // 顶部相邻判定会先取档案，不会强行折回。
  const doorPath = (archive) => {
    const door = ARCHIVE.doors.find((d) => d.archive === archive.id)
    if (!door || !doorOpen[door.id]) return null
    const gate = { x: door.x, y: door.y }
    // 去近门的途中避开档案四周，免得从后门旁边路过时先被自动取走
    const adj = new Set(
      DIRS.map(([dx, dy]) => tileKey(archive.x + dx, archive.y + dy)),
    )
    const approach = (x, y) => canWalk(x, y) && !adj.has(tileKey(x, y))
    const toDoor = bfsWalkable(cur, gate, approach)
    if (!toDoor) return null
    let best = null
    for (const [dx, dy] of DIRS) {
      const t = { x: archive.x + dx, y: archive.y + dy }
      if (!canWalk(t.x, t.y)) continue
      const rest = bfsWalkable(gate, t, canWalk)
      if (!rest) continue
      const joined = toDoor.concat(rest.slice(1))
      if (!best || joined.length < best.length) best = joined
    }
    return best
  }

  const nextArchivePath = () => {
    let best = null
    let target = null
    for (const a of archives) {
      if (taken.has(a.key)) continue
      const back = standPath(a)
      const viaDoor = doorPath(a)
      let p = back
      if (viaDoor && (!back || viaDoor.length <= back.length + 10)) p = viaDoor
      if (p && (!best || p.length < best.length)) {
        best = p
        target = a
      }
    }
    return target ? { archive: target, path: best } : null
  }

  const walkPath = (path) => {
    let segStart = 0
    const doorsHere = []
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      const door = doorByKey.get(tileKey(t.x, t.y))
      if (door && doorOpen[door.id] && !doorsLogged.has(door.id)) doorsHere.push(door)
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
    for (const d of doorsHere) {
      doorsLogged.add(d.id)
      actions.push({ type: 'log', event: d.id === 'red' ? 'redDoor' : 'yellowDoor' })
    }
    cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }

  let signsIgnored = false
  let signRedirects = 0
  const signUses = new Map()

  actions.push({
    type: 'bubble',
    text: '我是抄书人，想把两间档案都翻一翻。',
    wait: 1200,
  })
  const spawnItem = game.items.get(tileKey(ARCHIVE.spawn.x, ARCHIVE.spawn.y))
  if (spawnItem && spawnItem.type === 'shield' && !spawnItem.taken) {
    actions.push({
      type: 'pickupShield',
      x: ARCHIVE.spawn.x,
      y: ARCHIVE.spawn.y,
      say: '正好用得上！',
      hold: 1000,
    })
    hasShield = true
  }

  let guard = 0
  while (guard++ < 150) {
    if (cur.x === ARCHIVE.challengeStop.x && cur.y === ARCHIVE.challengeStop.y) break

    const near = archives.find(
      (a) =>
        !taken.has(a.key) &&
        Math.abs(a.x - cur.x) + Math.abs(a.y - cur.y) === 1,
    )
    if (near) {
      taken.add(near.key)
      actions.push({ type: 'archive', site: near.id, name: near.name, x: near.x, y: near.y })
      actions.push({ type: 'bubble', text: `${near.name}的档案，收下。`, wait: 850 })
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

    const target = nextArchivePath()
    let path
    if (target) path = target.path
    else path = bfsWalkable(cur, ARCHIVE.challengeStop, canWalk)
    if (!path) {
      if (target) {
        // 这一份暂时到不了，标记后继续找另一份或挑战房
        taken.add(target.archive.key)
        continue
      }
      return null
    }
    if (path.length <= 1) {
      if (target && !taken.has(target.archive.key)) {
        const a = target.archive
        taken.add(a.key)
        actions.push({ type: 'archive', site: a.id, name: a.name, x: a.x, y: a.y })
        continue
      }
      break
    }
    walkPath([path[0], path[1]])
  }

  if (cur.x !== ARCHIVE.challengeStop.x || cur.y !== ARCHIVE.challengeStop.y) {
    const path = bfsWalkable(cur, ARCHIVE.challengeStop, canWalk)
    if (!path) return null
    walkPath(path)
  }

  const at = { ...cur }
  actions.push({ type: 'face', dir: faceToward(at, ARCHIVE.skeleton) })
  actions.push({
    type: 'bubble',
    text: '档案看完了，最后去挑战房拿徽章。',
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
      at: { x: ARCHIVE.skeleton.x, y: ARCHIVE.skeleton.y },
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
      at: { x: ARCHIVE.skeleton.x, y: ARCHIVE.skeleton.y },
      ms: 300,
    })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 700, arena: true })
  }

  actions.push({ type: 'log', event: 'badge' })
  actions.push({ type: 'badge' })
  actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600, arena: true, tone: 'gold' })
  actions.push({ type: 'end' })

  return { start: ARCHIVE.spawn, actions }
}