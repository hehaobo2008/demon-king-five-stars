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

  // 评价盖章：低沉的木头与纸张闷响
  stamp() {
    play((ac) => {
      tone(ac, { f0: 130, f1: 52, dur: 0.13, type: 'triangle', gain: 0.55 })
      tone(ac, { f0: 220, f1: 120, dur: 0.06, type: 'square', gain: 0.1, delay: 0.015 })
      hiss(ac, { dur: 0.05, gain: 0.14, freq: 620, q: 0.6 })
    })
  },
}
