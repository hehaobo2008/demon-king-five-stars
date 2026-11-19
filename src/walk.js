// 客人行走计划：BFS 寻路 + 基于岔口/拾取/战斗规则生成动作脚本。
// 动作：move | bubble | open | pickupShield | skeleton | effect | stagger | log | badge | wait | end
// 延迟标记：decide（到岔口读牌）| look（脚落地看箱子）| fight（挥锤时才按身上有没有盾解析）

import {
  MAP2,
  ROOMS,
  SKELETON,
  buildGrid,
  buildGrid2,
} from './map.js'
import { tileKey, isFloor } from './game.js'
import { planRouteMarket } from './market-route.js'
import { planRouteTide } from './tide-route.js'
import { planRouteArchive } from './archive-route.js'
import { planRoutePendulum } from './pendulum-route.js'
import { planRouteMoss } from './moss-route.js'
import { planNightFull } from './night-route.js'

export const WALK = {
  STEP_MS: 170,
  SPAWN: { x: 15, y: 21 },
  EXIT: { x: 16, y: 21 },
  CHALLENGE: { x: 16, y: 4 },
}

// 首单挑战房战斗数值：满血 100、每锤 35。
// 空手正面 100→65→30：硬直 + 真退一步再走回出剑位错过空档，30 < 35 吃不住下一锤 → 撤退。
// 挡锤消耗盾；守卫每次落锤后露空档（recoil），够得着（相邻格）才反击打倒取章。
export const FIGHT1 = { HP: 100, HAMMER: 35, REACH: 1 }

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// 面向某格的主朝向
const faceToward = (from, to) =>
  Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    ? to.x > from.x
      ? 'right'
      : 'left'
    : to.y > from.y
      ? 'down'
      : 'up'

export function bfsPath(grid, from, to) {
  if (from.x === to.x && from.y === to.y) return [from]
  const queue = [from]
  const parent = new Map([[tileKey(from.x, from.y), null]])
  while (queue.length) {
    const cur = queue.shift()
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      const k = tileKey(nx, ny)
      if (!isFloor(grid, nx, ny) || parent.has(k)) continue
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

// 宝箱落在哪间侧室（含房间边格/门内格）；主路/挑战厅等地返回 null
export function chestRoomAt(x, y) {
  const inRoom = (r) => x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2
  if (inRoom(ROOMS.sideA)) return 'sideA'
  if (inRoom(ROOMS.sideB)) return 'sideB'
  return null
}

// 到宝箱旁边（相邻可站格里路径最短的）。箱在侧室内时站位必须也在同一间房内——
// 站在门外开盖不算进侧室寻宝，他得走进门再开；房内四邻都不可站则不排开箱。
// 主路箱不限站位，周围都不可站则退化为宝箱格。
function pathToChest(grid, from, chest) {
  const room = chestRoomAt(chest.x, chest.y)
  let best = null
  for (const [dx, dy] of DIRS) {
    const t = { x: chest.x + dx, y: chest.y + dy }
    if (!isFloor(grid, t.x, t.y)) continue
    if (room && chestRoomAt(t.x, t.y) !== room) continue
    const p = bfsPath(grid, from, t)
    if (p && (!best || p.length < best.length)) best = p
  }
  if (room) return best
  return best || bfsPath(grid, from, chest)
}

// 沿路径拆段：踩到未被拿走的盾牌架时停机 → 拿盾 + 台词。纯函数，不改游戏状态；
// 计划期（makeWalker1）与运行时 look 插入共用同一套拆段规则。
export function segmentWalk(game, path, hasShield, ignoreKeys = null) {
  const actions = []
  let segStart = 0
  let shield = hasShield
  for (let i = 1; i < path.length; i++) {
    const t = path[i]
    const k = tileKey(t.x, t.y)
    const item = game.items.get(k)
    if (
      !shield &&
      !(ignoreKeys && ignoreKeys.has(k)) &&
      item &&
      item.type === 'shield' &&
      !item.taken
    ) {
      actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
      actions.push({
        type: 'pickupShield',
        x: t.x,
        y: t.y,
        say: '正好用得上！',
        hold: 1000,
      })
      shield = true
      segStart = i
    }
  }
  if (segStart < path.length - 1) {
    actions.push({ type: 'move', path: path.slice(segStart) })
  }
  return { actions, hasShield: shield }
}

// 首关行走状态机：walkPath 沿路径拆段拾盾，addMove 走 BFS 最短路。
// state.cur / state.hasShield 由计划期与运行时共用同一套推进规则。
function makeWalker1(game, grid, actions, state) {
  const walkPath = (path, ignoreKeys = null) => {
    const seg = segmentWalk(game, path, state.hasShield, ignoreKeys)
    actions.push(...seg.actions)
    state.hasShield = seg.hasShield
    state.cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }
  const addMove = (to) => {
    const path = bfsPath(grid, state.cur, to)
    if (!path) return false
    walkPath(path)
    return true
  }
  return { walkPath, addMove }
}

// 首关接近段：出生 → 第一个岔口 (15,12)。固定 BFS，与宝箱/路牌摆法无关，
// 只在踩到盾牌架时拆段拾盾；末尾放 decide 标记，续程等运行时走到岔口才生成。
export function planApproach1(game) {
  const grid = buildGrid()
  const actions = []
  const state = { cur: { ...WALK.SPAWN }, hasShield: false }
  const { addMove } = makeWalker1(game, grid, actions, state)

  actions.push({
    type: 'bubble',
    text: '我是新手剑士，来拿勇者徽章。看见宝箱一定去看看！',
    wait: 1400,
  })

  // 出生格上的盾牌架也能拿（他开局就站在那格，不经过任何移动路径）
  const spawnItem = game.items.get(tileKey(WALK.SPAWN.x, WALK.SPAWN.y))
  if (spawnItem && spawnItem.type === 'shield' && !spawnItem.taken) {
    actions.push({
      type: 'pickupShield',
      x: WALK.SPAWN.x,
      y: WALK.SPAWN.y,
      say: '正好用得上！',
      hold: 1000,
    })
    state.hasShield = true
  }

  addMove({ x: 15, y: 12 })
  actions.push({ type: 'decide', node: 'jL', at: { x: 15, y: 12 } })
  return { start: WALK.SPAWN, actions, state }
}

// 视线发现：只看清近处（SIGHT_RANGE 格内）且中间无墙的宝箱。
// openedSim 是本次续程模拟里已开过的箱子 key，避免重复排开箱动作
// （计划期不改 game.items 状态，真正的 opened 由运行时 open 动作落）。
const SIGHT_RANGE = 8

function losClear(grid, a, b) {
  let x0 = a.x
  let y0 = a.y
  const dx = Math.abs(b.x - x0)
  const dy = Math.abs(b.y - y0)
  const sx = x0 < b.x ? 1 : -1
  const sy = y0 < b.y ? 1 : -1
  let err = dx - dy
  while (!(x0 === b.x && y0 === b.y)) {
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
    if (x0 === b.x && y0 === b.y) break
    if (!isFloor(grid, x0, y0)) return false
  }
  return true
}

function visibleChestFrom(game, grid, from, openedSim) {
  let best = null
  for (const it of game.items.values()) {
    if (it.type !== 'chest' || it.opened) continue
    const k = tileKey(it.x, it.y)
    if (openedSim.has(k)) continue
    if (Math.hypot(it.x - from.x, it.y - from.y) > SIGHT_RANGE) continue
    if (!losClear(grid, from, it)) continue
    const p = pathToChest(grid, from, it)
    if (!p) continue
    if (!best || p.length < best.p.length || (p.length === best.p.length && k < best.k)) {
      best = { it, p, k }
    }
  }
  return best
}

// 脚落地再看：站在 at 格查眼前可见未开的箱子，看见才生成「走过去开 → 回本格」的动作段。
// 运行时（openedSim 传空集，it.opened 是真值）与脚印预展开（openedSim 累计）共用此规则，
// 保证玩家看见的路线跟实际走的一致。返回 null 表示这格没看见箱子。
export function lookInsert(game, grid, at, say, hasShield, openedSim) {
  const hit = visibleChestFrom(game, grid, at, openedSim)
  if (!hit) return null
  const seq = [{ type: 'bubble', text: say, wait: 900 }]
  const seg = segmentWalk(game, hit.p, hasShield)
  seq.push(...seg.actions)
  seq.push({ type: 'open', x: hit.it.x, y: hit.it.y })
  seq.push({ type: 'bubble', text: '开了！战利品收下。', wait: 1150 })
  openedSim.add(hit.k)
  const back = bfsPath(grid, hit.p[hit.p.length - 1], at)
  if (back) seq.push(...segmentWalk(game, back, seg.hasShield).actions)
  return { seq, hasShield: seg.hasShield }
}

// 脚印预展开：把骨架里的延迟标记按运行时同一套规则模拟成完整路线（计划期不改 game.items）。
// decide → 按节点调对应续程骨架接着展开；look → lookInsert 循环；fight → 按累计盾状态 + 血量解析。
// 盾状态一路累计（含开箱绕路拾盾、挡锤消耗），血量随 hp 动作推进，
// 与运行时 stepWalker 的真值推进一致。
export function expandLooks1(game, actions, state) {
  const grid = buildGrid()
  const out = []
  const openedSim = new Set()
  // 模拟里已拿走的盾（计划期不改 game.items）：续程/视线/战斗的拆段都读这份
  // 「已拿」视图——否则挡锤耗盾后，回程预览会把运行时已拿走的盾再捡一遍。
  const takenSim = new Set()
  const simView = () => {
    if (!takenSim.size) return game
    const items = new Map()
    for (const [k, it] of game.items) {
      items.set(k, takenSim.has(k) ? { ...it, taken: true } : it)
    }
    return { ...game, items }
  }
  let hasShield = state.hasShield
  let hp = state.hp == null ? FIGHT1.HP : state.hp
  // 模拟真实站位：move 走到哪就记到哪；fight 时与举锤锁定格（a.at）分开传，
  // 与运行时 stepWalker 传真实站位同一套判定（正常脚本里两者一致）。
  let cur = state.cur ? { ...state.cur } : null
  const queue = [...actions]
  let guard = 0
  while (queue.length && guard++ < 5000) {
    const a = queue.shift()
    if (a.type === 'decide') {
      const st = { cur: { ...a.at }, hasShield }
      const g = simView()
      const cont =
        a.node === 'jR'
          ? planFromJunctionR1(g, st)
          : a.node === 'back'
            ? planReturn1(g, st)
            : planFromJunctionL1(g, st)
      queue.unshift(...cont)
      continue
    }
    if (a.type === 'look') {
      for (;;) {
        const ins = lookInsert(simView(), grid, a.at, a.say, hasShield, openedSim)
        if (!ins) break
        for (const s of ins.seq) {
          out.push(s)
          if (s.type === 'pickupShield') {
            hasShield = true
            // 开箱顺路拾盾也记进同一份「已拿」视图：后续 look / 续程 / 回程拆段
            // 才不会把同一面盾再捡一遍（与主循环 pickupShield 同一套记账）
            takenSim.add(tileKey(s.x, s.y))
          }
        }
        hasShield = ins.hasShield
      }
      continue
    }
    if (a.type === 'fight') {
      // 挥锤结果里可能带回程巡廊的 look 骨架（守卫阵前路牌朝右）或撤退纯 move，入队接着展开
      const at = cur ? { ...cur } : { ...a.at }
      queue.unshift(...fightOutcome1(simView(), hasShield, a.at, at, hp))
      continue
    }
    if (a.type === 'pickupShield' && takenSim.has(tileKey(a.x, a.y))) {
      // 骨架预排的拾盾可能已被先执行的开箱绕路捡走：运行时对已拿走的盾静默跳过
      // （a.picked=false，不停顿不说台词不记日志），预演同样不产出这次拾取
      continue
    }
    out.push(a)
    if (a.type === 'move') cur = { ...a.path[a.path.length - 1] }
    else if (a.type === 'pickupShield') {
      hasShield = true
      takenSim.add(tileKey(a.x, a.y))
    } else if (a.type === 'consumeShield') hasShield = false
    else if (a.type === 'hp') hp = a.set
  }
  return out
}

// 首关续程骨架：站在南岔口 (15,12) 读脚下的路牌（运行时走到才调用）。
// 这里只排「走一格 + 落地看」的骨架，不预先算出沿途会开哪只箱——
// 真正的发现由运行时 look 动作在脚落地那一拍查视线后动态插入。
// 朝左(3)：进左室南口，沿南排→西端→北排逐格 look，从北口 (15,9) 回主路直上挑战厅，不原路折返；
// 朝上(0)：沿主路继续北；无牌 / 其他方向：门口 look 一次（近箱没牌也能开），再走到北岔口 (16,11) 放 decide jR。
export function planFromJunctionL1(game, state) {
  const grid = buildGrid()
  const actions = []
  const { walkPath, addMove } = makeWalker1(game, grid, actions, state)
  const j = { x: 15, y: 12 }

  const it = game.items.get(tileKey(j.x, j.y))
  const dir = it && it.type === 'sign' ? it.dir : null
  const leftOk = dir === 3 && isFloor(grid, 14, 12)
  const northOk = dir === 0
  // 无牌 / 无效方向：门口落地看一次，近箱没有牌也能开；有效牌则先跟牌走
  if (!leftOk && !northOk) {
    actions.push({ type: 'look', at: { ...j }, say: '门口就瞧见一只宝箱，过去开。' })
  }

  if (leftOk) {
    actions.push({ type: 'bubble', text: '路牌指左边侧室，进去瞅一眼。', wait: 900 })
    patrolRoom1(walkPath, actions, j, [
      { x: 14, y: 12 },
      { x: 13, y: 12 },
      { x: 12, y: 12 },
      { x: 11, y: 12 },
      { x: 10, y: 12 },
      { x: 9, y: 12 },
      { x: 8, y: 12 },
      { x: 7, y: 12 },
      { x: 6, y: 12 },
      { x: 5, y: 12 },
      { x: 4, y: 12 },
      { x: 3, y: 12 },
      { x: 2, y: 12 },
      { x: 2, y: 11 },
      { x: 2, y: 10 },
      { x: 2, y: 9 },
      { x: 3, y: 9 },
      { x: 4, y: 9 },
      { x: 5, y: 9 },
      { x: 6, y: 9 },
      { x: 7, y: 9 },
      { x: 8, y: 9 },
      { x: 9, y: 9 },
      { x: 10, y: 9 },
      { x: 11, y: 9 },
      { x: 12, y: 9 },
      { x: 13, y: 9 },
      { x: 14, y: 9 },
      { x: 15, y: 9 },
    ])
    actions.push({ type: 'bubble', text: '侧室巡完了，从北口回主路。', wait: 800 })
    addMove(WALK.CHALLENGE)
    appendChallenge1(actions, state)
    return actions
  }
  if (northOk) {
    actions.push({ type: 'bubble', text: '路牌指北边主路，走。', wait: 900 })
  } else {
    actions.push({ type: 'bubble', text: '沿主路继续走。', wait: 350 })
  }

  // 北岔口 (16,11)：走到才读牌，续程由运行时 decide jR 生成
  const j2 = { x: 16, y: 11 }
  if (addMove(j2)) {
    actions.push({ type: 'decide', node: 'jR', at: { ...j2 } })
  } else {
    addMove(WALK.CHALLENGE)
    appendChallenge1(actions, state)
  }
  return actions
}

// 北岔口 (16,11) 续程骨架：与南岔口同一套规则，运行时走到才调用。
// 朝右(1)：进右室南口，沿南排→东端→北排逐格 look，从北口 (16,8) 回主路直上挑战厅；
// 朝上(0) / 无牌 / 其他方向：门口 look 一次后直上挑战厅——看不见的箱子绝不拐进去。
export function planFromJunctionR1(game, state) {
  const grid = buildGrid()
  const actions = []
  const { walkPath, addMove } = makeWalker1(game, grid, actions, state)
  const j = { x: 16, y: 11 }

  const it = game.items.get(tileKey(j.x, j.y))
  const dir = it && it.type === 'sign' ? it.dir : null
  const rightOk = dir === 1 && isFloor(grid, 17, 11)
  const northOk = dir === 0
  if (!rightOk && !northOk) {
    actions.push({ type: 'look', at: { ...j }, say: '门口就瞧见一只宝箱，过去开。' })
  }

  if (rightOk) {
    actions.push({ type: 'bubble', text: '路牌指右边侧室，进去瞅一眼。', wait: 900 })
    patrolRoom1(walkPath, actions, j, [
      { x: 17, y: 11 },
      { x: 18, y: 11 },
      { x: 19, y: 11 },
      { x: 20, y: 11 },
      { x: 21, y: 11 },
      { x: 22, y: 11 },
      { x: 23, y: 11 },
      { x: 24, y: 11 },
      { x: 25, y: 11 },
      { x: 26, y: 11 },
      { x: 27, y: 11 },
      { x: 28, y: 11 },
      { x: 29, y: 11 },
      { x: 29, y: 10 },
      { x: 29, y: 9 },
      { x: 29, y: 8 },
      { x: 28, y: 8 },
      { x: 27, y: 8 },
      { x: 26, y: 8 },
      { x: 25, y: 8 },
      { x: 24, y: 8 },
      { x: 23, y: 8 },
      { x: 22, y: 8 },
      { x: 21, y: 8 },
      { x: 20, y: 8 },
      { x: 19, y: 8 },
      { x: 18, y: 8 },
      { x: 17, y: 8 },
      { x: 16, y: 8 },
    ])
    actions.push({ type: 'bubble', text: '侧室巡完了，从北口回主路。', wait: 800 })
  } else if (northOk) {
    actions.push({ type: 'bubble', text: '路牌指北边主路，走。', wait: 900 })
  } else {
    actions.push({ type: 'bubble', text: '沿主路继续走。', wait: 350 })
  }

  addMove(WALK.CHALLENGE)
  appendChallenge1(actions, state)
  return actions
}

// 侧室巡廊：每落一格 look 一次（拾盾拆段共用），看见箱子才过去开、回来接着巡
function patrolRoom1(walkPath, actions, from, waypoints) {
  let prev = from
  for (const t of waypoints) {
    walkPath([prev, t])
    actions.push({ type: 'look', at: { ...t }, say: '眼前有只宝箱，过去开。' })
    prev = t
  }
}

// 挥锤结果：举锤锁定要砸的格（lockedAt），落锤这一拍按「勇士真实站在哪（guestAt）+
// 此刻有没有盾 + 当前血量」解析。纯函数，运行时（stepWalker 的 fight 标记，传真实站位
// 与 guest.hp）与脚印预展开（expandLooks1，传模拟站位）共用，开箱绕路上顺手捡的盾也算数。
// 人已走出锁定格 → 这锤落空：不扣血、不耗盾、不发章；还能打（有盾或血量够再吃一锤）
// 就先真走回阵前再举锤，不原地落空循环；打不动了就从当时站位撤退。
// 有盾：挡住 → 盾碎（consumeShield）→ 守卫露空档（recoil）→ 够得着才反击打倒取章；
//       够不着则空档溜走，守卫再举锤（此时已无盾，下一锤必挨）。
// 无盾：挨锤扣 35 → 硬直 + 真退一格再走回出剑位（留出实际走位时间）错过空档 →
//       血量仍够再吃一锤就再举锤；血量 < 35 吃不住下一锤 → 撤退（planRetreat1 真走回南厅出口再评价）。
// 徽章只在守卫真被打倒（skeleton down）后发；回程不在这一拍定：
// 徽章台词说完放 decide back 标记，动身那一拍才读守卫阵前路牌（planReturn1）。
export function fightOutcome1(game, hasShield, lockedAt, guestAt, hp = FIGHT1.HP) {
  const actions = []
  const grid = buildGrid()
  const inReach =
    Math.abs(guestAt.x - SKELETON.x) + Math.abs(guestAt.y - SKELETON.y) <=
    FIGHT1.REACH
  const nextHammer = (lockAt) => {
    actions.push({ type: 'skeleton', pose: 'raise' })
    actions.push({ type: 'bubble', text: '它又举起大锤了……', wait: 900, arena: true })
    actions.push({ type: 'skeleton', pose: 'strike' })
    actions.push({ type: 'effect', kind: 'strike', at: { ...lockAt }, ms: 250 })
    actions.push({ type: 'fight', at: { ...lockAt } })
  }
  const retreatNow = (left) => {
    actions.push({ type: 'bubble', text: `只剩 ${left} 点血，吃不住下一锤了……撤退！`, wait: 1100, arena: true, tone: 'hurt' })
    actions.push({
      type: 'log',
      event: 'retreat',
      at: { ...guestAt },
      label: '血量不足，撤退回南厅',
      reason: `没盾挡锤，挨到血量 ${left}/${FIGHT1.HP}，判断吃不住下一锤（每锤 ${FIGHT1.HAMMER}），撤退回南厅出口`,
    })
    actions.push(...planRetreat1(game, { cur: { ...guestAt }, hasShield: false }))
  }
  // 锤砸在举锤锁定的那一格；落锤时人已不在那格 = 落空，什么都不结算
  const landed = guestAt.x === lockedAt.x && guestAt.y === lockedAt.y
  if (!landed) {
    actions.push({ type: 'bubble', text: '大锤砸在空处——我刚好不在那一格！', wait: 900, arena: true })
    actions.push({ type: 'skeleton', pose: 'idle' })
    if (hasShield || hp >= FIGHT1.HAMMER) {
      actions.push({ type: 'bubble', text: '趁它收锤，先走回阵前再打。', wait: 800, arena: true })
      const back = bfsPath(grid, guestAt, WALK.CHALLENGE)
      const front = back ? WALK.CHALLENGE : guestAt
      if (back && back.length > 1) {
        actions.push(...segmentWalk(game, back, hasShield).actions)
      }
      actions.push({ type: 'face', dir: faceToward(front, SKELETON) })
      nextHammer(front)
    } else {
      retreatNow(hp)
    }
    return actions
  }
  if (hasShield) {
    actions.push({ type: 'effect', kind: 'block', at: guestAt, ms: 350 })
    actions.push({ type: 'log', event: 'block' })
    actions.push({ type: 'consumeShield' })
    actions.push({ type: 'bubble', text: '用盾挡住了！盾碎了，它露出空档！', wait: 850, arena: true })
    actions.push({ type: 'skeleton', pose: 'recoil' })
    if (inReach) {
      actions.push({ type: 'effect', kind: 'slash', at: { x: SKELETON.x, y: SKELETON.y }, ms: 300 })
      actions.push({ type: 'skeleton', pose: 'down' })
      actions.push({ type: 'bubble', text: '反击得手，守卫倒下了！', wait: 900, arena: true })
      actions.push({ type: 'log', event: 'badge' })
      actions.push({ type: 'badge' })
      actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600, arena: true, tone: 'gold' })
      actions.push({ type: 'decide', node: 'back', at: { ...guestAt } })
    } else {
      actions.push({ type: 'bubble', text: '够不着……空档溜走了。', wait: 900, arena: true })
      actions.push({ type: 'skeleton', pose: 'idle' })
      nextHammer(guestAt)
    }
    return actions
  }
  const left = hp - FIGHT1.HAMMER
  actions.push({ type: 'effect', kind: 'hit', at: guestAt, ms: 350 })
  actions.push({ type: 'stagger', ms: 420 })
  actions.push({ type: 'hp', set: left })
  actions.push({ type: 'log', event: 'hit' })
  actions.push({ type: 'bubble', text: `哎哟……被砸中了！血量 ${left}/${FIGHT1.HP}`, wait: 950, arena: true, tone: 'hurt' })
  actions.push({ type: 'skeleton', pose: 'recoil' })
  if (left < FIGHT1.HAMMER) {
    retreatNow(left)
    return actions
  }
  // 还能打：硬直回过神真退一格（背向守卫），再走回出剑位——走位用真实 move，
  // 空档就在这段实际走位时间里合上；退无可退（身后不是地砖）才原地回神。
  const backTile = {
    x: guestAt.x + Math.sign(guestAt.x - SKELETON.x),
    y: guestAt.y + Math.sign(guestAt.y - SKELETON.y),
  }
  if (isFloor(grid, backTile.x, backTile.y)) {
    actions.push({ type: 'bubble', text: '硬直回过神，先退一步……', wait: 700, arena: true })
    actions.push(...segmentWalk(game, [guestAt, backTile, guestAt], false).actions)
    actions.push({ type: 'bubble', text: '走回出剑位，空档已经合上了。', wait: 850, arena: true })
  } else {
    actions.push({ type: 'bubble', text: '硬直回过神，走回出剑位……空档已经合上了。', wait: 950, arena: true })
  }
  actions.push({ type: 'skeleton', pose: 'idle' })
  nextHammer(guestAt)
  return actions
}

// 撤退续程：战斗已结束，退出寻宝——不排 look/decide、不读任何路牌
// （阵前朝右的牌也不能再把人送去冒险），沿途盾架也不捡（逃命不再收集）。
// 纯 move 真走回南厅离场格 (16,21)，end 落在走到之后——走到了才出评价。
export function planRetreat1(game, state) {
  const grid = buildGrid()
  const actions = []
  actions.push({ type: 'face', dir: faceToward(state.cur, WALK.EXIT) })
  const back = bfsPath(grid, state.cur, WALK.EXIT)
  if (back) actions.push({ type: 'move', path: back })
  actions.push({ type: 'end', retreat: true })
  return actions
}

// 回程续程骨架：徽章台词说完、真正动身那一拍才读守卫阵前 (16,4) 脚下的路牌
// （运行时 decide back 走到才调用，与去程岔口同一套规则）。
// 朝右(1)：挑战厅东门 → 右外廊 → 右室东北角，蛇形巡廊（北排→中排→南排）逐格 look，
// 从南口回主路再回离场格；开过的箱不重算（与去程同一套 lookInsert 规则）。
// 其他方向 / 无牌：沿地砖直接走回南厅离场格。
// 持盾状态沿用挥锤时的真值，路上未拿的盾照旧踩到就捡（与去程同一套拆段）；
// end 落在回到离场格 (16,21) 之后——真的走到了才出评价。
export function planReturn1(game, state) {
  const grid = buildGrid()
  const actions = []
  const { walkPath, addMove } = makeWalker1(game, grid, actions, state)
  const signIt = game.items.get(tileKey(state.cur.x, state.cur.y))
  if (signIt && signIt.type === 'sign' && signIt.dir === 1) {
    actions.push({ type: 'bubble', text: '先从右边回廊看看，再回入口。', wait: 1000 })
    // 经 (20,4) 到东门 (20,2)，避开守卫格 (16,3)；外廊北排 → 东列 → 右室东北角
    addMove({ x: 20, y: 4 })
    addMove({ x: 30, y: 2 })
    addMove({ x: 30, y: 7 })
    addMove({ x: 29, y: 7 })
    patrolRoom1(walkPath, actions, state.cur, [
      { x: 29, y: 8 },
      { x: 28, y: 8 },
      { x: 27, y: 8 },
      { x: 26, y: 8 },
      { x: 25, y: 8 },
      { x: 24, y: 8 },
      { x: 23, y: 8 },
      { x: 23, y: 9 },
      { x: 24, y: 9 },
      { x: 25, y: 9 },
      { x: 26, y: 9 },
      { x: 27, y: 9 },
      { x: 28, y: 9 },
      { x: 29, y: 9 },
      { x: 29, y: 10 },
      { x: 29, y: 11 },
      { x: 28, y: 11 },
      { x: 27, y: 11 },
      { x: 26, y: 11 },
      { x: 25, y: 11 },
      { x: 24, y: 11 },
      { x: 23, y: 11 },
      { x: 22, y: 11 },
      { x: 21, y: 11 },
      { x: 20, y: 11 },
      { x: 19, y: 11 },
      { x: 18, y: 11 },
      { x: 17, y: 11 },
    ])
    actions.push({ type: 'bubble', text: '右室寻完了，从南口回主路。', wait: 800 })
    addMove(WALK.EXIT)
    actions.push({ type: 'end' })
    return actions
  }
  actions.push({ type: 'bubble', text: '徽章到手，回入口咯。', wait: 1000 })
  const back = bfsPath(grid, state.cur, WALK.EXIT)
  if (back) actions.push(...segmentWalk(game, back, state.hasShield).actions)
  actions.push({ type: 'end' })
  return actions
}

// 首关挑战房战斗脚本：举锤前的铺垫固定（含开打前短提示：血量规则），
// 挡/挨留到挥锤那一拍按真实盾状态 + 站位 + 血量解析
function appendChallenge1(actions, state) {
  const guestAt = { ...state.cur }
  actions.push({ type: 'face', dir: faceToward(guestAt, SKELETON) })
  actions.push({ type: 'bubble', text: '挑战房到了！守卫就在前面。', wait: 1100, arena: true })
  actions.push({ type: 'bubble', text: `它一锤 ${FIGHT1.HAMMER} 点血，空手吃不住两锤；有盾挡住才能反击。`, wait: 1050, arena: true })
  actions.push({ type: 'skeleton', pose: 'raise' })
  actions.push({ type: 'bubble', text: '它举起大锤了……', wait: 900, arena: true })
  actions.push({ type: 'skeleton', pose: 'strike' })
  actions.push({ type: 'effect', kind: 'strike', at: guestAt, ms: 250 })
  actions.push({ type: 'fight', at: guestAt })
}

export function planRoute(game, order = 1) {
  if (order === 2) return planRouteArmory(game)
  if (order === 3) return planRouteMarket(game)
  if (order === 4) return planRouteTide(game)
  if (order === 5) return planRouteArchive(game)
  if (order === 6) return planRoutePendulum(game)
  if (order === 7) return planRouteMoss(game)
  if (order === 8) {
    const full = planNightFull(game)
    return full.blockedGuests.length ? null : { start: full.start, actions: full.actions }
  }
  // 首关：营业时只播接近段，两个岔口与徽章后回程的续程都由运行时 decide 生成骨架、
  // look 落地发现、fight 挥锤解析；这里用同一套规则把延迟标记全部预展开，
  // 供布置期脚印与提示使用，预览与实际行走一致。
  const approach = planApproach1(game)
  const actions = expandLooks1(game, approach.actions, approach.state)
  return { start: approach.start, actions }
}

// 首关布置期判定（纯函数，与运行时同一套预展开）：
// roomOpen=这趟会走进侧室开箱；pathOpen=只开主路箱；shieldBeforeFight=挥锤前能捡到盾。
// walked=全程踩到的格（含撤退走回南厅）；preFightWalked=挥锤前踩到的格（建议盾位只用去程）。
// retreated/badge/hpLeft/hits=按新战斗规则预演出的结果：空手两锤 30 血撤退，或有盾挡锤反击取章。
export function previewOutcome1(game) {
  const out = {
    roomOpen: false,
    pathOpen: false,
    shieldBeforeFight: false,
    retreated: false,
    badge: false,
    hpLeft: FIGHT1.HP,
    hits: 0,
    walked: new Set(),
    preFightWalked: new Set(),
  }
  const plan = planRoute(game, 1)
  if (!plan) return out
  let fought = false
  for (const a of plan.actions) {
    if (a.type === 'move') {
      for (const t of a.path) {
        const k = tileKey(t.x, t.y)
        out.walked.add(k)
        if (!fought) out.preFightWalked.add(k)
      }
    } else if (a.type === 'pickupShield') {
      if (!fought) out.shieldBeforeFight = true
    } else if (a.type === 'open') {
      if (chestRoomAt(a.x, a.y)) out.roomOpen = true
      else out.pathOpen = true
    } else if (a.type === 'effect' && (a.kind === 'block' || a.kind === 'hit')) {
      fought = true
    } else if (a.type === 'hp') {
      out.hpLeft = a.set
    } else if (a.type === 'badge') {
      out.badge = true
    } else if (a.type === 'log' && a.event === 'hit') {
      out.hits += 1
    } else if (a.type === 'log' && a.event === 'retreat') {
      out.retreated = true
    }
  }
  return out
}

// ===== 第二单：回形军械库 =====
// 岔口路牌朝上 → 补给廊（木廊、无弩线）；否则走近路（石廊 + 机械弩四秒窗口）。
// 两条路都在途中按「踩到就捡」拾盾，训练房打同一场。
function planRouteArmory(game) {
  const grid = buildGrid2()
  const actions = []
  const state = { cur: { ...MAP2.spawn }, hasShield: false }

  const walkPath = (path, ignoreKeys = null) => {
    let segStart = 0
    for (let i = 1; i < path.length; i++) {
      const t = path[i]
      const k = tileKey(t.x, t.y)
      const item = game.items.get(k)
      if (
        !state.hasShield &&
        !(ignoreKeys && ignoreKeys.has(k)) &&
        item &&
        item.type === 'shield' &&
        !item.taken
      ) {
        actions.push({ type: 'move', path: path.slice(segStart, i + 1) })
        actions.push({
          type: 'pickupShield',
          x: t.x,
          y: t.y,
          say: '正好用得上！',
          hold: 1000,
        })
        state.hasShield = true
        segStart = i
      }
    }
    if (segStart < path.length - 1) {
      actions.push({ type: 'move', path: path.slice(segStart) })
    }
    state.cur = { x: path[path.length - 1].x, y: path[path.length - 1].y }
  }

  const addMove = (to, ignoreKeys = null) => {
    const path = bfsPath(grid, state.cur, to)
    if (!path) return false
    walkPath(path, ignoreKeys)
    return true
  }

  actions.push({
    type: 'bubble',
    text: '我是机关迷，想拿勇者徽章。先看看岔口的路牌。',
    wait: 1200,
  })

  // 岔前必经格 (6,14)：两条路都会经过，盾牌可以放这里
  addMove({ x: 6, y: 14 })
  addMove({ ...MAP2.junction })
  const sign = game.items.get(tileKey(MAP2.junction.x, MAP2.junction.y))
  const takeSupply = !!(sign && sign.type === 'sign' && sign.dir === MAP2.junction.dir)

  if (takeSupply) {
    actions.push({ type: 'bubble', text: '路牌朝上，我绕补给廊。', wait: 900 })
    // 先到左上转角，再沿上方补给廊进门；整段不经过弩线
    addMove({ x: 6, y: 4 })
    addMove({ ...MAP2.doors.supply })
    addMove({ ...MAP2.challenge })
    // 到达训练房后单独记「走补给廊」
    actions.push({ type: 'log', event: 'supply' })
    actions.push({ type: 'bubble', text: '补给廊绕过来了，稳稳当当。', wait: 700 })
  } else {
    actions.push({ type: 'bubble', text: '没有朝上的路牌，我走近路。', wait: 900 })
    // 亮线格与另一侧由机关运行时拾盾，计划期不拆段
    const trapIgnore = new Set([
      tileKey(MAP2.trapBeam.x, MAP2.trapBeam.y),
      tileKey(MAP2.trapFar.x, MAP2.trapFar.y),
    ])
    addMove({ ...MAP2.trapStop }, trapIgnore)
    const beamRack = game.items.get(tileKey(MAP2.trapBeam.x, MAP2.trapBeam.y))
    const farRack = game.items.get(tileKey(MAP2.trapFar.x, MAP2.trapFar.y))
    if (beamRack && beamRack.type === 'shield' && !beamRack.taken) state.hasShield = true
    if (farRack && farRack.type === 'shield' && !farRack.taken) state.hasShield = true
    actions.push({
      type: 'trap',
      guestAt: { ...MAP2.trapStop },
      stop: { ...MAP2.trapStop },
      beam: { ...MAP2.trapBeam },
      far: { ...MAP2.trapFar },
    })
    // 无论暂停还是中箭，运行时都会站到 (17,7)；续程从这一格逐格接着走
    state.cur = { ...MAP2.trapFar }
    addMove({ ...MAP2.challenge }, trapIgnore)
  }

  // ---- 训练房：骷髅守卫 ----
  const guestAt = { ...state.cur }
  const sk = MAP2.skeleton
  actions.push({ type: 'face', dir: faceToward(guestAt, sk) })
  actions.push({ type: 'bubble', text: '训练房到了，守卫就在前面。', wait: 1100, arena: true })
  actions.push({ type: 'skeleton', pose: 'raise' })
  actions.push({ type: 'bubble', text: '它举起大锤了……', wait: 900, arena: true })
  actions.push({ type: 'skeleton', pose: 'strike' })
  actions.push({ type: 'effect', kind: 'strike', at: guestAt, ms: 250 })

  if (state.hasShield) {
    actions.push({ type: 'effect', kind: 'block', at: guestAt, ms: 350 })
    actions.push({ type: 'log', event: 'block' })
    actions.push({ type: 'bubble', text: '有盾！挡住了。', wait: 800, arena: true })
    actions.push({ type: 'effect', kind: 'slash', at: { x: sk.x, y: sk.y }, ms: 300 })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '反击得手！', wait: 900, arena: true })
  } else {
    actions.push({ type: 'effect', kind: 'hit', at: guestAt, ms: 350 })
    actions.push({ type: 'stagger', ms: 420 })
    actions.push({ type: 'log', event: 'hit' })
    actions.push({ type: 'bubble', text: '哎哟……被砸中了！', wait: 900, arena: true, tone: 'hurt' })
    actions.push({ type: 'bubble', text: '稳住，反击！', wait: 300, arena: true })
    actions.push({ type: 'effect', kind: 'slash', at: { x: sk.x, y: sk.y }, ms: 300 })
    actions.push({ type: 'skeleton', pose: 'down' })
    actions.push({ type: 'bubble', text: '赢了！', wait: 700, arena: true })
  }

  actions.push({ type: 'log', event: 'badge' })
  actions.push({ type: 'badge' })
  actions.push({ type: 'bubble', text: '勇者徽章到手！', wait: 1600, arena: true, tone: 'gold' })
  actions.push({ type: 'end' })

  return { start: MAP2.spawn, actions }
}