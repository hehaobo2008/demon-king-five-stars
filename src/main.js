import './style.css'
import { COLS, ROWS, MAP2, ROOMS, SKELETON, TRAP_STOP, buildGrid, buildGrid2 } from './map.js'
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
import {
  makeBaseMap,
  renderScene,
  itemDataURL,
  charAvatarDataURL,
  stewardAvatarDataURL,
  cursorDataURL,
  drawCoinFrame,
  hourglassDataURL,
  TORCHES_BY_ORDER,
} from './render.js'

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const sidebar = document.getElementById('sidebar')
const goldEl = document.getElementById('gold')
const goldBoxEl = goldEl.parentElement
const goldDeltaEl = document.getElementById('gold-delta')
const coinCanvas = document.getElementById('coin-spin')
const coinCtx = coinCanvas.getContext('2d')
const spd1El = document.getElementById('spd-1')
const spd2El = document.getElementById('spd-2')
const statusEl = document.getElementById('status')
const bubbleEl = document.getElementById('bubble')
const coachEl = document.getElementById('coach')
const coachTextEl = document.getElementById('coach-text')
const coachAvatarEl = document.getElementById('coach-avatar')
const alarmEl = document.getElementById('alarm')
const alarmIconEl = document.getElementById('alarm-icon')
const alarmTextEl = document.getElementById('alarm-text')
const chestCardEl = document.querySelector('.card[data-type="chest"]')
const avatarFrameEl = document.getElementById('avatar-frame')
const dropHintEl = document.getElementById('drop-hint')
const btnOpen = document.getElementById('btn-open')
const btnReset = document.getElementById('btn-reset')
const btnTrap = document.getElementById('btn-trap')
const trapLabelEl = document.getElementById('trap-label')
const trapTimerFillEl = document.getElementById('trap-timer-fill')
const btnNext = document.getElementById('btn-next')
const orderTabs = document.getElementById('order-tabs')
const tab1 = document.getElementById('tab-order1')
const tab2 = document.getElementById('tab-order2')
const guestTitleEl = document.getElementById('guest-title')
const guestQuoteEl = document.getElementById('guest-quote')
const guestAvatarEl = document.getElementById('guest-avatar')
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

// 每单独立存档：地图、场布、余额、日志互不影响
const MAP_DEFS = {
  1: {
    skeleton: SKELETON,
    crossbow: { x: 12, y: 9 },
    beamLeft: 9,
    trapStop: TRAP_STOP,
    arena: { x: 18.5, y: 7.6 },
    stand: { x: 23, y: 3 },
  },
  2: {
    skeleton: MAP2.skeleton,
    crossbow: MAP2.crossbow,
    beamLeft: MAP2.beamLeft,
    trapStop: MAP2.trapStop,
    arena: { x: 20, y: 9.2 },
    stand: { x: 23, y: 2 },
    // 地图警报挂到弩机下方的邻边墙面，避开弩、亮线、客人和火把
    alarm: { x: 22.1, y: 10.2 },
  },
}
const games = {
  1: createGame(buildGrid(), [SKELETON]),
  2: createGame(buildGrid2(), [MAP2.skeleton]),
}
let game = games[1]
const bases = { 1: makeBaseMap(1), 2: makeBaseMap(2) }
let base = bases[1]
let currentMap = MAP_DEFS[1]
// 余额动效以「上一帧真正显示的数字」为基准：移动/取消不跳钱，换单只换数
const shownGold = { 1: games[1].gold, 2: games[2].gold }
let goldFxTimer = 0

// 调试/测试缝：浏览器控制台与自动化实测可读状态
window.__game = game
window.__review = buildReview
window.__ui = () => ({
  mode,
  order,
  secondUnlocked,
  speed,
  simT: Math.round(simT),
  trapMode: crossbow.mode,
  trapUsed: crossbow.used,
  trapWindow: crossbow.windowOpen,
  onbStep,
  guide: guideState
    ? { room: guideState.room || null, tile: guideState.tile || null }
    : null,
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
// 营业时钟：simT 按倍速推进（走路/台词/演出），弩机预警仍用真实毫秒
let speed = 1
let simT = 0
let lastRealT = null
let pop = null // 落位回弹：{ type, x, y, dir, key, start, ms }
let footprintsBase = []
let footprintPreview = null
let footprintPreviewKey = ''
let trapUiSig = ''
const crossbow = {
  mode: 'idle',
  used: false,
  pressed: false,
  boltStart: 0,
  windowOpen: false,
  warnStart: 0,
}
const ORDER_INFO = {
  1: {
    title: '今日预约 · 新手剑士',
    quote:
      '「我是新手剑士，想拿到<em class="kw">勇者徽章</em>。侧室的<em class="kw">宝箱</em>我要开，守卫那一锤我也想<em class="kw">挡</em>。」',
  },
  2: {
    title: '今日预约 · 机关迷',
    quote:
      '「我是机关迷，想拿<em class="kw">勇者徽章</em>。<em class="kw">路牌</em>朝上我就绕<em class="kw">补给廊</em>；不然就走近路，赌一把<em class="kw">弩机</em>。」',
  },
}
let guest = null
let walker = null
let pending = null
let drag = null
let bounce = null
let bubbleAnchor = null

// 首单上手引导（首单真的拿过五星后才收起）
let onboardingRetired = false
let onbStep = 'off' // chest | shield | done | off
let guideState = null // { room } | { tile } | null
const GUIDE_ROOM = ROOMS.sideA
// 建议盾格偏好：依次挑「实际会经过且未被占用」的空地
const SHIELD_SPOT_PREFS = [
  [11, 12],
  [10, 12],
  [10, 13],
  [11, 13],
  [10, 11],
  [10, 10],
  [11, 14],
  [10, 14],
  [10, 9],
  [10, 8],
  [10, 7],
  [10, 6],
]
const skeleton = { x: currentMap.skeleton.x, y: currentMap.skeleton.y, pose: 'idle' }
let fx = null
let stagger = null
let runHasTrap = true
let badgeFly = null
let spark = null
const reducedMotionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
let reducedMotion = reducedMotionMedia.matches
if (reducedMotionMedia.addEventListener) {
  reducedMotionMedia.addEventListener('change', (e) => {
    reducedMotion = e.matches
  })
}

const BOUNCE_MS = 240
const DRAG_THRESHOLD = 5

// 侧栏卡片：图标与价格以 ITEMS 为唯一来源
const cardEls = [...document.querySelectorAll('.card')]
for (const el of cardEls) {
  const type = el.dataset.type
  el.querySelector('img').src = itemDataURL(type)
  el.querySelector('.price').textContent = ITEMS[type].price
}

// 预约头像（随订单切换）
guestAvatarEl.src = charAvatarDataURL('knight')
coachAvatarEl.src = stewardAvatarDataURL()

// 本地像素金币与警报沙漏
drawCoinFrame(coinCtx, 0)
alarmIconEl.src = hourglassDataURL()

// 原创小铁手光标：默认与拖拽两态
const CURSOR_HAND = cursorDataURL('hand')
const CURSOR_GRAB = cursorDataURL('grab')

function applyCursor(grab) {
  document.documentElement.style.cursor = grab
    ? `url(${CURSOR_GRAB}) 7 5, auto`
    : `url(${CURSOR_HAND}) 3 0, auto`
}

applyCursor(false)

// 横排桌面：账房外框与画布外框等高对齐；竖排交给 CSS
const portraitMedia = window.matchMedia('(max-width: 1120px), (max-aspect-ratio: 1/1)')
function syncFrameHeights() {
  if (portraitMedia.matches) {
    sidebar.style.height = ''
    return
  }
  const r = canvas.getBoundingClientRect()
  sidebar.style.height = Math.round(r.height + 6) + 'px'
}
window.addEventListener('resize', syncFrameHeights)
if (portraitMedia.addEventListener) portraitMedia.addEventListener('change', syncFrameHeights)
else portraitMedia.addListener(syncFrameHeights)
requestAnimationFrame(syncFrameHeights)

// 字体就绪后重画两张底图（木牌字用 Fusion Pixel 12px）；字体打不开也照常开局
async function refreshMapArt() {
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        document.fonts.load('12px "Fusion Pixel 12px"', '五星好评入口通道侧室挑战房补给廊弩廊训练房军械库'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('font-timeout')), 1500)),
      ])
    }
  } catch (e) {
    /* 字体不可用：继续用后备字体，不阻塞游戏 */
  }
  try {
    bases[1] = makeBaseMap(1)
    bases[2] = makeBaseMap(2)
    base = bases[order]
  } catch (e) {
    /* 重绘失败保留原底图 */
  }
}

refreshMapArt()
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => refreshMapArt()).catch(() => {})
}

// 画布内容区（去掉 CSS 边框）在视口中的位置与尺寸：命中判定只认画出来的地砖区
function canvasBox() {
  const r = canvas.getBoundingClientRect()
  const cs = getComputedStyle(canvas)
  const bl = parseFloat(cs.borderLeftWidth) || 0
  const bt = parseFloat(cs.borderTopWidth) || 0
  const br = parseFloat(cs.borderRightWidth) || 0
  const bb = parseFloat(cs.borderBottomWidth) || 0
  return {
    left: r.left + bl,
    top: r.top + bt,
    width: r.width - bl - br,
    height: r.height - bt - bb,
  }
}

function tileAt(cx, cy) {
  const b = canvasBox()
  if (cx < b.left || cx >= b.left + b.width || cy < b.top || cy >= b.top + b.height) return null
  const x = Math.floor(((cx - b.left) / b.width) * COLS)
  const y = Math.floor(((cy - b.top) / b.height) * ROWS)
  return { x, y }
}

function tileCenterClient(x, y) {
  const b = canvasBox()
  return {
    x: b.left + ((x + 0.5) / COLS) * b.width,
    y: b.top + ((y + 0.5) / ROWS) * b.height,
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

function status(msg, kind) {
  const cls = kind || (mode === 'business' ? 'business' : 'place')
  statusEl.className = 'status ' + cls
  statusEl.textContent = msg
}

function showBubble(text, at = null, tone = null) {
  bubbleAnchor = at
  bubbleEl.textContent = text
  bubbleEl.className = 'bubble' + (at ? ' tail-up' : '') + (tone ? ' tone-' + tone : '')
  bubbleEl.hidden = false
  // 重新触发轻弹动画
  bubbleEl.style.animation = 'none'
  void bubbleEl.offsetWidth
  bubbleEl.style.animation = ''
  positionBubble()
}

function hideBubble() {
  bubbleEl.hidden = true
  bubbleEl.classList.remove('tail-up')
  bubbleAnchor = null
}

function positionBubble() {
  const pos = bubbleAnchor || (guest ? { x: guest.x, y: guest.y } : null)
  if (!pos) return
  const parent = bubbleEl.parentElement
  const W = parent ? parent.clientWidth : COLS * 32
  const w = bubbleEl.offsetWidth || 200
  let cxPx = ((pos.x + 0.5) / COLS) * W
  // 水平收进画布内：二单右侧也别被裁掉
  const minX = w / 2 + 4
  const maxX = W - w / 2 - 4
  if (cxPx < minX) cxPx = minX
  if (cxPx > maxX) cxPx = maxX
  bubbleEl.style.left = cxPx + 'px'
  bubbleEl.style.top = (pos.y / ROWS) * 100 + '%'
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
  // 首单真的拿过五星后才收起上手引导；3/4 星回来仍按现状提示
  if (order === 1 && r.status === 'rated' && r.stars === 5) onboardingRetired = true
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

// 按真实 planRoute 取客人会踩到的格子（含弩机跨越的三格）
function routeTiles(g) {
  const plan = planRoute(g, order)
  const tiles = []
  const push = (p) => {
    // 只去掉相邻重复格，保留折返与绕行顺序，流动脚印才和真实走法一致
    const last = tiles[tiles.length - 1]
    if (last && last.x === p.x && last.y === p.y) return
    tiles.push({ x: p.x, y: p.y })
  }
  if (plan) {
    for (const a of plan.actions) {
      if (a.type === 'move') {
        for (const p of a.path) push(p)
      } else if (a.type === 'trap') {
        if (a.stop) push(a.stop)
        if (a.beam) push(a.beam)
        if (a.far) push(a.far)
      }
    }
  }
  return tiles
}

function clearFootprintPreview() {
  footprintPreview = null
  footprintPreviewKey = ''
}

// 拖到合法候选格：只把「拟放后的场布」克隆一份临时算路线，不碰真实道具与金币
function previewRouteForDrag(d) {
  const key =
    d.type +
    '|' +
    (d.source === 'shop' ? 'shop' : d.source.x + ',' + d.source.y) +
    '|' +
    d.target.x +
    ',' +
    d.target.y +
    '|' +
    (d.dir || 0)
  if (key === footprintPreviewKey) return
  footprintPreviewKey = key
  const sim = { ...game, items: new Map(game.items) }
  if (d.source === 'shop') {
    sim.items.set(tileKey(d.target.x, d.target.y), {
      type: d.type,
      x: d.target.x,
      y: d.target.y,
      dir: d.dir || 0,
      opened: false,
    })
  } else {
    const fk = tileKey(d.source.x, d.source.y)
    const item = sim.items.get(fk)
    if (!item) {
      footprintPreview = null
      return
    }
    sim.items.delete(fk)
    sim.items.set(tileKey(d.target.x, d.target.y), { ...item, x: d.target.x, y: d.target.y })
  }
  footprintPreview = routeTiles(sim)
}

function triggerGoldFx(delta) {
  if (!delta) return
  const kind = delta < 0 ? 'spend' : 'refund'
  goldBoxEl.classList.remove('spend', 'refund')
  goldDeltaEl.classList.remove('spend', 'refund')
  void goldBoxEl.offsetWidth
  goldBoxEl.classList.add(kind)
  goldDeltaEl.hidden = false
  goldDeltaEl.textContent = (delta > 0 ? '+' : '-') + Math.abs(delta)
  goldDeltaEl.classList.add(kind)
  goldDeltaEl.style.animation = 'none'
  void goldDeltaEl.offsetWidth
  goldDeltaEl.style.animation = ''
  clearTimeout(goldFxTimer)
  goldFxTimer = setTimeout(clearGoldFx, 760)
}

function clearGoldFx() {
  clearTimeout(goldFxTimer)
  goldBoxEl.classList.remove('spend', 'refund')
  goldDeltaEl.hidden = true
  goldDeltaEl.classList.remove('spend', 'refund')
}

function updateHUD() {
  // 只给真实收支做动效：移动/取消/拖错余额不变，换单只换数字
  const prev = shownGold[order]
  if (typeof prev === 'number' && prev !== game.gold) triggerGoldFx(game.gold - prev)
  shownGold[order] = game.gold
  goldEl.textContent = game.gold
  for (const el of cardEls) {
    el.classList.toggle(
      'disabled',
      mode !== 'setup' || game.gold < ITEMS[el.dataset.type].price,
    )
  }
  btnOpen.disabled = mode !== 'setup'
  updateTrapButton()
  updateOnboarding()
  // 布置期的真实路线脚印；营业后收起
  footprintsBase = mode === 'setup' ? routeTiles(game) : []
  if (mode !== 'setup') clearFootprintPreview()
}

function setSpeed(n) {
  speed = n
  spd1El.classList.toggle('active', n === 1)
  spd2El.classList.toggle('active', n === 2)
}

function updateTrapButton() {
  const show = secondUnlocked && order === 2 && (mode !== 'business' || runHasTrap)
  btnTrap.hidden = !show
  if (!show) {
    btnTrap.classList.remove('armed', 'timing')
    trapTimerFillEl.style.transform = 'scaleX(0)'
    return
  }
  const armed =
    mode === 'business' && crossbow.windowOpen && crossbow.mode === 'warning' && !crossbow.used
  btnTrap.disabled = !armed
  btnTrap.classList.toggle('armed', armed)
  btnTrap.classList.toggle('timing', armed)
  if (!armed) trapTimerFillEl.style.transform = 'scaleX(0)'
  let label = '弩机待命 · 客人靠近可拉闸'
  if (mode === 'business') {
    if (crossbow.windowOpen) label = armed ? '拉闸暂停机械弩' : '弩机已暂停'
    else if (crossbow.mode === 'spent' || crossbow.mode === 'firing') label = '弩机已了结'
    else if (crossbow.used || crossbow.mode === 'paused') label = '弩机已暂停'
    else if (crossbow.mode === 'warning') label = '预警已过'
  }
  trapLabelEl.textContent = label
}

function setOrder(n) {
  if (mode !== 'setup') return
  order = n
  game = games[n]
  base = bases[n]
  currentMap = MAP_DEFS[n]
  window.__game = game
  setSpeed(1)
  clearGoldFx()
  clearFootprintPreview()
  pop = null
  skeleton.x = currentMap.skeleton.x
  skeleton.y = currentMap.skeleton.y
  const info = ORDER_INFO[order]
  guestTitleEl.textContent = info.title
  guestQuoteEl.innerHTML = info.quote
  guestAvatarEl.src = charAvatarDataURL(order === 2 ? 'fan' : 'knight')
  avatarFrameEl.className = 'avatar-frame ' + (order === 2 ? 'fan' : 'knight')
  orderTabs.hidden = !secondUnlocked
  tab1.classList.toggle('active', order === 1)
  tab2.classList.toggle('active', order === 2)
  status(
    order === 2
      ? '路牌放在岔口并朝上，客人就绕补给廊；其他方向走近路。'
      : '把道具拖到空地砖上摆放',
  )
  // 二单商店只上这单用得上的道具
  chestCardEl.hidden = order === 2
  updateLogUI()
  updateHUD()
}

// ---------- 首单上手引导 ----------

function itemInRoom(item, room) {
  return item.x >= room.x1 && item.x <= room.x2 && item.y >= room.y1 && item.y <= room.y2
}

// 首单实际会踩到的地砖（含开箱/路牌绕行），用于判断「盾牌放得走不走得到」
function walkedTilesOrder1() {
  const set = new Set()
  const plan = planRoute(game, 1)
  if (plan) {
    for (const a of plan.actions) {
      if (a.type === 'move') {
        for (const t of a.path) set.add(tileKey(t.x, t.y))
      }
    }
  }
  return set
}

function setCoach(text, leftPct, topPct, arrowRight = false) {
  coachTextEl.textContent = text
  coachEl.style.left = leftPct + '%'
  coachEl.style.top = topPct + '%'
  coachEl.classList.toggle('arrow-right', arrowRight)
  coachEl.hidden = false
}

function suggestShieldTile(walked) {
  for (const [x, y] of SHIELD_SPOT_PREFS) {
    if (walked.has(tileKey(x, y)) && placeReason(game, x, y) === 'ok') return { x, y }
  }
  for (const k of walked) {
    const [x, y] = k.split(',').map(Number)
    if (placeReason(game, x, y) === 'ok') return { x, y }
  }
  return null
}

function coachSpotForTile(t) {
  return {
    left: Math.min(72, ((t.x + 1.25) / COLS) * 100),
    top: Math.min(86, Math.max(8, ((t.y + 0.5) / ROWS) * 100)),
  }
}

function updateOnboarding() {
  btnOpen.classList.remove('ready')
  if (mode !== 'setup') {
    coachEl.hidden = true
    guideState = null
    onbStep = 'off'
    return
  }
  if (order === 2) {
    // 二单：岔口地标 + 路牌朝向提示
    onbStep = 'route'
    guideState = { room: null, tile: { x: MAP2.junction.x, y: MAP2.junction.y } }
    const sign = game.items.get(tileKey(MAP2.junction.x, MAP2.junction.y))
    let text
    if (!sign || sign.type !== 'sign') {
      text = '路牌放这格朝上，客人就绕补给廊；不放或转错就走近路。'
    } else if (sign.dir === MAP2.junction.dir) {
      text = '路牌朝上：这趟走补给廊。'
    } else {
      text = '路牌没朝上：这趟走近路（弩机）。'
    }
    // 提示挂到岔口上方军械库南墙的空处，避开右侧走道
    setCoach(text, 38, 64)
    return
  }
  if (onboardingRetired) {
    coachEl.hidden = true
    guideState = null
    onbStep = 'off'
    return
  }
  const items = [...game.items.values()]
  const chests = items.filter((it) => it.type === 'chest')
  const chestInRoom = chests.find(
    (it) => itemInRoom(it, ROOMS.sideA) || itemInRoom(it, ROOMS.sideB),
  )

  if (!chestInRoom) {
    onbStep = 'chest'
    guideState = { room: GUIDE_ROOM, tile: null }
    setCoach(
      chests.length
        ? '宝箱要放进亮起的侧室，他才会进去开。'
        : '把宝箱拖进亮起的侧室，他会进去开箱。',
      34,
      28,
    )
    return
  }

  const walked = walkedTilesOrder1()
  const shields = items.filter((it) => it.type === 'shield')
  const goodShield = shields.find((it) => walked.has(tileKey(it.x, it.y)))

  if (!goodShield) {
    onbStep = 'shield'
    const spot = suggestShieldTile(walked)
    guideState = spot ? { room: null, tile: spot } : null
    const where = spot ? coachSpotForTile(spot) : { left: 51, top: 64 }
    setCoach(
      shields.length
        ? '这格剑士走不到，把盾牌挪到亮起的建议格。'
        : '再摆一面盾，拖到亮起的建议格。他路过时会捡起来挡锤。',
      where.left,
      where.top,
    )
    return
  }

  onbStep = 'done'
  guideState = null
  btnOpen.classList.add('ready')
  setCoach('两件都备好了，点「开门营业」迎客。', 55, 80, true)
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

// 营业倍速：随时可切，走动中的时钟不重置也不跳步
spd1El.addEventListener('click', () => setSpeed(1))
spd2El.addEventListener('click', () => setSpeed(2))

// 暂停机械弩：仅在预警四秒窗口内可用，一趟一次
btnTrap.addEventListener('click', () => {
  if (mode !== 'business' || order !== 2) return
  if (!crossbow.windowOpen || crossbow.mode !== 'warning' || crossbow.used) return
  // 四秒以真实时间计：到点的那一下点击也立即作废（不等下一帧）
  if (performance.now() - crossbow.warnStart >= 4000) {
    crossbow.windowOpen = false
    updateTrapButton()
    return
  }
  crossbow.used = true
  crossbow.pressed = true
  updateTrapButton()
})

// ---------- 营业 / 重新布置 ----------

function startBusiness() {
  if (mode !== 'setup') return
  const plan = planRoute(game, order)
  if (!plan) {
    status('客人找不到去挑战房的路', 'fail')
    return
  }
  runHasTrap = plan.actions.some((a) => a.type === 'trap')
  pending = null
  drag = null
  pop = null
  clearFootprintPreview()
  hideGhost()
  sidebar.classList.remove('drop-refund')
  dropHintEl.hidden = true
  applyCursor(false)
  mode = 'business'
  guest = {
    x: plan.start.x,
    y: plan.start.y,
    hasShield: false,
    hasBadge: false,
    variant: order === 2 ? 'fan' : 'knight',
    facing: 'down',
    walkPhase: 0,
    moving: false,
  }
  walker = { actions: plan.actions, i: 0, actionStart: simT }
  skeleton.pose = 'idle'
  fx = null
  stagger = null
  badgeFly = null
  spark = null
  crossbow.mode = 'idle'
  crossbow.used = false
  crossbow.pressed = false
  crossbow.boltStart = 0
  crossbow.windowOpen = false
  crossbow.warnStart = 0
  alarmEl.hidden = true
  btnTrap.classList.remove('timing')
  trapTimerFillEl.style.transform = 'scaleX(0)'
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
  setSpeed(1)
  clearGoldFx()
  pop = null
  clearFootprintPreview()
  skeleton.pose = 'idle'
  fx = null
  stagger = null
  badgeFly = null
  spark = null
  crossbow.mode = 'idle'
  crossbow.used = false
  crossbow.pressed = false
  crossbow.boltStart = 0
  crossbow.windowOpen = false
  crossbow.warnStart = 0
  alarmEl.hidden = true
  btnTrap.classList.remove('timing')
  trapTimerFillEl.style.transform = 'scaleX(0)'
  runHasTrap = true
  game.badgeTaken = false
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

function stepWalker(t, realT) {
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
        guest.moving = false
        advanceWalker(t)
        continue
      }
      const idx = Math.min(a.path.length - 2, Math.floor(el / WALK.STEP_MS))
      const frac = (el - idx * WALK.STEP_MS) / WALK.STEP_MS
      const p0 = a.path[idx]
      const p1 = a.path[idx + 1]
      guest.x = p0.x + (p1.x - p0.x) * frac
      guest.y = p0.y + (p1.y - p0.y) * frac
      const dx = p1.x - p0.x
      const dy = p1.y - p0.y
      if (dx || dy) {
        guest.facing =
          Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      }
      guest.moving = true
      guest.walkPhase = Math.floor(el / 85) % 2
      return
    }
    if (a.type === 'bubble') {
      if (!a.started) {
        a.started = true
        showBubble(a.text, a.arena ? currentMap.arena : null, a.tone || null)
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
        // 真开箱：跳一粒金光
        spark = { x: a.x, y: a.y, start: t, ms: 520 }
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
    if (a.type === 'face') {
      guest.facing = a.dir
      guest.moving = false
      advanceWalker(t)
      continue
    }
    if (a.type === 'badge') {
      guest.hasBadge = true
      game.badgeTaken = true
      badgeFly = { start: t, dur: reducedMotion ? 0 : 650 }
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
        if (a.kind === 'block' && guest) {
          guest.blockStart = t
          guest.blockMs = a.ms
        }
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
      const beamTile = a.beam
      const farTile = a.far
      if (!a.started) {
        a.started = true
        a.phase = 'warn'
        a.phaseStart = t
        crossbow.mode = 'warning'
        crossbow.pressed = false
        crossbow.windowOpen = true
        crossbow.warnStart = realT // 真实毫秒：倍速不影响四秒窗口
        updateTrapButton()
        // 警报期间收起白色台词气泡，让客人、亮线和弩机露出来
        hideBubble()
        status('弩机预警！4 秒内点「拉闸暂停机械弩」')
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
        } else if (realT - crossbow.warnStart >= 4000) {
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
        guest.facing = 'up'
        guest.moving = true
        guest.walkPhase = Math.floor((t - a.phaseStart) / 85) % 2
        if (t - a.phaseStart >= 340) {
          guest.x = farTile.x
          guest.y = farTile.y
          guest.moving = false
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
        guest.facing = 'up'
        guest.moving = true
        guest.walkPhase = Math.floor((t - a.phaseStart) / 85) % 2
        if (t - a.phaseStart >= 170) {
          guest.x = beamTile.x
          guest.y = beamTile.y
          guest.moving = false
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
          showBubble('中箭了！', null, 'hurt')
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
          a.phase = 'recover'
          a.phaseStart = t
          a.recoverFrom = { x: guest.x, y: guest.y }
        }
        return
      }
      if (a.phase === 'recover') {
        // 中箭后从亮线格再走一步到另一侧，逐格不断
        const el = Math.min(170, t - a.phaseStart)
        guest.x = a.recoverFrom.x
        guest.y = a.recoverFrom.y + (farTile.y - a.recoverFrom.y) * (el / 170)
        guest.facing = 'up'
        guest.moving = true
        guest.walkPhase = Math.floor((t - a.phaseStart) / 85) % 2
        if (t - a.phaseStart >= 170) {
          guest.x = farTile.x
          guest.y = farTile.y
          guest.moving = false
          tryPickupAt(farTile)
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
  pop = null
  clearFootprintPreview()
  const b = canvasBox()
  drag = {
    source,
    type,
    dir,
    px: e.clientX,
    py: e.clientY,
    cellScreen: b.width / COLS,
    target: null,
    overShop: false,
  }
  ghostImg.src = itemDataURL(type, dir)
  setGhost(e.clientX, e.clientY, drag.cellScreen)
  document.body.classList.add('dragging')
  applyCursor(true)
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

// 落位回弹：实际放下/挪位/转路牌时，道具轻轻弹一下并带四粒像素灰
const POP_MS = 220
function setPop(type, x, y, dir = 0) {
  pop = { type, x, y, dir, key: tileKey(x, y), start: performance.now(), ms: POP_MS }
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
      status('金币不够，先收回几个道具吧', 'fail')
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
  const refunding = drag.overShop && drag.source !== 'shop'
  sidebar.classList.toggle('drop-refund', refunding)
  dropHintEl.hidden = !refunding
  if (drag.overShop) {
    drag.target = null
    clearFootprintPreview()
    return
  }
  const t = tileAt(drag.px, drag.py)
  if (!t) {
    drag.target = null
    clearFootprintPreview()
    return
  }
  const ignore = drag.source === 'shop' ? null : tileKey(drag.source.x, drag.source.y)
  drag.target = { x: t.x, y: t.y, valid: placeReason(game, t.x, t.y, ignore) === 'ok' }
  // 合法候选格：先看拟放后的真实路线；不合法则退回当前场布的路线
  if (drag.target.valid) previewRouteForDrag(drag)
  else clearFootprintPreview()
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
      setPop('sign', item.x, item.y, dir)
      status(`路牌顺时针转了 90°，现在朝${DIR_NAMES[dir]}`)
      updateHUD()
    }
    return
  }
  if (!drag) return

  const d = drag
  drag = null
  clearFootprintPreview()
  document.body.classList.remove('dragging')
  sidebar.classList.remove('drop-refund')
  dropHintEl.hidden = true
  applyCursor(false)
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
      setPop(d.type, d.target.x, d.target.y, 0)
      status(`放下${def.name}，-${def.price} 金`)
    } else {
      const same = d.target.x === d.source.x && d.target.y === d.source.y
      moveItem(game, d.source, d.target)
      if (!same) setPop(d.type, d.target.x, d.target.y, d.dir)
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
      'fail',
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
  dropHintEl.hidden = true
  applyCursor(false)
  clearFootprintPreview()
  startBounce(anchor)
  status('取消拖拽')
})
window.addEventListener('blur', () => {
  pending = null
  if (drag) {
    drag = null
    document.body.classList.remove('dragging')
    sidebar.classList.remove('drop-refund')
    dropHintEl.hidden = true
    applyCursor(false)
    clearFootprintPreview()
    hideGhost()
  }
})

function frame(realT) {
  // 营业模拟时钟：按 1×/2× 推进；切换时 dt 连续累加，不跳步不断拍
  if (lastRealT == null) lastRealT = realT
  const dt = Math.min(200, Math.max(0, realT - lastRealT))
  lastRealT = realT
  simT += dt * speed
  const t = simT
  if (!reducedMotion) drawCoinFrame(coinCtx, Math.floor(realT / 140) % 4)

  if (bounce) {
    const k = Math.min(1, (realT - bounce.t0) / bounce.dur)
    const ease = 1 - Math.pow(1 - k, 3)
    const cx = bounce.x0 + (bounce.x1 - bounce.x0) * ease
    const cy = bounce.y0 + (bounce.y1 - bounce.y0) * ease
    setGhost(cx, cy, bounce.size)
    if (k >= 1) {
      bounce = null
      hideGhost()
    }
  }
  stepWalker(t, realT)
  if (!bubbleEl.hidden) positionBubble()
  if (fx) {
    fx.t = t - fx.start
    if (fx.t >= fx.ms) fx = null
  }
  let offsetY = 0
  let offsetX = 0
  if (stagger) {
    const el = t - stagger.start
    if (el >= stagger.ms) stagger = null
    else {
      const p = el / stagger.ms
      offsetX = -Math.sin(p * Math.PI) * 7 // 吃锤才后撤
      offsetY = Math.sin(p * Math.PI * 4) * 1.5
    }
  }
  const blocking = !!(guest && guest.blockStart && t - guest.blockStart < guest.blockMs)

  // 二单警报：挂在邻边墙面，像素沙漏 + 真实剩余秒数（倍速不影响四秒）
  const trapRemain =
    order === 2 && crossbow.windowOpen ? Math.max(0, 4000 - (realT - crossbow.warnStart)) : null
  if (trapRemain != null && crossbow.mode === 'warning') {
    alarmEl.hidden = false
    alarmTextEl.textContent = `弩机预警 ${(trapRemain / 1000).toFixed(1)}s`
    const anchor =
      currentMap.alarm || { x: currentMap.crossbow.x + 2.5, y: currentMap.crossbow.y + 1.8 }
    alarmEl.style.left = (anchor.x / COLS) * 100 + '%'
    alarmEl.style.top = (anchor.y / ROWS) * 100 + '%'
  } else if (!alarmEl.hidden) {
    alarmEl.hidden = true
  }
  // 进度条嵌在拉闸按钮下沿：满到空；收起时只动透明度与 transform，按钮高度不变
  trapTimerFillEl.style.transform = `scaleX(${trapRemain != null ? trapRemain / 4000 : 0})`
  // 弩机按钮随状态换文案（待命 / 拉闸 / 已暂停 / 已了结）
  const trapSig = `${mode}|${order}|${secondUnlocked}|${runHasTrap}|${crossbow.mode}|${crossbow.windowOpen}|${crossbow.used}`
  if (trapSig !== trapUiSig) {
    trapUiSig = trapSig
    updateTrapButton()
  }
  // 预警时把剩余时间并进按钮文案；到点或拉闸后由状态字立即接管
  if (trapRemain != null && crossbow.mode === 'warning' && !crossbow.used) {
    const label = `拉闸暂停机械弩 · ${(trapRemain / 1000).toFixed(1)}s`
    if (trapLabelEl.textContent !== label) trapLabelEl.textContent = label
  }
  const hiddenKey =
    drag && drag.source !== 'shop' ? tileKey(drag.source.x, drag.source.y) : null

  // 徽章飞行 / 开箱金光 进度
  let badgeFlyScene = null
  if (badgeFly) {
    const p = badgeFly.dur <= 0 ? 1 : Math.min(1, (t - badgeFly.start) / badgeFly.dur)
    badgeFlyScene = { p }
    if (p >= 1) badgeFly = null
  }
  let sparkScene = null
  if (spark) {
    const el = t - spark.start
    if (el >= spark.ms) spark = null
    else sparkScene = { x: spark.x, y: spark.y, t: el, ms: spark.ms }
  }
  // 落位回弹（布置期，按真实毫秒）
  let popScene = null
  if (pop) {
    const el = realT - pop.start
    if (el >= pop.ms) pop = null
    else
      popScene = {
        key: pop.key,
        type: pop.type,
        x: pop.x,
        y: pop.y,
        dir: pop.dir,
        t: el,
        ms: pop.ms,
      }
  }
  // 受击闪白：只在真的命中帧（约 80ms）
  let flash = null
  if (fx && fx.t < 80) {
    flash = fx.kind === 'hit' ? 'guest' : fx.kind === 'slash' ? 'skeleton' : null
  }
  // 整像素轻抖：挨打约 4px、格挡 2px，收在前 120ms；减少动效不抖
  let shakeX = 0
  let shakeY = 0
  if (!reducedMotion && fx && (fx.kind === 'block' || fx.kind === 'hit') && fx.t < 120) {
    const base = fx.kind === 'hit' ? 4 : 2
    const amp = base * (1 - fx.t / 120)
    shakeX = Math.round(Math.sin(fx.t * 0.9) * amp)
    shakeY = Math.round(Math.cos(fx.t * 1.1) * amp)
  }

  // 整帧清理，防止位移时画布边缘残留上一帧条纹
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(shakeX, shakeY)
  renderScene(
    ctx,
    base,
    game,
    drag && drag.target ? { ...drag.target, type: drag.type, dir: drag.dir || 0 } : null,
    hiddenKey,
    {
    guest: guest
      ? {
          ...guest,
          offsetY,
          offsetX,
          blocking,
          flash: flash === 'guest',
          hideBadge: !!badgeFlyScene, // 飞行期间只画飞的那枚，落地后才显示头顶徽章
        }
      : null,
    skeleton,
    fx,
    guide: guideState,
    torches: TORCHES_BY_ORDER[order],
    dragging: !!drag && mode === 'setup',
    forbidden: game.reserved,
    footprints:
      mode === 'setup' && (footprintPreview || footprintsBase.length)
        ? { tiles: footprintPreview || footprintsBase, preview: !!footprintPreview }
        : null,
    pop: popScene,
    stand: currentMap.stand,
    standBadge: !game.badgeTaken,
    badgeFly: badgeFlyScene,
    spark: sparkScene,
    flash,
    crossbow:
      order === 2
        ? {
            mode: crossbow.mode,
            boltT: crossbow.mode === 'firing' ? t - crossbow.boltStart : 0,
            x: currentMap.crossbow.x,
            y: currentMap.crossbow.y,
            beamLeft: currentMap.beamLeft,
            stopX: currentMap.trapStop.x,
            stopY: currentMap.trapStop.y,
          }
        : null,
  })
  ctx.restore()
  requestAnimationFrame(frame)
}

updateHUD()
updateLogUI()
requestAnimationFrame(frame)