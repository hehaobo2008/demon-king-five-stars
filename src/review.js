// 评价单：星级与文案完全由本局日志推导，只依据真实发生的事。
// 首单阶梯：徽章 = 3 星；又开了宝箱 = 4 星；前两件 + 格挡 = 5 星。
// 二单阶梯：徽章 = 3 星；平安过弩 = 4 星；前两件 + 格挡 = 5 星。

const EVENT_TEXT = {
  shield: '在路边捡到了盾牌',
  chest: '打开了侧室的宝箱',
  block: '挡住了守卫的大锤',
  hit: '挨了守卫一锤',
  badge: '拿到了勇者徽章',
  safe: '平安过了机械弩',
  shot: '被弩箭射中',
  supply: '从补给廊绕到了训练房',
}

const EVENT_PRIORITY = {
  1: ['badge', 'chest', 'block', 'hit', 'shield'],
  2: ['badge', 'safe', 'supply', 'shot', 'block', 'hit', 'shield'],
}

const COMMENT_5 = '侧室那只箱子当然是我发现的，那一锤也是我算好才挡的。'
const COMMENT_4 = '箱子找得漂亮，就是最后那锤结结实实砸在我身上了，下次想试试盾。'
const COMMENT_3_BLOCK = '盾是好盾，可惜侧室空空的，没箱子可翻。'
const COMMENT_3_PLAIN = '一路走到挑战房，箱子没见着，锤子也没挡住……下次多留点惊喜吧。'

const COMMENT2_5 = '我就看准了空档才迈那一步，机械弩停得刚刚好；守卫那锤？也是算准了才挡的。'
const COMMENT2_4 = '空档我看得准准的，弩箭碰不到我；就是最后那锤没算进去。'
const COMMENT2_3_BLOCK = '我以为看准了空档……那一步是走眼了。锤倒是挡住了。'
const COMMENT2_3_PLAIN = '我以为看准了空档，结果是走眼了——弩箭和锤子都没躲过。'
const COMMENT2_5_SUPPLY = '路牌一指我就绕了补给廊，多走几步换个稳妥；守卫那锤也挡下来了。'
const COMMENT2_4_SUPPLY = '补给廊绕得又稳又顺，就是最后那锤没算进去。'

function pickEventKinds(kinds, order) {
  return EVENT_PRIORITY[order].filter((k) => kinds.has(k)).slice(0, 3)
}

export function buildReview(log, order = 1) {
  const kinds = new Set(log.map((e) => e.kind))
  const hasBadge = kinds.has('badge')
  const eventKinds = pickEventKinds(kinds, order)
  const events = eventKinds.map((k) => EVENT_TEXT[k])

  // 先检查预约是否完成：没有徽章就没有星级，只列实际发生的事
  if (!hasBadge) {
    return {
      status: 'incomplete',
      stars: 0,
      events,
      eventKinds,
      comment: '',
      missing: ['预约未完成：没拿到勇者徽章'],
    }
  }

  if (order === 2) {
    const hasSafe = kinds.has('safe')
    const hasSupply = kinds.has('supply')
    const hasBlock = kinds.has('block')
    const hasPass = hasSafe || hasSupply

    let stars = 3 // 拿到徽章保底
    if (hasPass) stars += 1
    if (hasPass && hasBlock) stars += 1

    const missing = []
    if (!hasPass) {
      missing.push('第四颗星：没能平安通行（近路要四秒内按暂停，或把路牌转朝上走补给廊）')
    }
    if (hasPass && !hasBlock) {
      missing.push('第五颗星：没挡住守卫那一锤')
    } else if (!hasPass && hasBlock) {
      missing.push('第五颗星：还差一次平安通行（格挡已做到）')
    } else if (!hasPass && !hasBlock) {
      missing.push('第五颗星：要先平安通行，再挡住守卫那一锤')
    }

    let comment
    if (stars === 5) comment = hasSupply ? COMMENT2_5_SUPPLY : COMMENT2_5
    else if (stars === 4) comment = hasSupply ? COMMENT2_4_SUPPLY : COMMENT2_4
    else comment = hasBlock ? COMMENT2_3_BLOCK : COMMENT2_3_PLAIN

    return { status: 'rated', stars, events, eventKinds, comment, missing }
  }

  const hasChest = kinds.has('chest')
  const hasBlock = kinds.has('block')

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

  return { status: 'rated', stars, events, eventKinds, comment, missing }
}