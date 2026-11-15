import './style.css'
import { COLS, ROWS, ZONES, SKELETON, buildGrid } from './map.js'
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
const logListEl = document.getElementById('log-list')
const reviewCard = document.getElementById('review-card')
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
  const r = buildReview(game.log)
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

  reviewCard.hidden = false
}

function hideReview() {
  reviewCard.hidden = true
}

btnAgain.addEventListener('click', resetBusiness)

function updateHUD() {
  goldEl.textContent = game.gold
  for (const el of cardEls) {
    el.classList.toggle(
      'disabled',
      mode !== 'setup' || game.gold < ITEMS[el.dataset.type].price,
    )
  }
  btnOpen.disabled = mode !== 'setup'
}

// ---------- 营业 / 重新布置 ----------

function startBusiness() {
  if (mode !== 'setup') return
  const plan = planRoute(game)
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
      const item = game.items.get(tileKey(a.x, a.y))
      if (item && item.type === 'shield' && !item.taken) {
        item.taken = true
        guest.hasShield = true
        addLog(game, 'shield')
        updateLogUI()
      }
      advanceWalker(t)
      continue
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
  })
  requestAnimationFrame(frame)
}

updateHUD()
buildLegend()
updateLogUI()
requestAnimationFrame(frame)