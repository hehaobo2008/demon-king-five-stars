// 评价单：星级与文案完全由本局日志推导，只依据真实发生的事。
// 阶梯：拿到徽章 = 3 星；又开了宝箱 = 4 星；前两件都做了还挡住一锤 = 5 星。

const EVENT_TEXT = {
  shield: '在路边捡到了盾牌',
  chest: '打开了侧室的宝箱',
  block: '挡住了守卫的大锤',
  hit: '挨了守卫一锤',
  badge: '拿到了勇者徽章',
}

const EVENT_PRIORITY = ['badge', 'chest', 'block', 'hit', 'shield']

const COMMENT_5 = '侧室那只箱子当然是我发现的，那一锤也是我算好才挡的。'
const COMMENT_4 = '箱子找得漂亮，就是最后那锤结结实实砸在我身上了，下次想试试盾。'
const COMMENT_3_BLOCK = '盾是好盾，可惜侧室空空的，没箱子可翻。'
const COMMENT_3_PLAIN = '一路走到挑战房，箱子没见着，锤子也没挡住……下次多留点惊喜吧。'

function pickEvents(kinds) {
  return EVENT_PRIORITY.filter((k) => kinds.has(k))
    .slice(0, 3)
    .map((k) => EVENT_TEXT[k])
}

export function buildReview(log) {
  const kinds = new Set(log.map((e) => e.kind))
  const hasBadge = kinds.has('badge')
  const hasChest = kinds.has('chest')
  const hasBlock = kinds.has('block')
  const events = pickEvents(kinds)

  // 先检查预约是否完成：没有徽章就没有星级，只列实际发生的事
  if (!hasBadge) {
    return {
      status: 'incomplete',
      stars: 0,
      events,
      comment: '',
      missing: ['预约未完成：没拿到勇者徽章'],
    }
  }

  let stars = 3 // 拿到徽章保底
  if (hasChest) stars += 1
  if (hasChest && hasBlock) stars += 1

  const missing = []
  if (!hasChest) missing.push('第四颗星：没去开侧室的宝箱')
  if (hasChest && !hasBlock) {
    missing.push('第五颗星：没挡住守卫那一锤')
  } else if (!hasChest && hasBlock) {
    missing.push('第五颗星：还差一只侧室宝箱（格挡已做到）')
  } else if (!hasChest && !hasBlock) {
    missing.push('第五颗星：要先开箱，再挡住守卫那一锤')
  }

  let comment
  if (stars === 5) comment = COMMENT_5
  else if (stars === 4) comment = COMMENT_4
  else comment = hasBlock ? COMMENT_3_BLOCK : COMMENT_3_PLAIN

  return { status: 'rated', stars, events, comment, missing }
}