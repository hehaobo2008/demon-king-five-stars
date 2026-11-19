// 正篇第四单：潮汐蓄水厅路线（两岸经营图）。
// 潮汐工不打锤、不拿徽章：真走到西岸 (5,15)、东岸 (26,10) 两把水尺才各记一笔读数，
// 最后真走回干堤入口 (6,21) 才出评价。桥板让整段桥位可走，隔栅占格挡路；
// 一岸被隔栅堵死就先读另一岸、回入口交差，评价写明缺哪一岸。
// 路牌在可走格上沿箭头直走一段（互指/绕圈有次数上限，超限回到目标导向）。
import { TIDE, buildGrid4 } from './map.js'
import { tileKey, isFloor } from './game.js'
import { DIRS, SIGN_DIRS, bfsWalkable, straightRun } from './route-utils.js'

const GAUGE_BANKS = ['west', 'east']

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

  // 回干堤入口的路必须通；隔栅封死入口时返回 null，开门留在布置
  if (!bfsWalkable(TIDE.spawn, TIDE.exit, canWalk)) return null
  // 出入口同格：入口四邻全被堵死时客人寸步难行，同样拒开门
  const spawnFree = DIRS.some(([dx, dy]) =>
    canWalk(TIDE.spawn.x + dx, TIDE.spawn.y + dy),
  )
  if (!spawnFree) return null

  const actions = []
  let cur = { ...TIDE.spawn }
  const read = new Set() // 已登记读数的岸
  const skipped = new Set() // 这趟走不到的岸
  let bridgeLogged = false
  // 正在跨的桥：从哪端登桥。踏上桥面不算跨，从另一端上岸才记；
  // 半途回原岸就清掉，不记。状态跨 walkPath 调用保持（主循环一步一步走）。
  let bridgeWalk = null
  const spanAt = (y) => TIDE.spans.find((s) => s.y === y) || null
  const bankSide = (span, x) => (x < span.x1 ? 'west' : x > span.x2 ? 'east' : null)

  const gaugeAt = (x, y) =>
    GAUGE_BANKS.find((b) => {
      const g = TIDE.gauges[b]
      return g.x === x && g.y === y
    }) || null

  const logGauge = (bank) => {
    read.add(bank)
    const g = TIDE.gauges[bank]
    const left = GAUGE_BANKS.filter((b) => !read.has(b))
    actions.push({
      type: 'log',
      event: 'gauge',
      bank,
      label: `走到${g.name}记了读数`,
    })
    actions.push({
      type: 'bubble',
      text: left.length
        ? `${g.name}的水位记下了，还差${TIDE.gauges[left[0]].short}那一笔。`
        : `${g.name}的水位记下了，两岸读数齐了。`,
      wait: 850,
    })
  }

  // 走路就是纯走路；路过未读的水尺格就停下来登记，再把剩下的路走完。
  // 跨桥记录同理：真从一端登桥、从另一端上岸，才在上岸那一步后记一笔。
  const walkPath = (path) => {
    let segStart = 0
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      const prev = path[i - 1]
      const onBridge = zoneAt(t.x, t.y) === 'bridgeSlot'
      const wasOnBridge = zoneAt(prev.x, prev.y) === 'bridgeSlot'
      let crossedSpan = null
      if (onBridge && (!wasOnBridge || (bridgeWalk && bridgeWalk.span.y !== t.y))) {
        // 登桥：记下从哪端上来；端向不明就不记，宁可漏记不误记
        const span = spanAt(t.y)
        bridgeWalk = span ? { span, entrySide: bankSide(span, prev.x) } : null
      } else if (!onBridge && wasOnBridge) {
        // 上岸：只有落到登桥端的对岸才算跨过；回原岸不算
        if (bridgeWalk) {
          const exitSide = bankSide(bridgeWalk.span, t.x)
          if (
            exitSide &&
            bridgeWalk.entrySide &&
            exitSide !== bridgeWalk.entrySide &&
            !bridgeLogged
          ) {
            crossedSpan = bridgeWalk.span
            bridgeLogged = true
          }
        }
        bridgeWalk = null
      }
      const bank = gaugeAt(t.x, t.y)
      if (bank && !read.has(bank)) {
        actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
        logGauge(bank)
        segStart = i
      } else if (crossedSpan) {
        actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
        actions.push({
          type: 'log',
          event: 'bridge',
          at: { x: t.x, y: t.y },
          spanY: crossedSpan.y,
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
    text: '我是潮汐工，西岸、东岸两把水尺的读数都要带回干堤入口。',
    wait: 1200,
  })

  let guard = 0
  while (guard++ < 160) {
    // 脚下就是还没登记的水尺：先记读数
    const here = gaugeAt(cur.x, cur.y)
    if (here && !read.has(here)) {
      logGauge(here)
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

    // 目标：还没读过的岸里最近的一把尺；都读过或都走不到就收程
    let best = null
    for (const bank of GAUGE_BANKS) {
      if (read.has(bank) || skipped.has(bank)) continue
      const g = TIDE.gauges[bank]
      const path = bfsWalkable(cur, g, canWalk)
      if (!path) {
        skipped.add(bank)
        continue
      }
      if (!best || path.length < best.path.length) best = { bank, path }
    }
    if (!best) break
    if (best.path.length <= 1) {
      logGauge(best.bank)
      continue
    }
    walkPath([best.path[0], best.path[1]])
  }

  // 回程：真的走回干堤入口 (6,21)，走到了才出评价
  const back = bfsWalkable(cur, TIDE.exit, canWalk)
  if (!back) return null
  const missing = GAUGE_BANKS.filter((b) => !read.has(b))
  if (missing.length === 0) {
    actions.push({ type: 'bubble', text: '两岸读数都齐了，回干堤入口交差！', wait: 1000 })
  } else if (missing.length === 1) {
    actions.push({
      type: 'bubble',
      text: `${TIDE.gauges[missing[0]].name}走不到，缺${TIDE.gauges[missing[0]].short}那一笔，先回干堤入口吧。`,
      wait: 1000,
    })
  } else {
    actions.push({ type: 'bubble', text: '两岸水尺都走不到，空手回干堤入口吧。', wait: 1000 })
  }
  walkPath(back)
  actions.push({ type: 'log', event: 'return', label: '回到干堤入口' })
  actions.push({ type: 'end' })

  return { start: TIDE.spawn, actions }
}