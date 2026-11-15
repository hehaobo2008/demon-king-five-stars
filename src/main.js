import './style.css'
import { COLS, ROWS, ZONES, SKELETON, TRAP_STOP, buildGrid } from './map.js'
import {
  ITEMS,
  DIR_NAMES,
  createGame,
  tileKey,
  placeReason,
  placeFromShop,
  moveItem,
  rotateItem,
  retrieveItem,
  openChest,
  restoreItems,
  addLog,
} from './game.js'
import { planRoute, WALK } from './walk.js'
import { buildReview } from './review.js'
import { makeBaseMap, renderScene, itemDataURL } from './render.js'

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const sidebar = document.getElementById('sidebar')
const goldEl = document.getElementById('gold')
const statusEl = document.getElementById('status')
const bubbleEl = document.getElementById('bubble')
const btnOpen = document.getElementById('btn-open')
const btnReset = document.getElementById('btn-reset')
const btnTrap = document.getElementById('btn-trap')
const btnNext = document.getElementById('btn-next')
const orderTabs = document.getElementById('order-tabs')
const tab1 = document.getElementById('tab-order1')
const tab2 = document.getElementById('tab-order2')
const guestTitleEl = document.getElementById('guest-title')
const guestQuoteEl = document.getElementById('guest-quote')
const logListEl = document.getElementById('log-list')
const reviewCard = document.getElementById('review-card')
const reviewTitle = document.getElementById('review-title')
const reviewStars = document.getElementById('review-stars')
const reviewEvents = document.getElementById('review-events')
const reviewComment = document.getElementById('review-comment')
const reviewMissing = document.getElementById('review-missing')
const btnAgain = document.getElementById('btn-again')
const ghost = document.getElementById('ghost')
const ghostImg = ghost.querySelector('img')

const game = createGame(buildGrid())
const base = makeBaseMap()

// 调试/测试缝：浏览器控制台与自动化实测可读状态
window.__game = game
window.__review = buildReview
window.__ui = () => ({
  mode,
  order,
  secondUnlocked,
  trapMode: crossbow.mode,
  trapUsed: crossbow.used,
  trapWindow: crossbow.windowOpen,
  guest: guest
    ? {
        x: +guest.x.toFixed(2),
        y: +guest.y.toFixed(2),
        hasShield: guest.hasShield,
        hasBadge: guest.hasBadge,
      }
    : null,
  skeletonPose: skeleton.pose,
  logKinds: game.log.map((e) => e.kind),
  bubble: bubbleEl.hidden ? null : bubbleEl.textContent,
  done: mode === 'business' && !walker && !!guest,
})

// mode: 'setup' 可摆放 | 'business' 营业中（锁摆放，重新布置后解锁）
let mode = 'setup'
let order = 1 // 1 首单剑士 | 2 二单机关迷
let secondUnlocked = false
const crossbow = { mode: 'idle', used: false, pressed: false, boltStart: 0, windowOpen: false }
const ORDER_INFO = {
  1: {
    title: '今日预约 · 新手剑士',
    quote: '「我是新手剑士，想拿到勇者徽章。看见宝箱的话，我一定会去看看。」',
  },
  2: {
    title: '今日预约 · 机关迷',
    quote: '「我是机关迷，想拿勇者徽章，也想平平安安过了那道弩。」',
  },
}
let guest = null
let walker = null
let pending = null
let drag = null
let bounce = null
const skeleton = { x: SKELETON.x, y: SKELETON.y, pose: 'idle' }
let fx = null
let stagger = null

const BOUNCE_MS = 240
const DRAG_THRESHOLD = 5

// 侧栏卡片：图标与价格以 ITEMS 为唯一来源
const cardEls = [...document.querySelectorAll('.card')]
for (const el of cardEls) {
  const type = el.dataset.type
  el.querySelector('img').src = itemDataURL(type)
  el.querySelector('.price').textContent = ITEMS[type].price
}

function tileAt(cx, cy) {
  const r = canvas.getBoundingClientRect()
  if (cx < r.left || cx >= r.right || cy < r.top || cy >= r.bottom) return null
  const x = Math.floor(((cx - r.left) / r.width) * COLS)
  const y = Math.floor(((cy - r.top) / r.height) * ROWS)
  return { x, y }
}

function tileCenterClient(x, y) {
  const r = canvas.getBoundingClientRect()
  return {
    x: r.left + ((x + 0.5) / COLS) * r.width,
    y: r.top + ((y + 0.5) / ROWS) * r.height,
  }
}

function cardCenterClient(cardEl) {
  const r = cardEl.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function inSidebar(cx, cy) {
  const r = sidebar.getBoundingClientRect()
  return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom
}

function setGhost(cx, cy, size) {
  ghost.style.display = 'block'
  ghost.style.width = size + 'px'
  ghost.style.height = size + 'px'
  ghost.style.left = cx - size / 2 + 'px'
  ghost.style.top = cy - size / 2 + 'px'
}

function hideGhost() {
  ghost.style.display = 'none'
}

function status(msg) {
  statusEl.textContent = msg
}

function showBubble(text) {
  bubbleEl.textContent = text
  bubbleEl.hidden = false
  positionBubble()
}

function hideBubble() {
  bubbleEl.hidden = true
}

function positionBubble() {
  if (!guest) return
  bubbleEl.style.left = ((guest.x + 0.5) / COLS) * 100 + '%'
  bubbleEl.style.top = (guest.y / ROWS) * 100 + '%'
}

function updateLogUI() {
  logListEl.textContent = ''
  if (!game.log.length) {
    const li = document.createElement('li')
    li.className = 'empty'
    li.textContent = '（暂无记录）'
    logListEl.appendChild(li)
    return
  }
  for (const entry of game.log) {
    const li = document.createElement('li')
    li.textContent = entry.label
    logListEl.appendChild(li)
  }
}

// ---------- 评价单 ----------

function showReview() {
  const r = buildReview(game.log, order)
  reviewTitle.textContent = order === 2 ? '机关迷的评价单' : '新手剑士的评价单'
  reviewStars.textContent = ''
  if (r.status === 'incomplete') {
    const s = document.createElement('span')
    s.className = 'incomplete'
    s.textContent = '预约未完成'
    reviewStars.appendChild(s)
  } else {
    const on = document.createElement('span')
    on.className = 'on'
    on.textContent = '★'.repeat(r.stars)
    const off = document.createElement('span')
    off.textContent = '☆'.repeat(5 - r.stars)
    reviewStars.append(on, off)
  }

  reviewEvents.textContent = ''
  for (const text of r.events) {
    const li = document.createElement('li')
    li.textContent = '✓ ' + text
    reviewEvents.appendChild(li)
  }

  reviewComment.textContent = r.comment ? '「' + r.comment + '」' : ''
  reviewComment.hidden = !r.comment

  reviewMissing.textContent = ''
  for (const text of r.missing) {
    const li = document.createElement('li')
    li.textContent = text
    reviewMissing.appendChild(li)
  }
  reviewMissing.hidden = r.missing.length === 0

  // 首单四星/五星才出现「接下一单」
  btnNext.hidden = !(order === 1 && r.status === 'rated' && r.stars >= 4)

  reviewCard.hidden = false
}

function hideReview() {
  reviewCard.hidden = true
}

btnAgain.addEventListener('click', resetBusiness)

btnNext.addEventListener('click', () => {
  if (order !== 1) return
  hideReview()
  resetBusiness()
  secondUnlocked = true
  setOrder(2)
  status('接下了第二单：机关迷。弩机已上膛，布置好再开门营业。')
})

function updateHUD() {
  goldEl.textContent = game.gold
  for (const el of cardEls) {
    el.classList.toggle(
      'disabled',
      mode !== 'setup' || game.gold < ITEMS[el.dataset.type].price,
    )
  }
  btnOpen.disabled = mode !== 'setup'
  updateTrapButton()
}

function updateTrapButton() {
  btnTrap.hidden = !(secondUnlocked && order === 2)
  if (btnTrap.hidden) return
  const armed =
    mode === 'business' && crossbow.windowOpen && crossbow.mode === 'warning' && !crossbow.used
  btnTrap.disabled = !armed
  btnTrap.classList.toggle('armed', armed)
}

function setOrder(n) {
  if (mode !== 'setup') return
  order = n
  const info = ORDER_INFO[order]
  guestTitleEl.textContent = info.title
  guestQuoteEl.textContent = info.quote
  orderTabs.hidden = !secondUnlocked
  tab1.classList.toggle('active', order === 1)
  tab2.classList.toggle('active', order === 2)
  updateTrapButton()
}

function trySwitchOrder(n) {
  if (mode !== 'setup') {
    status('营业中不能换单')
    return
  }
  setOrder(n)
}

tab1.addEventListener('click', () => trySwitchOrder(1))
tab2.addEventListener('click', () => trySwitchOrder(2))

// 暂停机械弩：仅在预警四秒窗口内可用，一趟一次
btnTrap.addEventListener('click', () => {
  if (mode !== 'business' || order !== 2) return
  if (!crossbow.windowOpen || crossbow.mode !== 'warning' || crossbow.used) return
  crossbow.used = true
  crossbow.pressed = true
  updateTrapButton()
})

// ---------- 营业 / 重新布置 ----------

function startBusiness() {
  if (mode !== 'setup') return
  const plan = planRoute(game, order)
  if (!plan) {
    status('客人找不到去挑战房的路')
    return
  }
  pending = null
  drag = null
  hideGhost()
  sidebar.classList.remove('drop-refund')
  mode = 'business'
  guest = { x: plan.start.x, y: plan.start.y, hasShield: false, hasBadge: false }
  walker = { actions: plan.actions, i: 0, actionStart: performance.now() }
  skeleton.pose = 'idle'
  fx = null
  stagger = null
  crossbow.mode = 'idle'
  crossbow.used = false
  crossbow.pressed = false
  crossbow.boltStart = 0
  crossbow.windowOpen = false
  hideBubble()
  status('营业中：客人正在探索……')
  updateHUD()
}

function resetBusiness() {
  walker = null
  guest = null
  hideBubble()
  hideReview()
  mode = 'setup'
  skeleton.pose = 'idle'
  fx = null
  stagger = null
  crossbow.mode = 'idle'
  crossbow.used = false
  crossbow.pressed = false
  crossbow.boltStart = 0
  crossbow.windowOpen = false
  restoreItems(game)
  game.log.length = 0
  updateLogUI()
  status('已重新布置：摆法保留，宝箱与盾牌恢复原状。')
  updateHUD()
}

btnOpen.addEventListener('click', startBusiness)
btnReset.addEventListener('click', resetBusiness)

// ---------- 行走播放器 ----------

function advanceWalker(t) {
  walker.i++
  walker.actionStart = t
}

// 机关走过/越过亮线后，把下一段移动路径的起点对齐到客人当前格
function patchNextMove() {
  if (!walker || !guest) return
  const next = walker.actions[walker.i + 1]
  if (!next || next.type !== 'move') return
  const gx = Math.round(guest.x)
  const gy = Math.round(guest.y)
  while (next.path.length > 1 && (next.path[0].x !== gx || next.path[0].y !== gy)) {
    next.path.shift()
  }
  if (next.path[0].x !== gx || next.path[0].y !== gy) next.path.unshift({ x: gx, y: gy })
}

// 踩到未拿走的盾牌架就拿起（与常规步行同一规则）
function tryPickupAt(t) {
  if (!guest || guest.hasShield) return false
  const item = game.items.get(tileKey(t.x, t.y))
  if (!item || item.type !== 'shield' || item.taken) return false
  item.taken = true
  guest.hasShield = true
  addLog(game, 'shield')
  updateLogUI()
  showBubble('正好用得上！')
  return true
}

function stepWalker(t) {
  if (!walker) return
  for (;;) {
    const a = walker.actions[walker.i]
    if (!a) {
      walker = null
      return
    }
    if (a.type === 'move') {
      const total = (a.path.length - 1) * WALK.STEP_MS
      const el = t - walker.actionStart
      if (el >= total) {
        const last = a.path[a.path.length - 1]
        guest.x = last.x
        guest.y = last.y
        advanceWalker(t)
        continue
      }
      const idx = Math.min(a.path.length - 2, Math.floor(el / WALK.STEP_MS))
      const frac = (el - idx * WALK.STEP_MS) / WALK.STEP_MS
      const p0 = a.path[idx]
      const p1 = a.path[idx + 1]
      guest.x = p0.x + (p1.x - p0.x) * frac
      guest.y = p0.y + (p1.y - p0.y) * frac
      return
    }
    if (a.type === 'bubble') {
      if (!a.started) {
        a.started = true
        showBubble(a.text)
      }
      if (t - walker.actionStart >= a.wait) {
        advanceWalker(t)
        continue
      }
      return
    }
    if (a.type === 'open') {
      if (openChest(game, a.x, a.y)) {
        addLog(game, 'chest')
        updateLogUI()
      }
      advanceWalker(t)
      continue
    }
    if (a.type === 'pickupShield') {
      // 原子拾盾：真拾到才停一拍并说台词；已被机关阶段拿走的则静默跳过
      if (!a.started) {
        a.started = true
        a.t0 = t
        const item = game.items.get(tileKey(a.x, a.y))
        a.picked = !!(item && item.type === 'shield' && !item.taken)
        if (a.picked) {
          item.taken = true
          guest.hasShield = true
          addLog(game, 'shield')
          updateLogUI()
          showBubble(a.say || '正好用得上！')
        }
      }
      if (!a.picked) {
        advanceWalker(t)
        continue
      }
      if (t - a.t0 >= (a.hold || 1000)) {
        advanceWalker(t)
        continue
      }
      return
    }
    if (a.type === 'skeleton') {
      skeleton.pose = a.pose
      advanceWalker(t)
      continue
    }
    if (a.type === 'badge') {
      guest.hasBadge = true
      advanceWalker(t)
      continue
    }
    if (a.type === 'log') {
      addLog(game, a.event)
      updateLogUI()
      advanceWalker(t)
      continue
    }
    if (a.type === 'effect') {
      if (!a.started) {
        a.started = true
        fx = { kind: a.kind, at: a.at, start: t, ms: a.ms, t: 0 }
      }
      if (t - walker.actionStart >= a.ms) {
        fx = null
        advanceWalker(t)
        continue
      }
      return
    }
    if (a.type === 'stagger') {
      const ms = a.ms || 420
      if (!a.started) {
        a.started = true
        stagger = { start: t, ms }
      }
      if (t - walker.actionStart >= ms) {
        stagger = null
        advanceWalker(t)
        continue
      }
      return
    }
    if (a.type === 'trap') {
      // 机械弩：预警四秒 → 暂停后先跨过亮线再记平安；错过则先步入亮线格、沿亮线中箭
      const beamTile = { x: TRAP_STOP.x, y: TRAP_STOP.y - 1 }
      const farTile = { x: TRAP_STOP.x, y: TRAP_STOP.y - 2 }
      if (!a.started) {
        a.started = true
        a.phase = 'warn'
        a.phaseStart = t
        crossbow.mode = 'warning'
        crossbow.pressed = false
        crossbow.windowOpen = true
        updateTrapButton()
        showBubble('前面有机械弩……')
        status('弩机预警！4 秒内点「暂停机械弩」')
      }
      if (a.phase === 'warn') {
        if (crossbow.pressed) {
          crossbow.mode = 'paused'
          crossbow.windowOpen = false
          a.phase = 'pausedSay'
          a.phaseStart = t
          showBubble('暂停了！')
          status('机械弩已暂停')
          updateTrapButton()
        } else if (t - a.phaseStart >= 4000) {
          // 四秒到点立即熄灭按钮：此后点击无效
          crossbow.windowOpen = false
          a.phase = 'stepIn'
          a.phaseStart = t
          a.stepFrom = { x: guest.x, y: guest.y }
          updateTrapButton()
        }
        return
      }
      if (a.phase === 'pausedSay') {
        if (t - a.phaseStart >= 400) {
          a.phase = 'cross'
          a.phaseStart = t
          a.crossFrom = { x: guest.x, y: guest.y }
          a.crossIdx = 0
          a.crossPicked = false
        }
        return
      }
      if (a.phase === 'cross') {
        // 从亮线这侧走到另一侧（两格），逐格检查是否踩到盾牌架
        const step = Math.min(2, Math.floor((t - a.phaseStart) / 170))
        while (a.crossIdx < step) {
          a.crossIdx++
          const enter = { x: farTile.x, y: a.crossFrom.y - a.crossIdx }
          if (tryPickupAt(enter)) a.crossPicked = true
        }
        const el = Math.min(340, t - a.phaseStart)
        guest.x = a.crossFrom.x
        guest.y = a.crossFrom.y - Math.min(2, el / 170)
        if (t - a.phaseStart >= 340) {
          guest.x = farTile.x
          guest.y = farTile.y
          // 先走到另一侧，才记「平安过弩」
          addLog(game, 'safe')
          updateLogUI()
          status('客人平安通过了机械弩')
          if (a.crossPicked) {
            a.phase = 'crossHold'
            a.phaseStart = t
          } else {
            showBubble('我看准了空档。')
            a.phase = 'safeHold'
            a.phaseStart = t
          }
        }
        return
      }
      if (a.phase === 'crossHold') {
        if (t - a.phaseStart >= 900) {
          showBubble('我看准了空档。')
          a.phase = 'safeHold'
          a.phaseStart = t
        }
        return
      }
      if (a.phase === 'safeHold') {
        if (t - a.phaseStart >= 1100) {
          crossbow.mode = 'spent'
          patchNextMove()
          advanceWalker(t)
        }
        return
      }
      if (a.phase === 'stepIn') {
        // 错过暂停：先走进亮线那一格
        const el = Math.min(170, t - a.phaseStart)
        guest.x = a.stepFrom.x
        guest.y = a.stepFrom.y + (beamTile.y - a.stepFrom.y) * (el / 170)
        if (t - a.phaseStart >= 170) {
          guest.x = beamTile.x
          guest.y = beamTile.y
          tryPickupAt(beamTile)
          crossbow.mode = 'firing'
          crossbow.boltStart = t
          a.phase = 'fire'
          a.phaseStart = t
        }
        return
      }
      if (a.phase === 'fire') {
        // 箭沿亮线飞到他身上
        if (t - a.phaseStart >= 260) {
          crossbow.mode = 'spent'
          fx = { kind: 'hit', at: beamTile, start: t, ms: 380 }
          stagger = { start: t, ms: 460 }
          showBubble('中箭了！')
          status('没来得及暂停，客人中箭了')
          addLog(game, 'shot')
          updateLogUI()
          a.phase = 'hit'
          a.phaseStart = t
        }
        return
      }
      if (a.phase === 'hit') {
        if (t - a.phaseStart >= 1600) {
          patchNextMove()
          advanceWalker(t)
        }
        return
      }
      advanceWalker(t)
      continue
    }
    if (a.type === 'wait') {
      if (t - walker.actionStart >= a.ms) {
        advanceWalker(t)
        continue
      }
      return
    }
    if (a.type === 'end') {
      walker = null
      status('训练战结束。看看客人留下的评价单吧。')
      showReview()
      return
    }
    advanceWalker(t)
  }
}

// ---------- 拖拽（仅 setup 模式可用） ----------

function startDrag(source, type, dir, e) {
  pending = null
  bounce = null
  const r = canvas.getBoundingClientRect()
  drag = {
    source,
    type,
    dir,
    px: e.clientX,
    py: e.clientY,
    cellScreen: r.width / COLS,
    target: null,
    overShop: false,
  }
  ghostImg.src = itemDataURL(type, dir)
  setGhost(e.clientX, e.clientY, drag.cellScreen)
  document.body.classList.add('dragging')
}

function startBounce(to) {
  const size = parseFloat(ghost.style.width) || 32
  bounce = {
    x0: parseFloat(ghost.style.left) + size / 2,
    y0: parseFloat(ghost.style.top) + size / 2,
    x1: to.x,
    y1: to.y,
    t0: performance.now(),
    dur: BOUNCE_MS,
    size,
  }
}

function lockHint() {
  status('营业中，先「重新布置」才能继续摆道具')
}

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('button')) return
  if (mode !== 'setup') {
    if (e.target.closest && e.target.closest('.card')) lockHint()
    else if (e.target === canvas) lockHint()
    return
  }
  if (e.button !== undefined && e.button !== 0) return

  const cardEl = e.target.closest ? e.target.closest('.card') : null
  if (cardEl) {
    const type = cardEl.dataset.type
    if (game.gold < ITEMS[type].price) {
      status('金币不够，先收回几个道具吧')
      return
    }
    e.preventDefault()
    startDrag('shop', type, 0, e)
    return
  }

  if (e.target === canvas) {
    const t = tileAt(e.clientX, e.clientY)
    if (t && game.items.has(tileKey(t.x, t.y))) {
      e.preventDefault()
      pending = { source: { x: t.x, y: t.y }, startX: e.clientX, startY: e.clientY }
    }
  }
})

window.addEventListener('pointermove', (e) => {
  if (mode !== 'setup') return
  if (pending && !drag) {
    if (Math.hypot(e.clientX - pending.startX, e.clientY - pending.startY) <= DRAG_THRESHOLD) {
      return
    }
    const item = game.items.get(tileKey(pending.source.x, pending.source.y))
    if (!item) {
      pending = null
      return
    }
    const src = pending.source
    startDrag(src, item.type, item.dir, { clientX: e.clientX, clientY: e.clientY })
  }
  if (!drag) return

  drag.px = e.clientX
  drag.py = e.clientY
  setGhost(drag.px, drag.py, drag.cellScreen)
  drag.overShop = inSidebar(drag.px, drag.py)
  sidebar.classList.toggle('drop-refund', drag.overShop && drag.source !== 'shop')
  if (drag.overShop) {
    drag.target = null
    return
  }
  const t = tileAt(drag.px, drag.py)
  if (!t) {
    drag.target = null
    return
  }
  const ignore = drag.source === 'shop' ? null : tileKey(drag.source.x, drag.source.y)
  drag.target = { x: t.x, y: t.y, valid: placeReason(game, t.x, t.y, ignore) === 'ok' }
})

window.addEventListener('pointerup', () => {
  if (mode !== 'setup') return
  // 点按（未超过阈值）：路牌顺时针转 90°
  if (pending && !drag) {
    const p = pending
    pending = null
    const item = game.items.get(tileKey(p.source.x, p.source.y))
    if (item && item.type === 'sign') {
      const dir = rotateItem(game, item.x, item.y)
      status(`路牌顺时针转了 90°，现在朝${DIR_NAMES[dir]}`)
    }
    return
  }
  if (!drag) return

  const d = drag
  drag = null
  document.body.classList.remove('dragging')
  sidebar.classList.remove('drop-refund')
  const def = ITEMS[d.type]

  const sourceAnchor =
    d.source === 'shop'
      ? cardCenterClient(document.querySelector(`.card[data-type="${d.type}"]`))
      : tileCenterClient(d.source.x, d.source.y)

  if (d.overShop) {
    if (d.source === 'shop') {
      startBounce(sourceAnchor)
      status('取消放置，不扣钱')
    } else {
      retrieveItem(game, d.source.x, d.source.y)
      hideGhost()
      status(`收回${def.name}，退款 +${def.price} 金`)
    }
  } else if (d.target && d.target.valid) {
    if (d.source === 'shop') {
      placeFromShop(game, d.type, d.target.x, d.target.y)
      status(`放下${def.name}，-${def.price} 金`)
    } else {
      const same = d.target.x === d.source.x && d.target.y === d.source.y
      moveItem(game, d.source, d.target)
      status(same ? `${def.name}留在原格` : `挪动${def.name}，不花金币`)
    }
    hideGhost()
  } else {
    const reason = d.target
      ? placeReason(
          game,
          d.target.x,
          d.target.y,
          d.source === 'shop' ? null : tileKey(d.source.x, d.source.y),
        )
      : 'offmap'
    startBounce(sourceAnchor)
    status(
      reason === 'wall'
        ? '弹回：墙上摆不了道具'
        : reason === 'occupied'
          ? '弹回：这格已有道具'
          : reason === 'reserved'
            ? '弹回：那是骷髅守卫的站位'
            : '弹回：没落在地图上',
    )
  }
  updateHUD()
})

// Esc 取消拖拽/点按；窗口失焦直接复位
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  pending = null
  if (!drag) return
  const anchor =
    drag.source === 'shop'
      ? cardCenterClient(document.querySelector(`.card[data-type="${drag.type}"]`))
      : tileCenterClient(drag.source.x, drag.source.y)
  drag = null
  document.body.classList.remove('dragging')
  sidebar.classList.remove('drop-refund')
  startBounce(anchor)
  status('取消拖拽')
})
window.addEventListener('blur', () => {
  pending = null
  if (drag) {
    drag = null
    document.body.classList.remove('dragging')
    sidebar.classList.remove('drop-refund')
    hideGhost()
  }
})

function buildLegend() {
  const ul = document.getElementById('legend')
  for (const key of ['entrance', 'corridor', 'side', 'challenge']) {
    const li = document.createElement('li')
    const chip = document.createElement('span')
    chip.className = 'chip'
    chip.style.background = ZONES[key].colors[1]
    li.append(chip, ZONES[key].name)
    ul.appendChild(li)
  }
}

function frame(t) {
  if (bounce) {
    const k = Math.min(1, (t - bounce.t0) / bounce.dur)
    const ease = 1 - Math.pow(1 - k, 3)
    const cx = bounce.x0 + (bounce.x1 - bounce.x0) * ease
    const cy = bounce.y0 + (bounce.y1 - bounce.y0) * ease
    setGhost(cx, cy, bounce.size)
    if (k >= 1) {
      bounce = null
      hideGhost()
    }
  }
  stepWalker(t)
  if (guest && !bubbleEl.hidden) positionBubble()
  if (fx) {
    fx.t = t - fx.start
    if (fx.t >= fx.ms) fx = null
  }
  let offsetY = 0
  if (stagger) {
    const el = t - stagger.start
    if (el >= stagger.ms) stagger = null
    else offsetY = Math.sin(el * 0.08) * 4
  }
  const hiddenKey =
    drag && drag.source !== 'shop' ? tileKey(drag.source.x, drag.source.y) : null
  renderScene(ctx, base, game, drag ? drag.target : null, hiddenKey, {
    guest: guest ? { ...guest, offsetY } : null,
    skeleton,
    fx,
    crossbow:
      order === 2
        ? {
            mode: crossbow.mode,
            boltT: crossbow.mode === 'firing' ? t - crossbow.boltStart : 0,
          }
        : null,
  })
  requestAnimationFrame(frame)
}

updateHUD()
buildLegend()
updateLogUI()
requestAnimationFrame(frame)