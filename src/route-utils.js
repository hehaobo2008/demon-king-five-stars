// 正篇路线共用的小工具：四向 BFS、朝向、路牌直行段。
export const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export const SIGN_DIRS = [
  [0, -1], // 0 上
  [1, 0], // 1 右
  [0, 1], // 2 下
  [-1, 0], // 3 左
]

export const faceToward = (from, to) =>
  Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
    ? to.x > from.x
      ? 'right'
      : 'left'
    : to.y > from.y
      ? 'down'
      : 'up'

export function bfsWalkable(from, to, canWalk) {
  if (from.x === to.x && from.y === to.y) return [from]
  const queue = [from]
  const parent = new Map([[from.x + ',' + from.y, null]])
  while (queue.length) {
    const cur = queue.shift()
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      const k = nx + ',' + ny
      if (!canWalk(nx, ny) || parent.has(k)) continue
      parent.set(k, cur)
      if (nx === to.x && ny === to.y) {
        const path = []
        let p = { x: nx, y: ny }
        while (p) {
          path.push(p)
          p = parent.get(p.x + ',' + p.y)
        }
        return path.reverse()
      }
      queue.push({ x: nx, y: ny })
    }
  }
  return null
}

// 路牌直行段：沿箭头一直走到不可走或上限，中途不因岔口停步
export function straightRun(from, dx, dy, canWalk, max = 14) {
  const seg = [from]
  let x = from.x
  let y = from.y
  for (let i = 0; i < max; i++) {
    const nx = x + dx
    const ny = y + dy
    if (!canWalk(nx, ny)) break
    x = nx
    y = ny
    seg.push({ x, y })
  }
  return seg
}