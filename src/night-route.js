// 正篇第七图：夜场总店路线。
// 一晚两位客人：西门寻宝客先走，东门护卫客后走。
// 两位共用同一套场布；前一位开掉的箱、拿走的盾，后一位不会再遇到。
// 第二位的脚印按第一位实际用掉后的库存重算。
import { NIGHT, buildGrid8 } from './map.js'
import { tileKey, isFloor } from './game.js'
import { SIGN_DIRS, bfsWalkable, straightRun, faceToward } from './route-utils.js'

const NIGHT_NAMES = ['', '西门寻宝客', '东门护卫客']

const guestName = (n) => NIGHT_NAMES[n] || '客人'

function cloneNightGame(game) {
  const items = new Map()
  for (const [key, item] of game.items) items.set(key, { ...item })
  return { ...game, items, log: [] }
}

// 第一位走完后留下的库存：箱盖保持打开，盾架保持空着
function applyNightConsumption(game, plan) {
  if (!plan) return game
  for (const a of plan.actions) {
    if (a.type === 'open') {
      const item = game.items.get(tileKey(a.x, a.y))
      if (item && item.type === 'chest') item.opened = true
    } else if (a.type === 'pickupShield') {
      const item = game.items.get(tileKey(a.x, a.y))
      if (item && item.type === 'shield') item.taken = true
    }
  }
  return game
}

export function planNightGuest(game, guestIndex) {
  const guest = NIGHT.guests[guestIndex - 1]
  if (!guest) return null
  const name = guest.name
  const grid = buildGrid8()
  const blocked = new Set((game.reserved || []).map((r) => tileKey(r.x, r.y)))
  for (const [key, item] of game.items) {
    if (item.type === 'barrier') blocked.add(key)
  }
  const canWalk = (x, y) => isFloor(grid, x, y) && !blocked.has(tileKey(x, y))
  if (!bfsWalkable(guest.spawn, guest.stop, canWalk)) return null

  const actions = []
  let cur = { ...guest.spawn }
  let hasShield = false
  const openedChests = new Set()
  const takenShields = new Set()

  const chestAt = (x, y) =>
    [...game.items.values()].find(
      (it) =>
        it.type === 'chest' &&
        !it.opened &&
        !openedChests.has(tileKey(it.x, it.y)) &&
        Math.abs(it.x - x) + Math.abs(it.y - y) <= 1,
    ) || null

  const openAt = (chest) => {
    openedChests.add(tileKey(chest.x, chest.y))
    actions.push({
      type: 'open',
      x: chest.x,
      y: chest.y,
      guest: guestIndex,
      guestName: name,
      label: `${name}打开宝箱`,
    })
    actions.push({ type: 'bubble', text: '箱子里有货，收下！', wait: 850 })
  }

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
          hold: 900,
          guest: guestIndex,
          guestName: name,
          label: `${name}捡起盾牌`,
        })
        takenShields.add(tileKey(t.x, t.y))
        hasShield = true
        seg = [{ x: t.x, y: t.y }]
      }
      // 寻宝客只在路线真的贴近宝箱时开箱；护卫客不翻箱
      if (guestIndex === 1) {
        const chest = chestAt(t.x, t.y)
        if (chest) {
          if (seg.length > 1) actions.push({ type: 'move', path: seg })
          openAt(chest)
          seg = [{ x: t.x, y: t.y }]
        }
      }
    }
    if (seg.length > 1) actions.push({ type: 'move', path: seg })
    cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }

  actions.push({
    type: 'bubble',
    text:
      guestIndex === 1
        ? '我是西门来的寻宝客。路旁有箱子，我就开一只。'
        : '我是东门来的护卫客。路上留面盾，守卫那锤我得挡。',
    wait: 1100,
  })

  // 出生格上的盾牌架也能拿
  const spawnItem = game.items.get(tileKey(guest.spawn.x, guest.spawn.y))
  if (spawnItem && spawnItem.type === 'shield' && !spawnItem.taken) {
    actions.push({
      type: 'pickupShield',
      x: guest.spawn.x,
      y: guest.spawn.y,
      say: '正好用得上！',
      hold: 900,
      guest: guestIndex,
      guestName: name,
      label: `${name}捡起盾牌`,
    })
    takenShields.add(tileKey(guest.spawn.x, guest.spawn.y))
    hasShield = true
  }

  let signsIgnored = false
  let signRedirects = 0
  const signUses = new Map()

  let guard = 0
  while (guard++ < 400) {
    if (cur.x === guest.stop.x && cur.y === guest.stop.y) break

    if (guestIndex === 1) {
      const chest = chestAt(cur.x, cur.y)
      if (chest) {
        openAt(chest)
        continue
      }
    }

    if (!signsIgnored) {
      const sign = game.items.get(tileKey(cur.x, cur.y))
      if (sign && sign.type === 'sign') {
        const useKey = tileKey(cur.x, cur.y) + ':' + sign.dir
        const uses = signUses.get(useKey) || 0
        if (uses < 1 && signRedirects < 6) {
          const [dx, dy] = SIGN_DIRS[sign.dir] || SIGN_DIRS[0]
          if (canWalk(cur.x + dx, cur.y + dy)) {
            const seg = straightRun(cur, dx, dy, canWalk)
            if (seg.length > 1) {
              signUses.set(useKey, uses + 1)
              signRedirects++
              if (signRedirects >= 6) signsIgnored = true
              walkPath(seg)
              continue
            }
          }
        }
      }
    }

    const path = bfsWalkable(cur, guest.stop, canWalk)
    if (!path) return null
    if (path.length <= 1) break
    walkPath([path[0], path[1]])
  }

  if (cur.x !== guest.stop.x || cur.y !== guest.stop.y) {
    const path = bfsWalkable(cur, guest.stop, canWalk)
    if (!path) return null
    walkPath(path)
  }

  const at = { ...cur }
  actions.push({ type: 'face', dir: faceToward(at, guest.skeleton) })
  actions.push({
    type: 'bubble',
    text: guestIndex === 1 ? '西门挑战房到了，守卫就在前面。' : '东门挑战房到了，守卫就在前面。',
    wait: 1000,
    arena: true,
  })
  actions.push({ type: 'skeleton', pose: 'raise' })
  actions.push({ type: 'bubble', text: '它举起大锤了……', wait: 850, arena: true })
  actions.push({ type: 'skeleton', pose: 'strike' })
  actions.push({ type: 'effect', kind: 'strike', at, ms: 250 })

  if (hasShield) {
    actions.push({ type: 'effect', kind: 'block', at, ms: 350 })
    actions.push({
      type: 'log',
      event: 'block',
      guest: guestIndex,
      guestName: name,
      label: `${name}挡住守卫一锤`,
    })
    actions.push({ type: 'bubble', text: '有盾！挡住了。', wait: 750, arena: true })
    actions.push({
      type: 'effect',
      kind: 'slash',
      at: { x: guest.skeleton.x, y: guest.skeleton.y },
      ms: 300,
    })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '反击得手！', wait: 800, arena: true })
  } else {
    actions.push({ type: 'effect', kind: 'hit', at, ms: 350 })
    actions.push({ type: 'stagger', ms: 420 })
    actions.push({
      type: 'log',
      event: 'hit',
      guest: guestIndex,
      guestName: name,
      label: `${name}挨了守卫一锤`,
    })
    actions.push({
      type: 'bubble',
      text: '哎哟……没盾，硬挨了一锤！',
      wait: 850,
      arena: true,
      tone: 'hurt',
    })
    actions.push({ type: 'bubble', text: '稳住，反击！', wait: 300, arena: true })
    actions.push({
      type: 'effect',
      kind: 'slash',
      at: { x: guest.skeleton.x, y: guest.skeleton.y },
      ms: 300,
    })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 650, arena: true })
  }

  actions.push({
    type: 'log',
    event: 'badge',
    guest: guestIndex,
    guestName: name,
    label: `${name}拿到勇者徽章`,
  })
  actions.push({ type: 'badge', guest: guestIndex })
  actions.push({
    type: 'bubble',
    text: '勇者徽章到手！',
    wait: 1350,
    arena: true,
    tone: 'gold',
  })
  actions.push({ type: 'end' })

  return {
    start: guest.spawn,
    actions,
    guest: guestIndex,
    hasShield,
    openedChests: [...openedChests],
    takenShields: [...takenShields],
  }
}

// 布置期看单人脚印：看东门时，先把西门这一场真正会消耗的道具扣掉
export function planNightPreview(game, guestIndex = 1) {
  if (guestIndex === 2) {
    const first = planNightGuest(game, 1)
    const sim = cloneNightGame(game)
    if (first) applyNightConsumption(sim, first)
    const plan = planNightGuest(sim, 2)
    return { plan, game: sim, first, blocked: plan ? 0 : 2 }
  }
  const plan = planNightGuest(game, 1)
  return { plan, game, first: plan, blocked: plan ? 0 : 1 }
}

export function nightBlockedGuests(game) {
  const first = planNightGuest(game, 1)
  const sim = cloneNightGame(game)
  if (first) applyNightConsumption(sim, first)
  const second = planNightGuest(sim, 2)
  const blocked = []
  if (!first) blocked.push(1)
  if (!second) blocked.push(2)
  return blocked
}

// 营业整晚：西门一场 + 换场 + 东门一场；只有东门那场走到 end 才出总评价单
export function planNightFull(game) {
  const first = planNightGuest(game, 1)
  const sim = cloneNightGame(game)
  if (first) applyNightConsumption(sim, first)
  const second = planNightGuest(sim, 2)
  const blocked = []
  if (!first) blocked.push(1)
  if (!second) blocked.push(2)
  if (blocked.length) return { blockedGuests: blocked, first, second }
  const actions = []
  for (const a of first.actions) {
    if (a.type !== 'end') actions.push(a)
  }
  actions.push({ type: 'nightSwitch', guest: 2, ms: 1000 })
  for (const a of second.actions) actions.push(a)
  return {
    start: first.start,
    actions,
    blockedGuests: [],
    first,
    second,
  }
}

export function nightGuestName(index) {
  return guestName(index)
}