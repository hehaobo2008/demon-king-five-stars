// 原生合成短音效：无外部音频文件；AudioContext 只在交互后创建。
// 任何音频不可用的情况都静默降级，不阻塞游戏。

const STORAGE_KEY = 'demon-king-five-stars:muted'
const BASE_VOLUME = 0.22

function readMuted() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch (e) {
    return false
  }
}

let muted = readMuted()
let ctx = null
let master = null
let failed = false
let noiseBuffer = null

function persistMute() {
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0')
  } catch (e) {
    /* 无痕模式或存储不可用时只影响记忆，不影响本次开关 */
  }
}

function ensureContext() {
  if (failed) return null
  try {
    if (ctx && ctx.state === 'closed') {
      ctx = null
      master = null
    }
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) {
        failed = true
        return null
      }
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : BASE_VOLUME
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch (e) {
    failed = true
    return null
  }
}

function applyVolume() {
  if (!ctx || !master) return
  try {
    const t = ctx.currentTime
    master.gain.cancelScheduledValues(t)
    master.gain.setTargetAtTime(muted ? 0 : BASE_VOLUME, t, 0.012)
  } catch (e) {
    /* 音量节点失效时保持静默 */
  }
}

function setMuted(value) {
  muted = !!value
  persistMute()
  if (!muted) ensureContext()
  applyVolume()
}

function getNoise(ac) {
  if (noiseBuffer && noiseBuffer.sampleRate === ac.sampleRate) return noiseBuffer
  const len = Math.max(1, Math.floor(ac.sampleRate * 0.4))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  noiseBuffer = buf
  return buf
}

function tone(ac, opts) {
  const {
    f0 = 440,
    f1 = f0,
    dur = 0.08,
    type = 'square',
    gain = 0.2,
    delay = 0,
    detune = 0,
  } = opts
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.detune.value = detune
  osc.frequency.setValueAtTime(Math.max(20, f0), t0)
  if (f1 !== f0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur)
  }
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}

function hiss(ac, opts) {
  const { dur = 0.04, gain = 0.1, delay = 0, freq = 1200, q = 0.9 } = opts
  const t0 = ac.currentTime + delay
  const src = ac.createBufferSource()
  src.buffer = getNoise(ac)
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = q
  const g = ac.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(filter)
  filter.connect(g)
  g.connect(master)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

// 挨锤 / 中箭：160 Hz 急降到 45 Hz 的闷响，外加一小把短噪声
function muffledThud(ac) {
  tone(ac, { f0: 160, f1: 45, dur: 0.2, type: 'triangle', gain: 0.58 })
  tone(ac, { f0: 92, f1: 40, dur: 0.16, type: 'sine', gain: 0.3, delay: 0.006 })
  hiss(ac, { dur: 0.055, gain: 0.1, freq: 280, q: 0.55 })
}

function play(fn) {
  if (muted) return
  const ac = ensureContext()
  if (!ac) return
  try {
    fn(ac)
  } catch (e) {
    /* 音频节点异常也不能中断游戏 */
  }
}

export const sfx = {
  unlock() {
    if (!muted) ensureContext()
  },
  isMuted() {
    return muted
  },
  setMuted(value) {
    setMuted(value)
  },
  toggle() {
    setMuted(!muted)
    return muted
  },

  // 抓起 / 拖起：短促上挑的木质小方波
  grab() {
    play((ac) => {
      tone(ac, { f0: 330, f1: 620, dur: 0.07, type: 'square', gain: 0.16 })
      tone(ac, { f0: 720, f1: 520, dur: 0.05, type: 'square', gain: 0.1, delay: 0.045 })
    })
  },

  // 木块落地：低频闷响加一点木屑噪声
  land() {
    play((ac) => {
      tone(ac, { f0: 180, f1: 72, dur: 0.1, type: 'triangle', gain: 0.5 })
      hiss(ac, { dur: 0.03, gain: 0.1, freq: 680 })
    })
  },

  // 路牌转动：两下短促的木棘轮
  sign() {
    play((ac) => {
      tone(ac, { f0: 700, f1: 940, dur: 0.05, type: 'square', gain: 0.17 })
      tone(ac, { f0: 980, f1: 730, dur: 0.07, type: 'square', gain: 0.16, delay: 0.06 })
    })
  },

  // 开箱：三音小调加一点高光
  chest() {
    play((ac) => {
      tone(ac, { f0: 523, f1: 523, dur: 0.11, type: 'square', gain: 0.15 })
      tone(ac, { f0: 659, f1: 659, dur: 0.11, type: 'square', gain: 0.15, delay: 0.09 })
      tone(ac, { f0: 784, f1: 784, dur: 0.13, type: 'square', gain: 0.15, delay: 0.18 })
      tone(ac, { f0: 1046, f1: 1318, dur: 0.1, type: 'triangle', gain: 0.09, delay: 0.3 })
    })
  },

  // 挡锤：金属高频与短噪声
  block() {
    play((ac) => {
      tone(ac, { f0: 920, f1: 640, dur: 0.16, type: 'square', gain: 0.2 })
      tone(ac, { f0: 1380, f1: 1040, dur: 0.14, type: 'triangle', gain: 0.12, delay: 0.008 })
      hiss(ac, { dur: 0.035, gain: 0.09, freq: 3200, q: 0.7 })
    })
  },

  // 挨锤 / 中箭：同一种低压闷响
  hit() {
    play(muffledThud)
  },
  shot() {
    play(muffledThud)
  },

  // 徽章四音：523 / 659 / 784 / 1046 Hz
  badge() {
    play((ac) => {
      const notes = [523, 659, 784, 1046]
      notes.forEach((f, i) => {
        tone(ac, {
          f0: f,
          f1: f,
          dur: i === 3 ? 0.22 : 0.11,
          type: 'triangle',
          gain: i === 3 ? 0.17 : 0.13,
          delay: i * 0.09,
        })
      })
    })
  },

  // 弩机预警：两声短滴答
  warn() {
    play((ac) => {
      tone(ac, { f0: 1180, f1: 1060, dur: 0.032, type: 'square', gain: 0.13 })
      tone(ac, { f0: 1180, f1: 1060, dur: 0.032, type: 'square', gain: 0.13, delay: 0.12 })
    })
  },

  // 退款：1200 / 1600 Hz 两声金币
  refund() {
    play((ac) => {
      tone(ac, { f0: 1200, f1: 1200, dur: 0.06, type: 'triangle', gain: 0.14 })
      tone(ac, { f0: 1600, f1: 1600, dur: 0.08, type: 'triangle', gain: 0.12, delay: 0.065 })
    })
  },

  // 非法弹回：220 / 150 Hz 低木声
  reject() {
    play((ac) => {
      tone(ac, { f0: 220, f1: 190, dur: 0.1, type: 'triangle', gain: 0.34 })
      tone(ac, { f0: 150, f1: 120, dur: 0.13, type: 'sine', gain: 0.24, delay: 0.09 })
      hiss(ac, { dur: 0.025, gain: 0.045, freq: 420, q: 0.7 })
    })
  },

  // 每颗实得的星：木鱼一声，从 300 Hz 起逐颗升 60 Hz
  star(index = 0) {
    play((ac) => {
      const f = 300 + Math.max(0, Math.min(4, index)) * 60
      tone(ac, { f0: f, f1: f * 0.82, dur: 0.085, type: 'triangle', gain: 0.25 })
      tone(ac, { f0: f * 2, f1: f * 2, dur: 0.025, type: 'sine', gain: 0.055, delay: 0.002 })
      hiss(ac, { dur: 0.018, gain: 0.032, freq: 950, q: 1.3 })
    })
  },

  // 评价盖章：低沉的木头与纸张闷响
  stamp() {
    play((ac) => {
      tone(ac, { f0: 130, f1: 52, dur: 0.13, type: 'triangle', gain: 0.55 })
      tone(ac, { f0: 220, f1: 120, dur: 0.06, type: 'square', gain: 0.1, delay: 0.015 })
      hiss(ac, { dur: 0.05, gain: 0.14, freq: 620, q: 0.6 })
    })
  },
}
