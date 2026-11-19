// 正篇第五单：双锁档案库路线（32×24 双档经营图）。
// 抄书人不打锤、不拿徽章：真走到西档 (5,7)、东档 (26,8) 各登记一次（同一份只记一次），
// 两份抄齐后真走到选定的交档出口（默认东出口 (27,20)）才出评价。
// 重块压住红/黄压板才开对应近门抄近路；不开门走东西外侧后路仍可满分。
// 某份档案被隔栅封死就先取另一份、回选定出口交差，评价写明缺哪份。
// 路牌在可走格上沿箭头直走一段（互指/绕圈有次数上限，超限回到目标导向）。
import { ARCHIVE, buildGrid5 } from './map.js'
import { tileKey, isFloor } from './game.js'
import { DIRS, SIGN_DIRS, bfsWalkable, straightRun } from './route-utils.js'

// 交档结算判定（纯逻辑）：按客人当时脚下格核对本局选中的出口。
// 站对选定出口 → kind 'return'，site/坐标取自真实脚下格；
// 站错出口或没到出口 → kind 'returnMiss'，带上选的是哪侧、实际停在哪，
// 已取档案不动，评价据此写「预约未完成」，不解锁下一单。
export function archiveReturnLog(selectedSide, x, y) {
  const side = selectedSide === 'west' ? 'west' : 'east'
  const chosen = ARCHIVE.exits[side]
  const atSide =
    Object.keys(ARCHIVE.exits).find(
      (k) => ARCHIVE.exits[k].x === x && ARCHIVE.exits[k].y === y,
    ) || null
  if (atSide === side) {
    return {
      kind: 'return',
      extra: { site: side, x, y, label: `走到${chosen.name}交档` },
    }
  }
  const at = atSide ? ARCHIVE.exits[atSide] : null
  const atDesc = at ? `${at.name} (${at.x},${at.y})` : `非出口格 (${x},${y})`
  return {
    kind: 'returnMiss',
    extra: {
      selected: side,
      x,
      y,
      atSide,
      label: `本局选${chosen.name}交档，却停在${atDesc}，档案没交成`,
    },
  }
}

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

  const exitSide = game.archiveExit === 'west' ? 'west' : 'east'
  const exit = ARCHIVE.exits[exitSide]

  // 去选定交档出口的路必须通；隔栅封死出口时返回 null，开门留在布置
  if (!bfsWalkable(ARCHIVE.spawn, exit, canWalk)) return null
  // 入口四邻全被堵死时客人寸步难行，同样拒开门
  const spawnFree = DIRS.some(([dx, dy]) =>
    canWalk(ARCHIVE.spawn.x + dx, ARCHIVE.spawn.y + dy),
  )
  if (!spawnFree) return null

  const actions = []
  let cur = { ...ARCHIVE.spawn }
  const taken = new Set() // 已登记的档案 id
  const skipped = new Set() // 这趟走不到的档案 id
  const doorsLogged = new Set() // 每扇近门只记一次真穿越

  const archiveAt = (x, y) =>
    ARCHIVE.archives.find((a) => a.x === x && a.y === y) || null

  const logArchive = (a) => {
    taken.add(a.id)
    const left = ARCHIVE.archives.filter((x) => !taken.has(x.id))
    actions.push({ type: 'archive', site: a.id, name: a.name, x: a.x, y: a.y })
    actions.push({
      type: 'bubble',
      text: left.length
        ? `${a.name}的档案抄好了，还差${left[0].short}那一本。`
        : `${a.name}的档案抄好了，两份齐了。`,
      wait: 850,
    })
  }

  // 走路就是纯走路；踩上未登记的档案格就停下登记，再把剩下的路走完。
  // 真踩上开着的近门格记一笔穿门（每门一次），门开着不替代档案。
  const walkPath = (path) => {
    let segStart = 0
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      const a = archiveAt(t.x, t.y)
      const door = doorByKey.get(tileKey(t.x, t.y))
      if (a && !taken.has(a.id)) {
        actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
        logArchive(a)
        segStart = i
      } else if (door && doorOpen[door.id] && !doorsLogged.has(door.id)) {
        actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
        doorsLogged.add(door.id)
        actions.push({
          type: 'log',
          event: door.id === 'red' ? 'redDoor' : 'yellowDoor',
        })
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
    text: `我是抄书人，西档、东档都要抄一份，再送去${exit.name}交档。`,
    wait: 1200,
  })

  let guard = 0
  while (guard++ < 260) {
    // 脚下就是还没登记的档案：先抄
    const here = archiveAt(cur.x, cur.y)
    if (here && !taken.has(here.id)) {
      logArchive(here)
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

    // 目标：还没抄过的档案里最近的一份；都抄过或都走不到就收程
    let best = null
    for (const a of ARCHIVE.archives) {
      if (taken.has(a.id) || skipped.has(a.id)) continue
      const path = bfsWalkable(cur, a, canWalk)
      if (!path) {
        skipped.add(a.id)
        continue
      }
      if (!best || path.length < best.path.length) best = { a, path }
    }
    if (!best) break
    if (best.path.length <= 1) {
      logArchive(best.a)
      continue
    }
    walkPath([best.path[0], best.path[1]])
  }

  // 回程：真的走到选定交档出口，走到了才出评价
  const back = bfsWalkable(cur, exit, canWalk)
  if (!back) return null
  const missing = ARCHIVE.archives.filter((a) => !taken.has(a.id))
  if (missing.length === 0) {
    actions.push({
      type: 'bubble',
      text: `两份档案都抄齐了，去${exit.name}交档！`,
      wait: 1000,
    })
  } else if (missing.length === 1) {
    actions.push({
      type: 'bubble',
      text: `${missing[0].name}走不到，缺${missing[0].short}那一本，先去${exit.name}交差吧。`,
      wait: 1000,
    })
  } else {
    actions.push({
      type: 'bubble',
      text: `两份档案都走不到，空手去${exit.name}交差吧。`,
      wait: 1000,
    })
  }
  walkPath(back)
  // 交档文案不再预排：执行层按当时脚下格调用 archiveReturnLog 生成真实记录
  actions.push({ type: 'log', event: 'return', exitSide })
  actions.push({ type: 'end' })

  return { start: ARCHIVE.spawn, actions }
}