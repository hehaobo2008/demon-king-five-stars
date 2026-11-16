import './style.css'
import {
  COLS,
  ROWS,
  ARCHIVE,
  MARKET,
  MAP2,
  MOSS,
  PENDULUM,
  mossThreatZone,
  ROOMS,
  SKELETON,
  TIDE,
  TRAP_STOP,
  buildGrid,
  buildGrid2,
  buildGrid3,
  buildGrid4,
  buildGrid5,
  buildGrid6,
  buildGrid7,
} from './map.js'
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
  coinFrameDataURL,
  hourglassDataURL,
  logIconDataURL,
  speakerDataURL,
  quoteMarkDataURL,
  turnIconDataURL,
  boltIconDataURL,
  TORCHES_BY_ORDER,
  LAMPS_BY_ORDER,
} from './render.js'
import { sfx } from './sfx.js'

const canvas = document.getElementById('game')
const ctx = canvas.getContext('2d')
const playArea = document.querySelector('.play-area')
const btnSound = document.getElementById('btn-sound')
const soundIconEl = document.getElementById('sound-icon')
const sidebar = document.getElementById('sidebar')
const goldEl = document.getElementById('gold')
const goldBoxEl = goldEl.parentElement
const goldDeltaEl = document.getElementById('gold-delta')
const coinCanvas = document.getElementById('coin-spin')
const coinCtx = coinCanvas.getContext('2d')
const spd1El = document.getElementById('spd-1')
const spd2El = document.getElementById('spd-2')
const spdBoltEl = document.getElementById('spd-bolt')
const ledgerDividerEl = document.getElementById('ledger-divider')
const statusEl = document.getElementById('status')
const bubbleEl = document.getElementById('bubble')
const bubbleTextEl = document.getElementById('bubble-text')
const bubbleAvatarEl = document.getElementById('bubble-avatar')
const coachEl = document.getElementById('coach')
const coachTextEl = document.getElementById('coach-text')
const coachAvatarEl = document.getElementById('coach-avatar')
const alarmEl = document.getElementById('alarm')
const alarmIconEl = document.getElementById('alarm-icon')
const alarmTextEl = document.getElementById('alarm-text')
const chestCardEl = document.querySelector('.card[data-type="chest"]')
const chestCardSealEl = chestCardEl.querySelector('.card-seal')
const barrierCardEl = document.querySelector('.card[data-type="barrier"]')
const bridgeCardEl = document.querySelector('.card[data-type="bridge"]')
const weightCardEl = document.querySelector('.card[data-type="weight"]')
const bellCardEl = document.querySelector('.card[data-type="bell"]')
const avatarFrameEl = document.getElementById('avatar-frame')
const dropHintEl = document.getElementById('drop-hint')
const btnOpen = document.getElementById('btn-open')
const btnReset = document.getElementById('btn-reset')
const btnTrap = document.getElementById('btn-trap')
const trapSlotEl = document.querySelector('.trap-slot')
const trapLabelEl = document.getElementById('trap-label')
const trapTimerFillEl = document.getElementById('trap-timer-fill')
const btnSwing = document.getElementById('btn-swing')
const swingLabelEl = document.getElementById('swing-label')
const swingTimerFillEl = document.getElementById('swing-timer-fill')
const btnNext = document.getElementById('btn-next')
const orderTabs = document.getElementById('order-tabs')
const tab1 = document.getElementById('tab-order1')
const tab2 = document.getElementById('tab-order2')
const tab3 = document.getElementById('tab-order3')
const tab4 = document.getElementById('tab-order4')
const tab5 = document.getElementById('tab-order5')
const tab6 = document.getElementById('tab-order6')
const tab7 = document.getElementById('tab-order7')
const galleryTitleEl = document.getElementById('gallery-title')
const certEl = document.getElementById('five-star-cert')
const guestTitleEl = document.getElementById('guest-title')
const guestQuoteEl = document.getElementById('guest-quote')
const guestQuoteTextEl = document.getElementById('guest-quote-text')
const guestQuoteMarkEl = document.getElementById('guest-quote-mark')
const guestAvatarEl = document.getElementById('guest-avatar')
const logListEl = document.getElementById('log-list')
const logProgressEl = document.getElementById('log-progress')
const logStarEls = [...logProgressEl.querySelectorAll('.log-star')]
const runLogEl = document.querySelector('.run-log')
const reviewCard = document.getElementById('review-card')
const reviewReceiptEl = reviewCard.querySelector('.receipt')
const reviewTitle = document.getElementById('review-title')
const reviewSealEl = document.getElementById('review-seal')
const reviewStars = document.getElementById('review-stars')
const reviewEvents = document.getElementById('review-events')
const reviewComment = document.getElementById('review-comment')
const reviewCommentTextEl = document.getElementById('review-comment-text')
const reviewSignEl = document.getElementById('review-sign')
const reviewMissing = document.getElementById('review-missing')
const btnAgain = document.getElementById('btn-again')
const ghost = document.getElementById('ghost')
const ghostImg = ghost.querySelector('img')
const tagDragIconEl = document.getElementById('tag-drag-icon')
const tagTurnIconEl = document.getElementById('tag-turn-icon')

// 每单独立存档：地图、场布、余额、日志互不影响
const MAP_DEFS = {
  1: {
    skeleton: SKELETON,
    crossbow: { x: 12, y: 9 },
    beamLeft: 9,
    trapStop: TRAP_STOP,
    arena: { x: 18.5, y: 6.2 },
    stand: { x: 23, y: 3 },
  },
  2: {
    skeleton: MAP2.skeleton,
    crossbow: MAP2.crossbow,
    beamLeft: MAP2.beamLeft,
    trapStop: MAP2.trapStop,
    arena: { x: 20, y: 6.8 },
    stand: { x: 23, y: 2 },
    // 地图警报挂到弩机下方的邻边墙面，避开弩、亮线、客人和火把
    alarm: { x: 22.1, y: 10.2 },
  },
  3: {
    skeleton: MARKET.skeleton,
    arena: MARKET.arena,
    stand: MARKET.stand,
  },
  4: {
    skeleton: TIDE.skeleton,
    arena: TIDE.arena,
    stand: TIDE.stand,
  },
  5: {
    skeleton: ARCHIVE.skeleton,
    arena: ARCHIVE.arena,
    stand: ARCHIVE.stand,
  },
  6: {
    skeleton: PENDULUM.skeleton,
    arena: PENDULUM.arena,
    stand: PENDULUM.stand,
  },
  7: {
    skeleton: MOSS.skeleton,
    arena: MOSS.arena,
    stand: MOSS.stand,
  },
}
const games = {
  1: createGame(buildGrid(), [SKELETON]),
  2: createGame(buildGrid2(), [MAP2.skeleton]),
  3: createGame(buildGrid3(), [MARKET.skeleton]),
  4: createGame(buildGrid4(), [TIDE.skeleton]),
  5: createGame(buildGrid5(), [
    ARCHIVE.skeleton,
    ...ARCHIVE.archives.map((a) => ({ x: a.x, y: a.y })),
  ]),
  6: createGame(buildGrid6(), [PENDULUM.skeleton]),
  7: createGame(buildGrid7(), [
    MOSS.skeleton,
    { x: MOSS.sample.x, y: MOSS.sample.y },
  ]),
}
let game = games[1]
const bases = {
  1: makeBaseMap(1),
  2: makeBaseMap(2),
  3: makeBaseMap(3),
  4: makeBaseMap(4),
  5: makeBaseMap(5),
  6: makeBaseMap(6),
  7: makeBaseMap(7),
}
let base = bases[1]
let currentMap = MAP_DEFS[1]
// 余额动效以「上一帧真正显示的数字」为基准：移动/取消不跳钱，换单只换数
const shownGold = {
  1: games[1].gold,
  2: games[2].gold,
  3: games[3].gold,
  4: games[4].gold,
  5: games[5].gold,
  6: games[6].gold,
  7: games[7].gold,
}
let goldFxTimer = 0

// 调试/测试缝：浏览器控制台与自动化实测可读状态
window.__game = game
window.__review = buildReview
window.__ui = () => ({
  mode,
  order,
  secondUnlocked,
  thirdUnlocked,
  fourthUnlocked,
  fifthUnlocked,
  sixthUnlocked,
  seventhUnlocked,
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
  bestStars: { ...bestStars },
  certified: !certEl.hidden,
  bubble: bubbleEl.hidden ? null : bubbleEl.textContent,
  done: mode === 'business' && !walker && !!guest,
})

// mode: 'setup' 可摆放 | 'business' 营业中（锁摆放，重新布置后解锁）
let mode = 'setup'
let order = 1 // 1 首单剑士 | 2 二单机关迷 | 3 正篇回声集市
let secondUnlocked = false
let thirdUnlocked = false
let fourthUnlocked = false
let fifthUnlocked = false
let sixthUnlocked = false
let seventhUnlocked = false
// 营业时钟：simT 按倍速推进（走路/台词/演出），弩机预警仍用真实毫秒
let speed = 1
let simT = 0
let lastRealT = null
let pop = null // 落位回弹：{ type, x, y, dir, key, start, ms }
let footprintsBase = null
let footprintPreview = null
let footprintPreviewKey = ''
let trapUiSig = ''
let swingUiSig = ''
let swingUsed = false
let swingWarn = null
let swingStopped = new Set() // { id, at, startReal, ms, pressed }
let logShownOrder = 0
let logShownCount = 0
let reviewStampPlayed = false
let reviewTimers = []

// 历史最高星与五星认证：本地存储不可用时只保留本次会话
// 旧版把两单合在一个 JSON 键里；新版每单一个键，两个页面各写各的，读取时取高
const LEGACY_BEST_KEY = 'demon-king-five-stars:best'
const BEST_ORDER_PREFIX = 'demon-king-five-stars:best:'
const CERT_SEEN_KEY = 'demon-king-five-stars:cert'

function clampBestStars(value) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(5, n)
}

function orderBestKey(n) {
  return BEST_ORDER_PREFIX + n
}

// 旧合并键只读兼容：以前存的两单星数继续读得出来
function readLegacyBestStars() {
  try {
    const raw = window.localStorage.getItem(LEGACY_BEST_KEY)
    if (!raw) return { 1: 0, 2: 0 }
    const data = JSON.parse(raw)
    return { 1: clampBestStars(data && data[1]), 2: clampBestStars(data && data[2]) }
  } catch (e) {
    return { 1: 0, 2: 0 }
  }
}

function readOrderBestStars(n) {
  try {
    return clampBestStars(window.localStorage.getItem(orderBestKey(n)))
  } catch (e) {
    return 0
  }
}

function readBestStars() {
  const legacy = readLegacyBestStars()
  return {
    1: Math.max(readOrderBestStars(1), legacy[1]),
    2: Math.max(readOrderBestStars(2), legacy[2]),
    3: readOrderBestStars(3),
    4: readOrderBestStars(4),
    5: readOrderBestStars(5),
    6: readOrderBestStars(6),
    7: readOrderBestStars(7),
  }
}

// 只写当前订单自己的键：先读一次已存值，取最高后再落盘
function saveOrderBestStars(n, stars) {
  const stored = readOrderBestStars(n)
  const legacy = readLegacyBestStars()[n] || 0
  const next = Math.max(bestStars[n] || 0, clampBestStars(stars), stored, legacy)
  bestStars[n] = next
  if (next > stored) {
    try {
      window.localStorage.setItem(orderBestKey(n), String(next))
    } catch (e) {
      /* 无存储环境保留本次会话内的最高分 */
    }
  }
}

// 结算后重新读两张订单的键，合并另一页面刚写下的更高分
function mergeBestFromStorage() {
  const stored = readBestStars()
  bestStars = {
    1: Math.max(bestStars[1], stored[1]),
    2: Math.max(bestStars[2], stored[2]),
    3: Math.max(bestStars[3], stored[3]),
    4: Math.max(bestStars[4], stored[4]),
    5: Math.max(bestStars[5], stored[5]),
    6: Math.max(bestStars[6], stored[6]),
    7: Math.max(bestStars[7], stored[7]),
  }
}

function readCertSeen() {
  try {
    return window.localStorage.getItem(CERT_SEEN_KEY) === '1'
  } catch (e) {
    return false
  }
}

function saveCertSeen() {
  try {
    window.localStorage.setItem(CERT_SEEN_KEY, '1')
  } catch (e) {
    /* 无存储环境不影响游戏 */
  }
}

let bestStars = readBestStars()
let certCelebrated = readCertSeen()

// 另一页面结算时实时并入更高分；只刷新最高星与认证，不改当前页面的解锁/摆放
window.addEventListener('storage', (e) => {
  if (
    e.key !== LEGACY_BEST_KEY &&
    e.key !== orderBestKey(1) &&
    e.key !== orderBestKey(2) &&
    e.key !== orderBestKey(3) &&
    e.key !== orderBestKey(4) &&
    e.key !== orderBestKey(5) &&
    e.key !== orderBestKey(6) &&
    e.key !== orderBestKey(7)
  ) {
    return
  }
  const sig = () =>
    `${bestStars[1]}|${bestStars[2]}|${bestStars[3]}|${bestStars[4]}|${bestStars[5]}|${bestStars[6]}|${bestStars[7]}`
  const before = sig()
  mergeBestFromStorage()
  if (sig() !== before) updateBestUI()
})
let doorOpen = 0
let doorTween = null
let gearSpinStart = performance.now()
let gearFreezePhase = null
let lastGearPhase = 0
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
  3: {
    title: '今日预约 · 淘货客',
    quote:
      '「我是回声集市的淘货客，想拿<em class="kw">勇者徽章</em>。西铺、东铺的<em class="kw">宝箱</em>至少让我翻一只；守卫那锤能<em class="kw">挡</em>就挡。」',
  },
  4: {
    title: '今日预约 · 潮汐工',
    quote:
      '「我是看潮的匠人，想拿<em class="kw">勇者徽章</em>。先到<em class="kw">水尺</em>记水位；桥板搭好我就从桥上过，不然绕两岸干路。」',
  },
  5: {
    title: '今日预约 · 抄书人',
    quote:
      '「我是档案库的抄书人，想拿<em class="kw">勇者徽章</em>。默认先抄一份；<em class="kw">路牌</em>把我从后门引到另一间，就两份都抄。红黄<em class="kw">近门</em>开了、我真穿过去，也认。」',
  },
  6: {
    title: '今日预约 · 钟摆工',
    quote:
      '「我是钟摆工坊的工匠，想拿<em class="kw">勇者徽章</em>。我要一件<em class="kw">零件</em>；钟摆只停一次，得在它扫下来前拉闸，或者干脆走干净南道。」',
  },
  7: {
    title: '今日预约 · 采苔人',
    quote:
      '「我是来采<em class="kw">苔火样本</em>的，也想拿勇者徽章。内院有巡卫；把<em class="kw">古铃</em>挂到一侧能引开他，走外廊则碰不着他。」',
  },
}
const GUEST_VARIANT = {
  1: 'knight',
  2: 'fan',
  3: 'trader',
  4: 'fan',
  5: 'trader',
  6: 'fan',
  7: 'trader',
}
const REVIEW_META = {
  1: { title: '新手剑士的评价单', sign: '新手剑士' },
  2: { title: '机关迷的评价单', sign: '机关迷' },
  3: { title: '淘货客的评价单', sign: '淘货客' },
  4: { title: '潮汐工的评价单', sign: '潮汐工' },
  5: { title: '抄书人的评价单', sign: '抄书人' },
  6: { title: '钟摆工的评价单', sign: '钟摆工' },
  7: { title: '采苔人的评价单', sign: '采苔人' },
}
let guest = null
let walker = null
let footDust = []
let lastGuestTile = null
let hoverItem = null
let invalidFlash = null
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
const cardUseEls = {}
for (const el of cardEls) {
  const type = el.dataset.type
  el.querySelector('img').src = itemDataURL(type)
  el.querySelector('.price').textContent = ITEMS[type].price
  cardUseEls[type] = el.querySelector('.card-use')
}

const CARD_USE_COPY = {
  1: {
    chest: '放进侧室，客人会去开',
    shield: '摆在必经之路，捡起挡锤',
    sign: '摆上点击，给客人指路',
  },
  2: {
    chest: '放进侧室，客人会去开',
    shield: '摆在必经之路，捡起挡锤',
    sign: '摆上点击，给客人指路',
  },
  3: {
    chest: '放进西铺或东铺，客人会去开',
    shield: '摆在客人经过的路上，捡起挡锤',
    sign: '插在罗盘岔口，给客人引路',
    barrier: '占一格挡路，改客人走法',
  },
  4: {
    shield: '摆在客人经过的路上，捡起挡锤',
    sign: '放在岔口，给客人指一段路',
    barrier: '占一格挡路，改客人走法',
    bridge: '拖到标出的桥位，架通整段水',
  },
  5: {
    shield: '摆在客人经过的路上，捡起挡锤',
    sign: '放在岔口，给客人指一段路',
    barrier: '占一格挡路，改客人走法',
    weight: '压上红/黄压板，开对应门',
  },
  6: {
    shield: '摆在客人经过的路上，捡起挡锤',
    sign: '放在岔口，给客人指一段路',
    barrier: '占一格挡路，改客人走法',
  },
  7: {
    shield: '摆在客人经过的路上，捡起挡锤',
    sign: '放在岔口，给客人指一段路',
    barrier: '占一格挡路，改客人走法',
    bell: '挂上铃位，把巡卫引去一侧',
  },
}

function updateCardCopy() {
  const copy = CARD_USE_COPY[order] || CARD_USE_COPY[1]
  for (const [type, el] of Object.entries(cardUseEls)) {
    if (el && copy[type]) el.textContent = copy[type]
  }
}
// 卡片小金币用顶部旋转金币的静态第一帧
const staticCoinURL = coinFrameDataURL(0)
for (const coin of document.querySelectorAll('.card .coin')) {
  coin.style.backgroundImage = `url(${staticCoinURL})`
}
guestQuoteMarkEl.src = quoteMarkDataURL()
spdBoltEl.src = boltIconDataURL()
tagDragIconEl.src = cursorDataURL('grab')
tagTurnIconEl.src = turnIconDataURL()

// 预约头像（随订单切换）
guestAvatarEl.src = charAvatarDataURL('knight')
coachAvatarEl.src = stewardAvatarDataURL()

// 本地像素金币、警报沙漏、记录等待图标与喇叭
drawCoinFrame(coinCtx, 0)
alarmIconEl.src = hourglassDataURL()
const WAIT_LOG_ICON = hourglassDataURL()

function updateSoundButton() {
  const muted = sfx.isMuted()
  btnSound.classList.toggle('muted', muted)
  btnSound.setAttribute('aria-pressed', muted ? 'true' : 'false')
  btnSound.setAttribute('aria-label', muted ? '音效已关，点击开启' : '音效开启，点击静音')
  btnSound.title = muted ? '音效已关 · 点击开启' : '音效开启 · 点击静音'
  soundIconEl.src = speakerDataURL(muted)
}

let audioGestureSeen = false
function unlockAudioOnce() {
  if (audioGestureSeen) return
  audioGestureSeen = true
  sfx.unlock()
  window.removeEventListener('pointerdown', unlockAudioOnce, true)
  window.removeEventListener('keydown', unlockAudioOnce, true)
}
window.addEventListener('pointerdown', unlockAudioOnce, true)
window.addEventListener('keydown', unlockAudioOnce, true)
btnSound.addEventListener('click', () => {
  sfx.toggle()
  updateSoundButton()
})
updateSoundButton()

// 原创小铁手光标：默认与拖拽两态
const CURSOR_HAND = cursorDataURL('hand')
const CURSOR_GRAB = cursorDataURL('grab')

function applyCursor(grab) {
  document.documentElement.style.cursor = grab
    ? `url(${CURSOR_GRAB}) 7 5, auto`
    : `url(${CURSOR_HAND}) 3 0, auto`
}

applyCursor(false)

// 画布按整数 CSS 像素/格收齐，保持 4:3；横排账房外框与画布等高
const portraitMedia = window.matchMedia('(max-width: 1120px), (max-aspect-ratio: 1/1)')
function syncCanvasSize() {
  const vw = document.documentElement.clientWidth
  const vh = document.documentElement.clientHeight
  if (portraitMedia.matches) {
    const maxW = Math.min(900, Math.min(vh * 0.58, 640) * 4 / 3)
    const avail = Math.min(vw - 32, maxW)
    const tile = Math.max(8, Math.floor((avail - 6) / COLS))
    canvas.style.width = tile * COLS + 'px'
    canvas.style.height = tile * ROWS + 'px'
    playArea.style.width = tile * COLS + 6 + 'px'
    sidebar.style.height = ''
  } else {
    const boardH = Math.min(720, vh - 164)
    const maxW = vw - 480
    const tile = Math.max(8, Math.floor(Math.min(boardH / ROWS, maxW / COLS)))
    canvas.style.width = tile * COLS + 'px'
    canvas.style.height = tile * ROWS + 'px'
    playArea.style.width = ''
    sidebar.style.height = Math.round(tile * ROWS + 6) + 'px'
  }
  if (mode === 'setup') updateOnboarding()
}
window.addEventListener('resize', syncCanvasSize)
if (portraitMedia.addEventListener) portraitMedia.addEventListener('change', syncCanvasSize)
else portraitMedia.addListener(syncCanvasSize)
requestAnimationFrame(syncCanvasSize)

// 字体就绪后重画两张底图（木牌字用 Fusion Pixel 12px）；字体打不开也照常开局
async function refreshMapArt() {
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        document.fonts.load(
          '12px "Fusion Pixel 12px"',
          '五星好评入口通道侧室挑战房补给廊弩廊训练房军械库回声集市西铺草料东铺陶器潮汐蓄水厅西岸东岸双锁档案库西档案间东档案间红门黄门钟摆工坊上层钟摆南道苔火巡廊内院外廊铃位苔火样本',
        ),
        new Promise((_, reject) => setTimeout(() => reject(new Error('font-timeout')), 1500)),
      ])
    }
  } catch (e) {
    /* 字体不可用：继续用后备字体，不阻塞游戏 */
  }
  try {
    bases[1] = makeBaseMap(1)
    bases[2] = makeBaseMap(2)
    bases[3] = makeBaseMap(3)
    bases[4] = makeBaseMap(4)
    bases[5] = makeBaseMap(5)
    bases[6] = makeBaseMap(6)
    bases[7] = makeBaseMap(7)
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
  ghost.classList.remove('is-bouncing')
}

function status(msg, kind) {
  const cls = kind || (mode === 'business' ? 'business' : 'place')
  statusEl.className = 'status ' + cls
  statusEl.textContent = msg
}

function showBubble(text, at = null, tone = null) {
  bubbleAnchor = at
  bubbleTextEl.textContent = text
  // 战斗气泡（带 at 锚点）在左上角显示当前说话客人的小头像
  bubbleAvatarEl.hidden = !at
  if (at) {
    bubbleAvatarEl.src = charAvatarDataURL(
      guest ? guest.variant : GUEST_VARIANT[order] || 'knight',
    )
  }
  bubbleEl.className = 'bubble' + (tone ? ' tone-' + tone : '')
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
  const H = parent ? parent.clientHeight : ROWS * 32
  const w = bubbleEl.offsetWidth || 200
  const h = bubbleEl.offsetHeight || 30
  let cxPx = ((pos.x + 0.5) / COLS) * W
  // 水平收进画布内：二单右侧也别被裁掉
  const minX = w / 2 + 4
  const maxX = W - w / 2 - 4
  if (cxPx < minX) cxPx = minX
  if (cxPx > maxX) cxPx = maxX

  const topAnchor = (pos.y / ROWS) * H
  let below = false
  let anchorY = topAnchor
  if (bubbleAnchor) {
    // 战斗/固定锚点气泡放在锚点下方，避开锤头和角色
    below = true
  } else if (topAnchor - h - 8 < 2) {
    // 普通气泡贴到上沿时翻到人物脚下方
    below = true
    anchorY = ((pos.y + 1) / ROWS) * H
  }
  if (below && anchorY + 8 + h > H - 2) {
    if (!bubbleAnchor && topAnchor - h - 8 >= 2) {
      below = false
      anchorY = topAnchor
    } else {
      anchorY = Math.max(0, H - 8 - h - 2)
    }
  }
  bubbleEl.classList.toggle('tail-up', below)
  bubbleEl.style.left = cxPx + 'px'
  bubbleEl.style.top = (anchorY / H) * 100 + '%'
}

// 记录标题右侧的三件事进度：只反映本局真实事件，不是最终星级
function updateLogProgress() {
  const kinds = new Set(game.log.map((e) => e.kind))
  const chestShops = new Set(
    game.log.filter((e) => e.kind === 'chest' && e.shop).map((e) => e.shop),
  )
  const archiveSites = new Set(
    game.log.filter((e) => e.kind === 'archive' && e.site).map((e) => e.site),
  )
  const usedDoor =
    kinds.has('redDoor') || kinds.has('yellowDoor')
  const slots =
    order === 1
      ? [
          { done: kinds.has('chest'), label: '开箱' },
          { done: kinds.has('block'), label: '挡锤' },
          { done: kinds.has('badge'), label: '徽章' },
        ]
      : order === 3
        ? [
            { done: kinds.has('chest'), label: '开箱' },
            { done: kinds.has('block') || chestShops.size >= 2, label: '挡锤或第二箱' },
            { done: kinds.has('badge'), label: '徽章' },
          ]
        : order === 4
          ? [
              { done: kinds.has('gauge'), label: '水尺' },
              { done: kinds.has('bridge') || kinds.has('block'), label: '跨桥或挡锤' },
              { done: kinds.has('badge'), label: '徽章' },
            ]
          : order === 5
            ? [
                { done: archiveSites.size > 0, label: '取档案' },
                {
                  done: archiveSites.size >= 2 || (archiveSites.size > 0 && usedDoor),
                  label: '两档或近门',
                },
                { done: kinds.has('badge'), label: '徽章' },
              ]
            : order === 6
              ? [
                  { done: kinds.has('part'), label: '零件' },
                  { done: !kinds.has('pendulumHit'), label: '没被钟摆打到' },
                  { done: kinds.has('badge'), label: '徽章' },
                ]
              : order === 7
                ? [
                    { done: kinds.has('moss'), label: '苔火样本' },
                    { done: !kinds.has('patrol'), label: '避开巡卫' },
                    { done: kinds.has('badge'), label: '徽章' },
                  ]
        : [
            { done: kinds.has('safe') || kinds.has('supply'), label: '安全通行或绕路' },
            { done: kinds.has('block'), label: '挡锤' },
            { done: kinds.has('badge'), label: '徽章' },
          ]
  logStarEls.forEach((el, i) => {
    const slot = slots[i]
    el.textContent = slot.done ? '★' : '☆'
    el.classList.toggle('on', slot.done)
    el.title = slot.label + (slot.done ? '：已发生' : '：未发生')
  })
  const summary = slots
    .map((s) => `${s.label}${s.done ? '已发生' : '未发生'}`)
    .join('、')
  logProgressEl.title = `本单三件事进度：${summary}。不是最终星级，最终星级仍按评价单原规则结算。`
  logProgressEl.setAttribute(
    'aria-label',
    `本单三件事进度：${summary}。最终星级按评价单原规则结算。`,
  )
}

function makeLogEntry(entry, animate) {
  const li = document.createElement('li')
  li.className = 'log-entry' + (animate ? ' is-new' : '')
  const iconUrl = logIconDataURL(entry.kind)
  if (iconUrl) {
    const icon = document.createElement('img')
    icon.className = 'log-icon'
    icon.alt = ''
    icon.draggable = false
    icon.src = iconUrl
    li.appendChild(icon)
  }
  const text = document.createElement('span')
  text.className = 'log-text'
  text.textContent = entry.label
  li.appendChild(text)
  return li
}

function showLogWaiting() {
  logListEl.textContent = ''
  const li = document.createElement('li')
  li.className = 'log-waiting'
  const img = document.createElement('img')
  img.src = WAIT_LOG_ICON
  img.alt = ''
  img.draggable = false
  const text = document.createElement('span')
  text.textContent = '还没有记录 · 等客人出发'
  li.append(img, text)
  logListEl.appendChild(li)
}

function updateLogUI() {
  updateLogProgress()
  if (!game.log.length) {
    if (logShownOrder !== order || !logListEl.querySelector('.log-waiting')) {
      showLogWaiting()
    }
    runLogEl.classList.add('waiting')
    logShownOrder = order
    logShownCount = 0
    return
  }

  runLogEl.classList.remove('waiting')
  if (logShownOrder !== order || logShownCount > game.log.length) {
    // 换单或重开后的首次铺开：旧记录静态显示，不重放滑入
    logListEl.textContent = ''
    for (const entry of game.log) logListEl.appendChild(makeLogEntry(entry, false))
    logShownCount = game.log.length
  } else {
    // 只追加新增记录；已有节点保持原样
    const wait = logListEl.querySelector('.log-waiting')
    if (wait) wait.remove()
    for (let i = logShownCount; i < game.log.length; i++) {
      logListEl.appendChild(makeLogEntry(game.log[i], true))
    }
    logShownCount = game.log.length
  }
  logShownOrder = order
  logListEl.scrollTop = logListEl.scrollHeight
}

// ---------- 评价单 ----------

function clearReviewTimers() {
  for (const id of reviewTimers) clearTimeout(id)
  reviewTimers = []
}

function scheduleReview(fn, ms) {
  const id = setTimeout(() => {
    try {
      fn()
    } catch (e) {
      /* 单次演出失败不能阻断游戏 */
    }
  }, Math.max(0, ms))
  reviewTimers.push(id)
}

// 页签显示各单历史最高星；两单都五星时点亮认证
function updateBestUI() {
  const tabs = [
    [tab1, '首单 · 剑士', bestStars[1]],
    [tab2, '二单 · 机关迷', bestStars[2]],
    [tab3, '回声集市', bestStars[3]],
    [tab4, '潮汐蓄水厅', bestStars[4]],
    [tab5, '双锁档案库', bestStars[5]],
    [tab6, '钟摆工坊', bestStars[6]],
    [tab7, '苔火巡廊', bestStars[7]],
  ]
  for (const [el, base, best] of tabs) {
    el.textContent = base
    if (best > 0) {
      const span = document.createElement('span')
      span.className = 'tab-best'
      span.textContent = ` ★${best}`
      el.appendChild(span)
    }
    el.setAttribute(
      'aria-label',
      best > 0 ? `${base}，历史最高 ${best} 星` : `${base}，暂无历史星级`,
    )
  }
  certEl.hidden = !(bestStars[1] === 5 && bestStars[2] === 5)
}

// 首次点亮认证时的少量金色像素纸屑（减少动效时不放）
// 评价单已经打开时从票面上沿落下，窄屏也能看见；否则退到侧栏认证处
function playCertConfetti() {
  if (reducedMotion) return
  const onTicket = !reviewCard.hidden
  const rect = onTicket
    ? reviewReceiptEl.getBoundingClientRect()
    : certEl.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const layer = document.createElement('div')
  layer.className = 'cert-confetti-layer'
  layer.setAttribute('aria-hidden', 'true')
  const colors = ['#ffcd75', '#e8c97a', '#c9a24b', '#fff3c0']
  for (let i = 0; i < 14; i++) {
    const bit = document.createElement('span')
    bit.className = 'cert-confetti-bit'
    const spread = onTicket ? rect.width * 0.84 : rect.width * 0.7
    const left = onTicket ? rect.left + rect.width * 0.08 : rect.left + rect.width * 0.15
    bit.style.left = Math.round(left + Math.random() * spread) + 'px'
    const topBase = onTicket ? rect.top - 2 : rect.top + 4
    bit.style.top = Math.round(Math.max(4, topBase) + Math.random() * 8) + 'px'
    bit.style.background = colors[i % colors.length]
    bit.style.setProperty('--dx', Math.round((Math.random() * 2 - 1) * (onTicket ? 30 : 56)) + 'px')
    bit.style.setProperty('--dy', Math.round(28 + Math.random() * 38) + 'px')
    bit.style.setProperty('--delay', Math.round(Math.random() * 90) + 'ms')
    layer.appendChild(bit)
  }
  document.body.appendChild(layer)
  setTimeout(() => layer.remove(), 1100)
}

function recordBestStars(review) {
  if (!review || review.status !== 'rated' || !review.stars) return
  // 结算前先并入另一页面已写下的更高分，再只写本单自己的键
  mergeBestFromStorage()
  const wasCertified = bestStars[1] === 5 && bestStars[2] === 5
  saveOrderBestStars(order, review.stars)
  mergeBestFromStorage()
  updateBestUI()
  const certified = bestStars[1] === 5 && bestStars[2] === 5
  if (certified && !wasCertified && !certCelebrated) {
    certCelebrated = true
    saveCertSeen()
    playCertConfetti()
  } else if (certified && !certCelebrated) {
    // 已有认证但没记过庆祝：只补标记，不在刷新时重放纸屑
    certCelebrated = true
    saveCertSeen()
  }
}

function showReview() {
  clearReviewTimers()
  const r = buildReview(game.log, order)
  // 首单真的拿过五星后才收起上手引导；3/4 星回来仍按现状提示
  if (order === 1 && r.status === 'rated' && r.stars === 5) onboardingRetired = true
  const meta = REVIEW_META[order] || REVIEW_META[1]
  reviewTitle.textContent = meta.title

  // 右上角真实星级印章：先留空，最后一颗星落稳后再盖
  const sealText = { 5: '五星神店', 4: '瑕不掩瑜', 3: '差强人意' }[r.stars]
  reviewSealEl.className =
    'review-seal' + (r.status === 'incomplete' ? ' void' : '') + ' pending'
  reviewSealEl.innerHTML =
    r.status === 'incomplete' ? '预约<br>未完成' : sealText || '尚未评星'

  // 五颗独立星块：每 140ms 落一颗，每颗落墨约 200ms
  const DROP_MS = 280
  const STAR_GAP_MS = 140
  const STAR_INK_MS = 200
  const base = reducedMotion ? 0 : DROP_MS
  const awarded = r.status === 'rated' ? r.stars : 0
  reviewStars.textContent = ''
  reviewStars.setAttribute(
    'aria-label',
    awarded ? `${awarded} 颗星（共 5 颗）` : '预约未完成，没有星级',
  )
  for (let i = 0; i < 5; i++) {
    const chip = document.createElement('span')
    chip.className =
      'star-chip' +
      (i < awarded ? ' inked' : '') +
      (awarded === 5 && i === 4 ? ' gold' : '')
    chip.style.setProperty('--d', base + i * STAR_GAP_MS + 'ms')
    chip.setAttribute('aria-hidden', 'true')
    const ghost = document.createElement('span')
    ghost.className = 'star-ghost'
    ghost.textContent = '☆'
    const glyph = document.createElement('span')
    glyph.className = 'star-glyph'
    glyph.textContent = '★'
    chip.append(ghost, glyph)
    reviewStars.appendChild(chip)
  }

  reviewEvents.textContent = ''
  r.events.forEach((text, i) => {
    const kind = r.eventKinds ? r.eventKinds[i] : ''
    const setback =
      kind === 'hit' ||
      kind === 'shot' ||
      kind === 'pendulumHit' ||
      kind === 'patrol'
    const li = document.createElement('li')
    li.className = setback ? 'is-setback' : 'is-done'
    li.textContent = text
    reviewEvents.appendChild(li)
  })

  reviewCommentTextEl.textContent = r.comment ? '「' + r.comment + '」' : ''
  reviewSignEl.textContent = r.comment ? `（${meta.sign} 留）` : ''
  reviewSignEl.hidden = !r.comment
  reviewComment.hidden = !r.comment

  reviewMissing.textContent = ''
  for (const text of r.missing) {
    const li = document.createElement('li')
    li.textContent = text
    reviewMissing.appendChild(li)
  }
  reviewMissing.hidden = r.missing.length === 0

  // 首单四星接二单；之后每单三星起依次接下一单，第五单收尾
  const canNext =
    (order === 1 && r.status === 'rated' && r.stars >= 4) ||
    (order >= 2 && order <= 6 && r.status === 'rated' && r.stars >= 3)
  btnNext.hidden = !canNext
  btnNext.textContent =
    order === 2
      ? '接第三单'
      : order === 3
        ? '接第四单'
        : order === 4
          ? '接第五单'
          : order === 5
            ? '接第六单'
            : order === 6
              ? '接第七单'
              : '接下一单'

  reviewCard.hidden = false
  // 羊皮票从上方 16px 落下，约 0.28s
  reviewReceiptEl.classList.remove('is-dropping')
  void reviewReceiptEl.offsetWidth
  reviewReceiptEl.classList.add('is-dropping')

  // 票面已打开后再记录历史星：首次认证的彩纸才能从票上沿落下
  recordBestStars(r)

  // 每颗实得的星：落墨时一声木鱼，从 300 Hz 逐颗升 60 Hz
  for (let i = 0; i < awarded; i++) {
    scheduleReview(() => sfx.star(i), base + i * STAR_GAP_MS + 20)
  }
  // 最后一颗落稳后再盖章、响声；只响一次
  const stampDelay = awarded
    ? base + (awarded - 1) * STAR_GAP_MS + STAR_INK_MS + 50
    : base + 180
  scheduleReview(() => {
    reviewSealEl.classList.remove('pending')
    if (reviewStampPlayed) return
    reviewStampPlayed = true
    void reviewSealEl.offsetWidth
    reviewSealEl.classList.add('stamped')
    sfx.stamp()
  }, stampDelay)

  // 主按钮优先接下一单，否则再布置；聚焦后原生键位直接生效
  const primary = btnNext.hidden ? btnAgain : btnNext
  primary.focus({ preventScroll: true })
}

function hideReview() {
  reviewCard.hidden = true
  // 提前关票或重开：取消还没落下的星声与盖章
  clearReviewTimers()
  reviewReceiptEl.classList.remove('is-dropping')
}

function reviewPrimaryButton() {
  return btnNext.hidden ? btnAgain : btnNext
}

function triggerReviewPrimary() {
  if (reviewCard.hidden) return
  reviewPrimaryButton().click()
}

btnAgain.addEventListener('click', resetBusiness)

btnNext.addEventListener('click', () => {
  if (btnNext.hidden) return
  if (order === 1) {
    hideReview()
    resetBusiness()
    secondUnlocked = true
    setOrder(2)
    status('接下了第二单：机关迷。弩机已上膛，布置好再开门营业。')
    return
  }
  if (order === 2) {
    hideReview()
    resetBusiness()
    thirdUnlocked = true
    setOrder(3)
    status('接下了回声集市。先把客人要的宝箱和路引备好。')
    return
  }
  if (order === 3) {
    hideReview()
    resetBusiness()
    fourthUnlocked = true
    setOrder(4)
    status('接下了潮汐蓄水厅。桥板和其他道具共用预算，备好再开门。')
    return
  }
  if (order === 4) {
    hideReview()
    resetBusiness()
    fifthUnlocked = true
    setOrder(5)
    status('接下了双锁档案库。重块压对压板，两扇门和后门都看清再开门。')
    return
  }
  if (order === 5) {
    hideReview()
    resetBusiness()
    sixthUnlocked = true
    setOrder(6)
    status('接下了钟摆工坊。两条钟摆捷径、干净南道，止摆只有一次。')
    return
  }
  if (order === 6) {
    hideReview()
    resetBusiness()
    seventhUnlocked = true
    setOrder(7)
    status('接下了苔火巡廊。外廊可避开巡卫；古铃能把他引去一侧。')
  }
})

// 评价单打开时：Enter / 空格 / 点遮罩空白处走主按钮；已聚焦的票内按钮保持原生键位
reviewCard.addEventListener('click', (e) => {
  if (e.target === reviewCard) triggerReviewPrimary()
})

window.addEventListener('keydown', (e) => {
  if (reviewCard.hidden) return
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
  if (e.repeat) return
  const active = document.activeElement
  if (active && reviewCard.contains(active) && active.tagName === 'BUTTON') return
  if (active && active !== document.body && typeof active.blur === 'function') active.blur()
  e.preventDefault()
  triggerReviewPrimary()
})

// 按真实 planRoute 生成脚印序列、事件标记和未经过的盾架
function buildRoute(g) {
  const plan = planRoute(g, order)
  const raw = []
  const markers = []
  let pickedShield = false
  let endTile = null
  const push = (p) => {
    const last = raw[raw.length - 1]
    if (last && last.x === p.x && last.y === p.y) return
    raw.push({ x: p.x, y: p.y })
  }
  if (plan) {
    for (const a of plan.actions) {
      if (a.type === 'move') {
        for (const p of a.path) push(p)
        endTile = a.path[a.path.length - 1]
      } else if (a.type === 'open') {
        markers.push({ kind: 'chest', x: a.x, y: a.y })
      } else if (a.type === 'pickupShield') {
        markers.push({ kind: 'shield', x: a.x, y: a.y })
        pickedShield = true
      } else if (a.type === 'trap') {
        if (a.stop) push(a.stop)
        if (a.beam) {
          push(a.beam)
          markers.push({ kind: 'trap', x: a.beam.x, y: a.beam.y })
        }
        if (a.far) push(a.far)
        if (!pickedShield) {
          const shieldAt = (t) => {
            if (!t) return null
            const item = g.items.get(tileKey(t.x, t.y))
            return item && item.type === 'shield' && !item.taken ? t : null
          }
          const found = shieldAt(a.beam) || shieldAt(a.far)
          if (found) {
            markers.push({ kind: 'shield', x: found.x, y: found.y })
            pickedShield = true
          }
        }
      }
    }
    if (endTile) markers.push({ kind: 'end', x: endTile.x, y: endTile.y })
  }

  const counts = new Map()
  for (const t of raw) {
    const k = tileKey(t.x, t.y)
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  const tiles = raw.map((t, i) => {
    const k = tileKey(t.x, t.y)
    let dx = 0
    let dy = 0
    if (i > 0) {
      dx = Math.sign(t.x - raw[i - 1].x)
      dy = Math.sign(t.y - raw[i - 1].y)
    } else if (raw.length > 1) {
      dx = Math.sign(raw[1].x - t.x)
      dy = Math.sign(raw[1].y - t.y)
    }
    // 重复经过的格子按行进方向的左侧分道，去程/回程自然落到两侧
    const lane = (counts.get(k) || 0) > 1 && (dx || dy) ? 4 : 0
    return { x: t.x, y: t.y, ox: -dy * lane, oy: dx * lane }
  })

  const visited = new Set(raw.map((t) => tileKey(t.x, t.y)))
  const offRouteShields = []
  for (const item of g.items.values()) {
    if (item.type === 'shield' && !visited.has(tileKey(item.x, item.y))) {
      offRouteShields.push({ x: item.x, y: item.y })
    }
  }
  return { tiles, markers, offRouteShields }
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
  footprintPreview = buildRoute(sim)
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

// 正篇第四/五图的特殊落点：桥板只上桥位，重块只上压板
function specialPlaceReason(type, x, y, ignoreKey = null) {
  const base = placeReason(game, x, y, ignoreKey)
  if (order === 4) {
    const slot = TIDE.bridgeSlots.has(tileKey(x, y))
    if (type === 'bridge') {
      if (!slot) return 'bridge-slot'
      if (base !== 'ok') return base
      const other = [...game.items.values()].some(
        (it) =>
          it.type === 'bridge' &&
          it.y === y &&
          tileKey(it.x, it.y) !== ignoreKey,
      )
      return other ? 'bridge-taken' : 'ok'
    }
    if (slot) return 'bridge-slot'
  }
  if (order === 5 && type === 'weight') {
    if (!ARCHIVE.plates.some((p) => p.x === x && p.y === y)) return 'weight-plate'
  }
  if (order === 6) {
    if (PENDULUM.parts.some((p) => p.x === x && p.y === y)) return 'part-spot'
  }
  if (order === 7) {
    const slot = MOSS.bells.some((b) => b.x === x && b.y === y)
    if (type === 'bell') {
      if (!slot) return 'bell-slot'
      return base
    }
    if (slot) return 'bell-slot'
  }
  return base
}

function updateHUD() {
  // 只给真实收支做动效：移动/取消/拖错余额不变，换单只换数字
  const prev = shownGold[order]
  if (typeof prev === 'number' && prev !== game.gold) triggerGoldFx(game.gold - prev)
  shownGold[order] = game.gold
  goldEl.textContent = game.gold
  const chestLocked = order === 2
  const visible =
    order === 7
      ? { shield: true, sign: true, barrier: true, bell: true }
      : order === 6
        ? { shield: true, sign: true, barrier: true }
        : order === 5
          ? { shield: true, sign: true, barrier: true, weight: true }
          : order === 4
            ? { shield: true, sign: true, barrier: true, bridge: true }
            : order === 3
              ? { chest: true, shield: true, sign: true, barrier: true }
              : { chest: true, shield: true, sign: true }
  for (const el of cardEls) el.hidden = !visible[el.dataset.type]
  updateCardCopy()
  for (const el of cardEls) {
    const locked = chestLocked && el === chestCardEl
    el.classList.toggle('locked', locked)
    el.dataset.locked = locked ? '1' : '0'
    el.setAttribute('aria-disabled', locked ? 'true' : 'false')
    el.classList.toggle(
      'disabled',
      !locked && (mode !== 'setup' || game.gold < ITEMS[el.dataset.type].price),
    )
  }
  chestCardSealEl.hidden = !chestLocked
  chestCardEl.title = chestLocked
    ? '机关迷不翻宝箱，本单不可购买'
    : '按住拖到地图空地砖'
  btnOpen.disabled = mode !== 'setup'
  updateTrapButton()
  updateSwingButton()
  updateOnboarding()
  // 布置期的真实路线脚印；营业后收起
  footprintsBase = mode === 'setup' ? buildRoute(game) : null
  if (mode !== 'setup') clearFootprintPreview()
}

function setSpeed(n) {
  speed = n
  spd1El.classList.toggle('active', n === 1)
  spd2El.classList.toggle('active', n === 2)
}

function updateTrapButton() {
  // 还没解锁二单时，首单预约卡不留空白拉闸行；解锁后两单同高
  trapSlotEl.hidden = !secondUnlocked
  // 布置期也把待命条留在预约区：二单玩家开门前就知道可以走近路拉闸
  const show = secondUnlocked && order === 2 && (mode === 'setup' || runHasTrap)
  btnTrap.hidden = !show
  if (!show) {
    btnTrap.classList.remove('armed', 'timing', 'standby')
    btnTrap.disabled = true
    trapTimerFillEl.style.transform = 'scaleX(0)'
    return
  }
  const armed =
    mode === 'business' && crossbow.windowOpen && crossbow.mode === 'warning' && !crossbow.used
  btnTrap.disabled = !armed
  btnTrap.classList.toggle('armed', armed)
  btnTrap.classList.toggle('timing', armed)
  btnTrap.classList.toggle('standby', mode === 'setup')
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

function updateSwingButton() {
  btnSwing.hidden = order !== 6
  if (order !== 6) {
    btnSwing.classList.remove('armed', 'timing', 'standby')
    btnSwing.disabled = true
    swingTimerFillEl.style.transform = 'scaleX(0)'
    return
  }
  const warning = mode === 'business' && !!swingWarn
  const armed = warning && !swingUsed && !swingWarn.pressed
  btnSwing.disabled = !armed
  btnSwing.classList.toggle('armed', armed)
  btnSwing.classList.toggle('timing', armed)
  btnSwing.classList.toggle('standby', mode === 'setup')
  if (!armed) swingTimerFillEl.style.transform = 'scaleX(0)'
  let label = '钟摆待命 · 全局一次止摆'
  if (mode === 'business') {
    if (swingUsed) label = '止摆已用'
    else if (warning) label = '止摆停住钟摆'
    else label = '钟摆待命 · 走过才预警'
  }
  swingLabelEl.textContent = label
}

function setOrder(n) {
  if (mode !== 'setup') return
  order = n
  game = games[n]
  base = bases[n]
  currentMap = MAP_DEFS[n]
  window.__game = game
  clearGoldFx()
  doorOpen = 0
  doorTween = null
  resetGearSpin()
  footDust = []
  lastGuestTile = null
  hoverItem = null
  invalidFlash = null
  clearFootprintPreview()
  pop = null
  skeleton.x = currentMap.skeleton.x
  skeleton.y = currentMap.skeleton.y
  const info = ORDER_INFO[order]
  guestTitleEl.textContent = info.title
  guestQuoteTextEl.innerHTML = info.quote
  const variant = GUEST_VARIANT[order] || 'knight'
  guestAvatarEl.src = charAvatarDataURL(variant)
  avatarFrameEl.className = 'avatar-frame ' + variant
  orderTabs.hidden = !secondUnlocked
  galleryTitleEl.hidden = !secondUnlocked
  ledgerDividerEl.hidden = secondUnlocked
  tab3.hidden = !thirdUnlocked
  tab4.hidden = !fourthUnlocked
  tab5.hidden = !fifthUnlocked
  tab6.hidden = !sixthUnlocked
  tab7.hidden = !seventhUnlocked
  tab1.classList.toggle('active', order === 1)
  tab2.classList.toggle('active', order === 2)
  tab3.classList.toggle('active', order === 3)
  tab4.classList.toggle('active', order === 4)
  tab5.classList.toggle('active', order === 5)
  tab6.classList.toggle('active', order === 6)
  tab7.classList.toggle('active', order === 7)
  status(
    order === 7
      ? '外廊可避开巡卫；古铃能把巡卫引到一侧，样本在内院。'
      : order === 6
        ? '两条钟摆捷径、干净南道和中间检修道；全局只有一次止摆。'
        : order === 5
      ? '空摆只取一份；路牌可从后门引到第二间；重块开近门后要真穿过去。'
      : order === 4
        ? '桥板拖到标出的桥位；客人先看水尺，再跨桥或带盾挡锤。'
        : order === 3
          ? '宝箱放进西铺或东铺；路牌插在罗盘岔口才引路，隔栅可挡路改道。'
          : order === 2
            ? '路牌放在岔口并朝上，客人就绕补给廊；其他方向走近路。'
            : '把道具拖到空地砖上摆放',
  )
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
  coachEl.classList.remove('arrow-down')
  coachEl.classList.toggle('arrow-right', arrowRight)
  coachEl.hidden = false
}

// 备齐提示：横排贴画布右边、与开门按钮同高并指右；竖排贴底边、对齐按钮并指下
function placeDoneCoach() {
  coachEl.hidden = false
  coachEl.classList.remove('arrow-right', 'arrow-down')
  const wrap = canvas.parentElement
  const wrapRect = wrap.getBoundingClientRect()
  const btnRect = btnOpen.getBoundingClientRect()
  const w = coachEl.offsetWidth || 190
  const h = coachEl.offsetHeight || 40
  if (portraitMedia.matches) {
    coachEl.classList.add('arrow-down')
    const centerX = btnRect.left + btnRect.width / 2 - wrapRect.left
    const left = Math.max(8, Math.min(wrap.clientWidth - w - 8, centerX - w / 2))
    coachEl.style.left = left + 'px'
    coachEl.style.top = wrap.clientHeight - h / 2 - 10 + 'px'
  } else {
    coachEl.classList.add('arrow-right')
    const targetY = btnRect.top + btnRect.height / 2 - wrapRect.top
    coachEl.style.left = Math.max(8, wrap.clientWidth - w - 8) + 'px'
    coachEl.style.top =
      Math.max(h / 2 + 8, Math.min(wrap.clientHeight - h / 2 - 8, targetY)) + 'px'
  }
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

function setOpenSuggested(suggested) {
  btnOpen.classList.toggle('suggest', suggested)
  btnOpen.textContent = suggested ? '开门营业（建议先摆道具）' : '开门营业'
}

function updateOnboarding() {
  btnOpen.classList.remove('ready')
  setOpenSuggested(false)
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
  if (order === 3) {
    // 正篇：铺面宝箱 + 罗盘岔口 + 隔栅
    onbStep = 'route'
    if (!planRoute(game, 3)) {
      guideState = null
      setCoach('隔栅封死了去挑战房的路，先挪开或收回一格再开门。', 37, 55)
    } else {
      guideState = { room: null, tile: { x: 11, y: 12 } }
      setCoach(
        '宝箱放进西铺或东铺；路牌插在带罗盘的岔口才会引路，隔栅可挡路改道。',
        36,
        58,
      )
    }
    return
  }
  if (order === 4) {
    onbStep = 'route'
    if (!planRoute(game, 4)) {
      guideState = null
      setCoach('隔栅封死了去挑战房的路，先挪开或收回一格再开门。', 37, 55)
    } else {
      guideState = { room: null, tile: { x: 7, y: 10 } }
      setCoach('桥板拖到标出的桥位；先到水尺，再跨桥或带盾挡锤。', 36, 58)
    }
    return
  }
  if (order === 5) {
    onbStep = 'route'
    if (!planRoute(game, 5)) {
      guideState = null
      setCoach('去挑战房的路被隔栅封死了，先挪开再开门。', 37, 55)
    } else {
      guideState = { room: null, tile: { x: 4, y: 8 } }
      setCoach(
        '空摆只取一份；路牌从后门引到另一间会多取；开近门并实际穿过也五星。',
        33,
        58,
      )
    }
    return
  }
  if (order === 6) {
    onbStep = 'route'
    if (!planRoute(game, 6)) {
      guideState = null
      setCoach('隔栅封死了去挑战房的路，先挪开再开门。', 37, 55)
    } else {
      guideState = { room: null, tile: { x: 11, y: 7 } }
      setCoach('两条钟摆捷径、干净南道；钟摆只停一次，走过才会预警。', 35, 58)
    }
    return
  }
  if (order === 7) {
    onbStep = 'route'
    if (!planRoute(game, 7)) {
      guideState = null
      setCoach('隔栅封死了去挑战房的路，先挪开再开门。', 37, 55)
    } else {
      guideState = { room: null, tile: { x: MOSS.sample.x, y: MOSS.sample.y } }
      setCoach('外廊避开巡卫；要取样本，先挂古铃把巡卫引到另一侧。', 34, 58)
    }
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
    setOpenSuggested(true)
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
    setOpenSuggested(true)
    return
  }

  onbStep = 'done'
  guideState = null
  btnOpen.classList.add('ready')
  coachTextEl.textContent = '两件都备好了，点「开门营业」迎客。'
  placeDoneCoach()
}

function trySwitchOrder(n) {
  if (mode !== 'setup') {
    status('营业中不能换单')
    return
  }
  if (n === 2 && !secondUnlocked) return
  if (n === 3 && !thirdUnlocked) return
  if (n === 4 && !fourthUnlocked) return
  if (n === 5 && !fifthUnlocked) return
  if (n === 6 && !sixthUnlocked) return
  if (n === 7 && !seventhUnlocked) return
  setOrder(n)
}

tab1.addEventListener('click', () => trySwitchOrder(1))
tab2.addEventListener('click', () => trySwitchOrder(2))
tab3.addEventListener('click', () => trySwitchOrder(3))
tab4.addEventListener('click', () => trySwitchOrder(4))
tab5.addEventListener('click', () => trySwitchOrder(5))
tab6.addEventListener('click', () => trySwitchOrder(6))
tab7.addEventListener('click', () => trySwitchOrder(7))

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
  if (gearFreezePhase == null && order === 2) {
    gearFreezePhase = lastGearPhase
  }
  crossbow.used = true
  crossbow.pressed = true
  updateTrapButton()
})

// 钟摆止摆：只在实际预警窗口内、全局一次
btnSwing.addEventListener('click', () => {
  if (order !== 6 || mode !== 'business' || swingUsed || !swingWarn) return
  if (performance.now() - swingWarn.startReal >= swingWarn.ms) return
  swingUsed = true
  swingWarn.pressed = true
  updateSwingButton()
})

// ---------- 营业 / 重新布置 ----------

const DOOR_OPEN_MS = 520
const DOOR_CLOSE_MS = 380

function setDoor(target, duration) {
  if (order !== 1) {
    doorOpen = 0
    doorTween = null
    return
  }
  if (reducedMotion) {
    doorOpen = target
    doorTween = null
    return
  }
  if (!doorTween && doorOpen === target) return
  doorTween = {
    from: doorOpen,
    to: target,
    start: performance.now(),
    ms: duration,
  }
}

function resetGearSpin() {
  gearSpinStart = performance.now()
  gearFreezePhase = null
}

function currentGearPhase(now) {
  return Math.floor((now - gearSpinStart) / 600) % 8
}

function startBusiness() {
  if (mode !== 'setup') return
  const plan = planRoute(game, order)
  if (!plan) {
    status(
      order === 6
        ? '隔栅把工坊的路封死了，先挪开或收回一格再开门。'
        : order === 7
          ? '隔栅把巡廊的路封死了，先挪开或收回一格再开门。'
          : order === 4
            ? '桥位和干路都走不通，或隔栅封住了必经路，先调整再开门。'
            : order === 5
              ? '隔栅把去挑战房的路封死了，先挪开或收回一格再开门。'
              : order === 3
                ? '隔栅封死了去挑战房的路，先挪开或收回一格再开门。'
                : '客人找不到去挑战房的路',
      'fail',
    )
    return
  }
  runHasTrap = plan.actions.some((a) => a.type === 'trap')
  swingUsed = false
  swingWarn = null
  swingStopped = new Set()
  setDoor(1, DOOR_OPEN_MS)
  pending = null
  drag = null
  hoverItem = null
  invalidFlash = null
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
    variant: GUEST_VARIANT[order] || 'knight',
    facing: 'down',
    walkPhase: 0,
    moving: false,
  }
  walker = { actions: plan.actions, i: 0, actionStart: simT }
  footDust = []
  lastGuestTile = null
  skeleton.pose = 'idle'
  fx = null
  stagger = null
  badgeFly = null
  spark = null
  reviewStampPlayed = false
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
  clearGoldFx()
  resetGearSpin()
  setDoor(0, DOOR_CLOSE_MS)
  footDust = []
  lastGuestTile = null
  hoverItem = null
  invalidFlash = null
  pop = null
  clearFootprintPreview()
  skeleton.pose = 'idle'
  fx = null
  stagger = null
  badgeFly = null
  spark = null
  reviewStampPlayed = false
  crossbow.mode = 'idle'
  crossbow.used = false
  crossbow.pressed = false
  crossbow.boltStart = 0
  crossbow.windowOpen = false
  crossbow.warnStart = 0
  alarmEl.hidden = true
  btnTrap.classList.remove('timing')
  trapTimerFillEl.style.transform = 'scaleX(0)'
  swingUsed = false
  swingWarn = null
  swingStopped = new Set()
  btnSwing.classList.remove('armed', 'timing', 'standby')
  swingTimerFillEl.style.transform = 'scaleX(0)'
  runHasTrap = true
  game.badgeTaken = false
  game.takenArchives.clear()
  game.takenParts.clear()
  game.takenMoss = false
  restoreItems(game)
  game.log.length = 0
  updateLogUI()
  status('已重新布置：摆法保留，宝箱与盾牌恢复原状。')
  updateHUD()
}

btnOpen.addEventListener('click', startBusiness)
btnReset.addEventListener('click', resetBusiness)

// ---------- 行走播放器 ----------

function startGuestGesture(kind, ms, at) {
  if (!guest) return
  guest.gesture = { kind, start: at, ms }
}

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
// tile 是脚下的格子，walkClock 是当前行走时钟（模拟时间），两者不能混用
function tryPickupAt(tile, walkClock) {
  if (!guest || guest.hasShield) return false
  const item = game.items.get(tileKey(tile.x, tile.y))
  if (!item || item.type !== 'shield' || item.taken) return false
  item.taken = true
  guest.hasShield = true
  addLog(game, 'shield')
  updateLogUI()
  showBubble('正好用得上！')
  startGuestGesture('shield', 600, walkClock)
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
        addLog(
          game,
          'chest',
          a.shop
            ? {
                shop: a.shop,
                label: a.shop === 'west' ? '打开西铺宝箱' : '打开东铺宝箱',
              }
            : null,
        )
        updateLogUI()
        sfx.chest()
        // 真开箱：抬臂展示 + 三粒星芒
        startGuestGesture('chest', 520, t)
        spark = { x: a.x, y: a.y, start: t, ms: 520 }
      }
      advanceWalker(t)
      continue
    }
    if (a.type === 'archive') {
      game.takenArchives.add(a.site)
      addLog(game, 'archive', {
        site: a.site,
        name: a.name,
        label: `取到${a.name}的档案`,
      })
      updateLogUI()
      sfx.chest()
      startGuestGesture('chest', 520, t)
      spark = { x: a.x, y: a.y, start: t, ms: 520 }
      advanceWalker(t)
      continue
    }
    if (a.type === 'part') {
      game.takenParts.add(a.site)
      addLog(game, 'part', { site: a.site, label: `取到${a.name}` })
      updateLogUI()
      sfx.chest()
      startGuestGesture('chest', 520, t)
      spark = { x: a.x, y: a.y, start: t, ms: 520 }
      advanceWalker(t)
      continue
    }
    if (a.type === 'moss') {
      game.takenMoss = true
      addLog(game, 'moss', { label: '取到苔火样本' })
      updateLogUI()
      sfx.chest()
      startGuestGesture('chest', 520, t)
      spark = { x: a.x, y: a.y, start: t, ms: 520 }
      advanceWalker(t)
      continue
    }
    if (a.type === 'patrol') {
      addLog(game, 'patrol', { label: '被巡卫撞见' })
      updateLogUI()
      showBubble('巡卫发现我了！', a.at || null, 'hurt')
      status('内院巡卫撞见了客人', 'fail')
      sfx.warn()
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
          startGuestGesture('shield', 800, t)
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
      startGuestGesture('badge', 820, t)
      sfx.badge()
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
          sfx.block()
        }
        if (a.kind === 'hit') sfx.hit()
        if (a.kind === 'slash') startGuestGesture('slash', a.ms, t)
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
    if (a.type === 'pendulum') {
      const SWING_MS = 2400
      if (swingStopped.has(a.id)) {
        advanceWalker(t)
        continue
      }
      if (!a.started) {
        a.started = true
        a.phase = 'warn'
        a.phaseStart = t
        swingWarn = {
          id: a.id,
          at: a.at,
          startReal: realT,
          ms: SWING_MS,
          pressed: false,
        }
        updateSwingButton()
        hideBubble()
        status(
          swingUsed ? '钟摆预警：止摆已用，只能硬挨' : '钟摆预警！2.4 秒内点「止摆」',
          swingUsed ? 'fail' : undefined,
        )
        sfx.warn()
      }
      if (a.phase === 'warn') {
        if (swingWarn && swingWarn.pressed) {
          addLog(game, 'pendulumStop')
          updateLogUI()
          swingStopped.add(swingWarn.id)
          sfx.block()
          status('钟摆停住了')
          a.phase = 'done'
          a.phaseStart = t
          swingWarn = null
          updateSwingButton()
        } else if (swingWarn && realT - swingWarn.startReal >= swingWarn.ms) {
          addLog(game, 'pendulumHit')
          updateLogUI()
          fx = { kind: 'hit', at: { x: guest.x, y: guest.y }, start: t, ms: 350 }
          stagger = { start: t, ms: 420 }
          sfx.hit()
          showBubble('钟摆扫过来了！', null, 'hurt')
          status('没来得及止摆，客人被钟摆扫到', 'fail')
          a.phase = 'done'
          a.phaseStart = t
          swingWarn = null
          updateSwingButton()
        }
        return
      }
      if (a.phase === 'done') {
        if (t - a.phaseStart >= 480) {
          advanceWalker(t)
          continue
        }
        return
      }
      advanceWalker(t)
      continue
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
        sfx.warn()
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
          if (tryPickupAt(enter, t)) a.crossPicked = true
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
          tryPickupAt(beamTile, t)
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
          sfx.shot()
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
          tryPickupAt(farTile, t)
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
  sfx.grab()
  const b = canvasBox()
  const offsetY = e.pointerType === 'touch' ? 28 : 0
  hoverItem = null
  invalidFlash = null
  ghost.classList.remove('is-bouncing')
  drag = {
    source,
    type,
    dir,
    px: e.clientX,
    py: e.clientY,
    offsetY,
    cellScreen: b.width / COLS,
    target: null,
    overShop: false,
  }
  ghostImg.src = itemDataURL(type, dir)
  setGhost(e.clientX, e.clientY - offsetY, drag.cellScreen)
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
  ghost.classList.remove('is-bouncing')
  void ghost.offsetWidth
  ghost.classList.add('is-bouncing')
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
    if (cardEl.dataset.locked === '1') {
      status('机关迷不翻宝箱，这张卡本单用不上。')
      return
    }
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

canvas.addEventListener('pointerleave', () => {
  hoverItem = null
})
window.addEventListener('pointermove', (e) => {
  if (mode !== 'setup') {
    hoverItem = null
    return
  }
  if (!pending && !drag) {
    // 鼠标悬停已放道具：只做视觉提示，不改变布置状态
    if (e.pointerType === 'touch') {
      hoverItem = null
    } else {
      const ht = tileAt(e.clientX, e.clientY)
      const hi = ht ? game.items.get(tileKey(ht.x, ht.y)) : null
      hoverItem = hi ? { x: hi.x, y: hi.y, type: hi.type } : null
    }
  }
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
    startDrag(src, item.type, item.dir, {
      clientX: e.clientX,
      clientY: e.clientY,
      pointerType: e.pointerType,
    })
  }
  if (!drag) return

  drag.px = e.clientX
  drag.py = e.clientY
  // 幽灵和落点一起上移；回收判断仍用手指真实位置
  setGhost(drag.px, drag.py - drag.offsetY, drag.cellScreen)
  drag.overShop = inSidebar(drag.px, drag.py)
  const refunding = drag.overShop && drag.source !== 'shop'
  sidebar.classList.toggle('drop-refund', refunding)
  dropHintEl.hidden = !refunding
  if (drag.overShop) {
    drag.target = null
    clearFootprintPreview()
    return
  }
  const t = tileAt(drag.px, drag.py - drag.offsetY)
  if (!t) {
    drag.target = null
    clearFootprintPreview()
    return
  }
  const ignore = drag.source === 'shop' ? null : tileKey(drag.source.x, drag.source.y)
  drag.target = {
    x: t.x,
    y: t.y,
    valid: specialPlaceReason(drag.type, t.x, t.y, ignore) === 'ok',
  }
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
      sfx.sign()
      status(`路牌顺时针转了 90°，现在朝${DIR_NAMES[dir]}`)
      updateHUD()
    }
    return
  }
  if (!drag) return

  hoverItem = null
  const d = drag
  drag = null
  invalidFlash = null
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
      sfx.refund()
      status(`收回${def.name}，退款 +${def.price} 金`)
    }
  } else if (d.target && d.target.valid) {
    if (d.source === 'shop') {
      placeFromShop(game, d.type, d.target.x, d.target.y)
      setPop(d.type, d.target.x, d.target.y, 0)
      sfx.land()
      status(`放下${def.name}，-${def.price} 金`)
    } else {
      const same = d.target.x === d.source.x && d.target.y === d.source.y
      moveItem(game, d.source, d.target)
      if (!same) {
        setPop(d.type, d.target.x, d.target.y, d.dir)
        sfx.land()
      }
      status(same ? `${def.name}留在原格` : `挪动${def.name}，不花金币`)
    }
    hideGhost()
  } else {
    const reason = d.target
      ? specialPlaceReason(
          d.type,
          d.target.x,
          d.target.y,
          d.source === 'shop' ? null : tileKey(d.source.x, d.source.y),
        )
      : 'offmap'
    startBounce(sourceAnchor)
    if (d.target) {
      invalidFlash = {
        x: d.target.x,
        y: d.target.y,
        start: performance.now(),
        ms: 150,
      }
    }
    sfx.reject()
    status(
      reason === 'wall'
        ? '弹回：墙上摆不了道具'
        : reason === 'occupied'
          ? '弹回：这格已有道具'
          : reason === 'reserved'
            ? '弹回：那是守卫或档案的固定位置'
            : reason === 'bridge-slot'
              ? '弹回：桥板只能搭在水道标出的整段桥位'
              : reason === 'bridge-taken'
                ? '弹回：这段桥位已经搭了桥板'
                : reason === 'weight-plate'
                  ? '弹回：重块只能压在红/黄压板上'
                  : reason === 'bell-slot'
                    ? '弹回：古铃只能挂在标出的两处铃位'
                    : reason === 'part-spot'
                      ? '弹回：零件点是固定目标'
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
  hoverItem = null
  startBounce(anchor)
  status('取消拖拽')
})
window.addEventListener('blur', () => {
  pending = null
  hoverItem = null
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

  // 首单铁门：真实时间缓动；减少动效时 setDoor 已直接落位
  if (doorTween && reducedMotion) {
    doorOpen = doorTween.to
    doorTween = null
  }
  if (doorTween) {
    const p = Math.min(1, Math.max(0, (realT - doorTween.start) / doorTween.ms))
    const e = p * p * (3 - 2 * p)
    doorOpen = doorTween.from + (doorTween.to - doorTween.from) * e
    if (p >= 1) {
      doorOpen = doorTween.to
      doorTween = null
    }
  }
  const gearPhase =
    order === 2
      ? reducedMotion
        ? 0
        : gearFreezePhase != null
          ? gearFreezePhase
          : currentGearPhase(realT)
      : null
  if (gearPhase != null) lastGearPhase = gearPhase

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

  // 人物实际动作：抬臂/横挥展示与整格脚尘
  let guestGestureScene = null
  if (guest && guest.gesture) {
    const el = t - guest.gesture.start
    if (el >= guest.gesture.ms) guest.gesture = null
    else {
      guestGestureScene = {
        kind: guest.gesture.kind,
        t: el,
        ms: guest.gesture.ms,
      }
    }
  }
  if (guest) {
    const gx = Math.round(guest.x)
    const gy = Math.round(guest.y)
    if (
      lastGuestTile &&
      (gx !== lastGuestTile.x || gy !== lastGuestTile.y) &&
      !reducedMotion
    ) {
      footDust.push({ x: guest.x, y: guest.y, start: realT })
    }
    lastGuestTile = { x: gx, y: gy }
  } else {
    lastGuestTile = null
  }
  if (footDust.length) {
    footDust = footDust.filter((d) => realT - d.start < 220)
  }
  const dustScene = footDust.length
    ? footDust.map((d) => ({ x: d.x, y: d.y, t: realT - d.start, ms: 220 }))
    : null
  let invalidScene = null
  if (invalidFlash) {
    const el = realT - invalidFlash.start
    if (el >= invalidFlash.ms) invalidFlash = null
    else {
      invalidScene = {
        x: invalidFlash.x,
        y: invalidFlash.y,
        t: el,
        ms: invalidFlash.ms,
      }
    }
  }

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
  const swingRemain =
    order === 6 && swingWarn
      ? Math.max(0, swingWarn.ms - (realT - swingWarn.startReal))
      : null
  const showTrapAlarm = trapRemain != null && crossbow.mode === 'warning'
  const showSwingAlarm = order === 6 && swingRemain != null
  if (showTrapAlarm || showSwingAlarm) {
    alarmEl.hidden = false
    if (showSwingAlarm) {
      alarmTextEl.textContent = swingUsed
        ? `钟摆预警 · 止摆已用 ${(swingRemain / 1000).toFixed(1)}s`
        : `钟摆预警 ${(swingRemain / 1000).toFixed(1)}s`
      const anchor = swingWarn.at
      alarmEl.style.left = (anchor.x / COLS) * 100 + '%'
      alarmEl.style.top = (anchor.y / ROWS) * 100 + '%'
    } else {
      alarmTextEl.textContent = `弩机预警 ${(trapRemain / 1000).toFixed(1)}s`
      const anchor =
        currentMap.alarm || { x: currentMap.crossbow.x + 2.5, y: currentMap.crossbow.y + 1.8 }
      alarmEl.style.left = (anchor.x / COLS) * 100 + '%'
      alarmEl.style.top = (anchor.y / ROWS) * 100 + '%'
    }
  } else if (!alarmEl.hidden) {
    alarmEl.hidden = true
  }
  // 进度条嵌在拉闸按钮下沿：满到空；收起时只动透明度与 transform，按钮高度不变
  trapTimerFillEl.style.transform = `scaleX(${trapRemain != null ? trapRemain / 4000 : 0})`
  if (order === 6) {
    swingTimerFillEl.style.transform = `scaleX(${
      swingRemain != null && !swingUsed ? swingRemain / swingWarn.ms : 0
    })`
    const swingSig = `${mode}|${order}|${swingUsed}|${!!swingWarn}`
    if (swingSig !== swingUiSig) {
      swingUiSig = swingSig
      updateSwingButton()
    }
    if (swingRemain != null && !swingUsed) {
      const label = `止摆停住钟摆 · ${(swingRemain / 1000).toFixed(1)}s`
      if (swingLabelEl.textContent !== label) swingLabelEl.textContent = label
    }
  }
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

  const tideBridges =
    order === 4
      ? [...game.items.entries()]
          .filter(([key, it]) => it.type === 'bridge' && key !== hiddenKey)
          .map(([, it]) => ({ x: it.x, y: it.y }))
      : null
  const archiveDoors =
    order === 5
      ? Object.fromEntries(
          ARCHIVE.doors.map((d) => {
            const k = tileKey(d.plate.x, d.plate.y)
            const it = game.items.get(k)
            return [d.id, !!(it && it.type === 'weight' && k !== hiddenKey)]
          }),
        )
      : null
  let mossPatrol = null
  if (order === 7) {
    const westBell = game.items.get(tileKey(MOSS.bells[0].x, MOSS.bells[0].y))
    const eastBell = game.items.get(tileKey(MOSS.bells[1].x, MOSS.bells[1].y))
    const west = !!(westBell && westBell.type === 'bell')
    const east = !!(eastBell && eastBell.type === 'bell')
    const side = west && !east ? 'north' : east && !west ? 'south' : 'center'
    const loop = MOSS.loops[side]
    const legMs = 850
    const frac = (realT / legMs) % loop.length
    const i0 = Math.floor(frac)
    const i1 = (i0 + 1) % loop.length
    const f = frac - i0
    const A = loop[i0]
    const B = loop[i1]
    mossPatrol = {
      side,
      pos: reducedMotion
        ? { x: loop[0].x, y: loop[0].y }
        : { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f },
      zone: mode === 'setup' ? mossThreatZone(side) : null,
    }
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
          gesture: guestGestureScene,
          hideBadge: !!badgeFlyScene, // 飞行期间只画飞的那枚，落地后才显示头顶徽章
        }
      : null,
    dust: dustScene,
    skeleton,
    fx,
    guide: guideState,
    torches: TORCHES_BY_ORDER[order],
    lamps: LAMPS_BY_ORDER[order],
    still: reducedMotion,
    door: order === 1 ? { open: doorOpen } : null,
    gearPhase,
    dragging: !!drag && mode === 'setup',
    forbidden: game.reserved,
    footprints:
      mode === 'setup' && (footprintPreview || footprintsBase)
        ? { ...(footprintPreview || footprintsBase), preview: !!footprintPreview }
        : null,
    hover: mode === 'setup' ? hoverItem : null,
    invalid: invalidScene,
    pop: popScene,
    bridges: tideBridges,
    doors: archiveDoors,
    archives: order === 5 ? game.takenArchives : null,
    pendulums:
      order === 6
        ? {
            list: PENDULUM.pendulums,
            activeId: swingWarn ? swingWarn.id : null,
            warning: !!swingWarn,
            stopped: swingStopped,
          }
        : null,
    parts: order === 6 ? game.takenParts : null,
    patrol: mossPatrol,
    moss: order === 7 ? { taken: game.takenMoss } : null,
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
            warnEdge:
              crossbow.mode === 'warning' && crossbow.windowOpen && !crossbow.used,
            warnRemain: trapRemain != null ? trapRemain : 0,
          }
        : null,
  })
  ctx.restore()
  requestAnimationFrame(frame)
}

// 用已存历史星恢复进度：后一关到过三星即可依次接下一单；
// 无存储时全为 0，照旧从首单流程解锁
if (bestStars[6] >= 3 || bestStars[7] > 0) seventhUnlocked = true
if (bestStars[5] >= 3 || bestStars[6] > 0 || seventhUnlocked) sixthUnlocked = true
if (bestStars[4] >= 3 || bestStars[5] > 0 || sixthUnlocked) fifthUnlocked = true
if (bestStars[3] >= 3 || bestStars[4] > 0 || fifthUnlocked) fourthUnlocked = true
if (bestStars[2] >= 3 || bestStars[3] > 0 || fourthUnlocked) thirdUnlocked = true
if (bestStars[1] >= 4 || bestStars[2] > 0 || thirdUnlocked) secondUnlocked = true

updateBestUI()
if (bestStars[1] === 5 && bestStars[2] === 5 && !certCelebrated) {
  // 已有认证但没有庆祝记录（旧存档/降级）：点亮即可，不在刷新时重放彩带
  certCelebrated = true
  saveCertSeen()
}
if (bestStars[1] === 5) onboardingRetired = true
orderTabs.hidden = !secondUnlocked
galleryTitleEl.hidden = !secondUnlocked
ledgerDividerEl.hidden = secondUnlocked
tab3.hidden = !thirdUnlocked
tab4.hidden = !fourthUnlocked
tab5.hidden = !fifthUnlocked
tab6.hidden = !sixthUnlocked
tab7.hidden = !seventhUnlocked
updateHUD()
updateLogUI()
requestAnimationFrame(frame)