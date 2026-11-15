import { COLS, ROWS, TILE, SCALE, ZONES, SIDE_LABELS, buildGrid } from './map.js'

const CELL = TILE * SCALE
const PX = 3 // 8x8 图案放大到 24x24

// 8x8 像素图案（统一 24x24 居中绘制）
const SPRITES = {
  chest: {
    rows: [
      '........',
      '.oooooo.',
      'oLLLLLLo',
      'oLLLLLLo',
      'oooooooo',
      'oBBggBBo',
      'oBBggBBo',
      '.oooooo.',
    ],
    colors: { o: '#1a1c2c', L: '#b13e53', B: '#ef7d57', g: '#ffcd75' },
  },
  // 开过的箱子：盖板立起、内部变暗、金锁消失
  chestOpen: {
    rows: [
      '.o....o.',
      '.o....o.',
      'oooooooo',
      'oKKKKKKo',
      'oBBBBBBo',
      'oBBBBBBo',
      'oBBBBBBo',
      '.oooooo.',
    ],
    colors: { o: '#1a1c2c', K: '#0f1020', B: '#ef7d57' },
  },
  shield: {
    rows: [
      '.oooooo.',
      'oSSSSSSo',
      'oSSggSSo',
      'oSSggSSo',
      'oSSSSSSo',
      '.oSSSSo.',
      '..oSSo..',
      '.rrrrrr.',
    ],
    colors: { o: '#1a1c2c', S: '#94b0c2', g: '#ffcd75', r: '#ef7d57' },
  },
  // 盾被拿走后：只剩架子
  shieldEmpty: {
    rows: [
      '........',
      '........',
      '........',
      '........',
      '........',
      '.o....o.',
      '..o..o..',
      '.rrrrrr.',
    ],
    colors: { o: '#1a1c2c', r: '#ef7d57' },
  },
  sign: {
    rows: [
      '...oo...',
      '..oAAo..',
      '.oAAAAo.',
      'oAAAAAAo',
      '...AA...',
      '...AA...',
      '...AA...',
      '...oo...',
    ],
    colors: { o: '#1a1c2c', A: '#ffcd75' },
  },
  // 新手剑士：钢盔 + 蓝甲 + 金徽章
  knight: {
    rows: [
      '..oooo..',
      '.oHHHHo.',
      '.oHEEHo.',
      '.oHHHHo.',
      '.oBBBBo.',
      '.oBggBo.',
      '.oBBBBo.',
      '..o..o..',
    ],
    colors: { o: '#1a1c2c', H: '#94b0c2', E: '#1a1c2c', B: '#3b5dc9', g: '#ffcd75' },
  },
  // 骷髅守卫
  skeleton: {
    rows: [
      '..oooo..',
      '.oWWWWo.',
      '.oWEWEo.',
      '.oWWWWo.',
      '..oWWo..',
      '.oWWWWo.',
      '.oWWWWo.',
      '..o..o..',
    ],
    colors: { o: '#1a1c2c', W: '#f4f4f4', E: '#1a1c2c' },
  },
}

function drawPattern(ctx, sprite) {
  for (let r = 0; r < sprite.rows.length; r++) {
    for (let c = 0; c < 8; c++) {
      const ch = sprite.rows[r][c]
      if (ch === '.') continue
      ctx.fillStyle = sprite.colors[ch]
      ctx.fillRect(c * PX, r * PX, PX, PX)
    }
  }
}

export function drawItem(ctx, type, ox, oy, dir = 0, opened = false, taken = false) {
  let sprite = SPRITES[type]
  if (type === 'chest' && opened) sprite = SPRITES.chestOpen
  if (type === 'shield' && taken) sprite = SPRITES.shieldEmpty
  if (!sprite) return
  ctx.save()
  ctx.translate(ox + CELL / 2, oy + CELL / 2)
  if (dir) ctx.rotate((dir * Math.PI) / 2) // 顺时针 90° * dir
  ctx.translate(-12, -12)
  drawPattern(ctx, sprite)
  ctx.restore()
}

// 客人：浮点格坐标；持盾/徽章画在盔甲旁与头顶；踉跄用 offsetY 抖动
export function drawGuest(ctx, guest) {
  const cx = (guest.x + 0.5) * CELL
  const cy = (guest.y + 0.5) * CELL + (guest.offsetY || 0)
  ctx.save()
  ctx.translate(cx - 12, cy - 12)
  drawPattern(ctx, SPRITES.knight)
  if (guest.hasShield) {
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(-17, 3, 9, 14)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(-16, 4, 7, 12)
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(-14, 8, 3, 3)
  }
  if (guest.hasBadge) {
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(-2, -23, 7, 7)
    ctx.fillStyle = '#ffcd75'
    ctx.fillRect(-1, -22, 5, 5)
    ctx.fillStyle = '#b13e53'
    ctx.fillRect(0, -21, 3, 3)
  }
  ctx.restore()
}

function drawHammer(ctx, pose) {
  if (pose === 'raise') {
    ctx.fillStyle = '#ef7d57'
    ctx.fillRect(17, -5, 3, 13)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(11, -15, 15, 8)
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(11, -15, 15, 2)
  } else if (pose === 'strike') {
    ctx.fillStyle = '#ef7d57'
    ctx.fillRect(-7, 14, 21, 3)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(-17, 9, 11, 13)
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(-17, 9, 3, 13)
  } else {
    ctx.fillStyle = '#ef7d57'
    ctx.fillRect(17, 5, 3, 15)
    ctx.fillStyle = '#94b0c2'
    ctx.fillRect(12, -1, 13, 7)
    ctx.fillStyle = '#1a1c2c'
    ctx.fillRect(12, -1, 13, 2)
  }
}

export function drawSkeleton(ctx, sx, sy, pose) {
  const cx = (sx + 0.5) * CELL
  const cy = (sy + 0.5) * CELL
  ctx.save()
  if (pose === 'down') {
    ctx.globalAlpha = 0.8
    ctx.translate(cx, cy)
    ctx.rotate(Math.PI / 2)
    ctx.translate(-12, -12)
    drawPattern(ctx, SPRITES.skeleton)
    ctx.restore()
    return
  }
  ctx.translate(cx - 12, cy - 12)
  drawPattern(ctx, SPRITES.skeleton)
  drawHammer(ctx, pose)
  ctx.restore()
}

// fx: { kind: 'strike'|'block'|'hit'|'slash', at: {x,y}, t, ms }
function drawFx(ctx, fx) {
  const p = Math.min(1, fx.t / fx.ms)
  const cx = (fx.at.x + 0.5) * CELL
  const cy = (fx.at.y + 0.5) * CELL
  ctx.save()
  ctx.globalAlpha = 1 - p
  ctx.lineCap = 'round'
  if (fx.kind === 'strike') {
    ctx.strokeStyle = '#ffcd75'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(cx + 16, cy - 24)
    ctx.lineTo(cx - 10, cy + 4)
    ctx.stroke()
  } else if (fx.kind === 'block') {
    ctx.strokeStyle = '#73eff7'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(cx - 2, cy, 20, Math.PI * 0.5, Math.PI * 1.5)
    ctx.stroke()
  } else if (fx.kind === 'hit') {
    ctx.strokeStyle = '#b13e53'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(cx - 16, cy - 16)
    ctx.lineTo(cx + 16, cy + 16)
    ctx.moveTo(cx + 16, cy - 16)
    ctx.lineTo(cx - 16, cy + 16)
    ctx.stroke()
  } else if (fx.kind === 'slash') {
    ctx.strokeStyle = '#f4f4f4'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(cx - 20, cy - 18)
    ctx.lineTo(cx + 18, cy + 16)
    ctx.moveTo(cx - 18, cy + 14)
    ctx.lineTo(cx + 20, cy - 14)
    ctx.stroke()
  }
  ctx.restore()
}

// 侧栏图标 / 拖拽幽灵用
export function itemDataURL(type, dir = 0) {
  const c = document.createElement('canvas')
  c.width = CELL
  c.height = CELL
  drawItem(c.getContext('2d'), type, 0, 0, dir)
  return c.toDataURL()
}

// 底图（地板 + 标签）只画一次，缓存离屏
export function makeBaseMap() {
  const c = document.createElement('canvas')
  c.width = COLS * CELL
  c.height = ROWS * CELL
  const ctx = c.getContext('2d')
  const grid = buildGrid()

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const zone = ZONES[grid[y][x]]
      ctx.fillStyle = zone.colors[(x + y) % 2]
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
    }
  }

  ctx.font = 'bold 15px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const labels = []
  for (const key of ['entrance', 'corridor', 'challenge']) {
    const z = ZONES[key]
    labels.push({ text: z.name, x: z.label.x * CELL, y: z.label.y * CELL })
  }
  for (const p of SIDE_LABELS) {
    labels.push({ text: ZONES.side.name, x: p.x * CELL, y: p.y * CELL })
  }
  for (const l of labels) {
    ctx.lineWidth = 4
    ctx.strokeStyle = '#1a1c2c'
    ctx.strokeText(l.text, l.x, l.y)
    ctx.fillStyle = '#f4f4f4'
    ctx.fillText(l.text, l.x, l.y)
  }
  return c
}

// highlight: { x, y, valid } | null
// hiddenKey: 拖拽中的道具原格 key，跳过绘制（避免与幽灵重影）
// scene: { guest, skeleton, fx } | null
export function renderScene(ctx, base, game, highlight, hiddenKey = null, scene = null) {
  ctx.drawImage(base, 0, 0)
  for (const [key, item] of game.items) {
    if (key === hiddenKey) continue
    drawItem(ctx, item.type, item.x * CELL, item.y * CELL, item.dir, item.opened, item.taken)
  }
  if (scene && scene.skeleton) {
    drawSkeleton(ctx, scene.skeleton.x, scene.skeleton.y, scene.skeleton.pose)
  }
  if (scene && scene.guest) drawGuest(ctx, scene.guest)
  if (scene && scene.fx) drawFx(ctx, scene.fx)
  if (highlight) {
    ctx.lineWidth = 3
    ctx.strokeStyle = highlight.valid ? '#a7f070' : '#b13e53'
    ctx.strokeRect(
      highlight.x * CELL + 2,
      highlight.y * CELL + 2,
      CELL - 4,
      CELL - 4,
    )
  }
}