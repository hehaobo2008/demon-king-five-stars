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


// ===== 正篇第三关：回声集市 =====
// 徽章保底 3 星；开一箱 4 星；再挡锤或到另一处铺面开第二箱 5 星。
function buildMarketReview(log) {
  const kinds = new Set(log.map((e) => e.kind))
  const chests = log.filter((e) => e.kind === 'chest')
  const shops = new Set(chests.map((e) => e.shop).filter(Boolean))
  const hasBadge = kinds.has('badge')
  const hasChest = chests.length > 0
  const hasBlock = kinds.has('block')
  const hasSecondShop = shops.size >= 2

  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 4) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasBadge) push('badge', '拿到了勇者徽章')
  let chestShown = 0
  for (const e of chests) {
    if (chestShown >= 2) break
    const name = e.shop === 'west' ? '西铺' : e.shop === 'east' ? '东铺' : '店里'
    push('chest', `打开了${name}的宝箱`)
    chestShown++
  }
  if (hasBlock) push('block', '挡住了守卫的大锤')
  else if (kinds.has('hit')) push('hit', '挨了守卫一锤')
  if (events.length < 4 && kinds.has('shield')) push('shield', '在路边捡到了盾牌')

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

  let stars = 3
  if (hasChest) stars += 1
  const fifth = hasChest && (hasBlock || hasSecondShop)
  if (fifth) stars += 1

  const missing = []
  if (!hasChest) {
    missing.push('第四颗星：去西铺或东铺开一只宝箱')
    missing.push('第五颗星：先开箱，再挡锤或去另一处铺面开第二箱')
  } else if (!hasBlock && !hasSecondShop) {
    missing.push('第五颗星：挡住守卫那一锤，或再去另一处铺面开第二箱')
  }

  let comment
  if (stars === 5) {
    comment = hasBlock
      ? '铺子里的箱子翻到了，守卫那一锤也稳稳挡住，这趟集市逛得值。'
      : '西铺东铺我都逛到了，两处铺面的箱子一只没落下。'
  } else if (stars === 4) {
    comment = '箱子翻到了一只，另一处铺面没来得及去，守卫那锤也没挡住。'
  } else if (hasBlock) {
    comment = '锤是挡住了，可铺子里的箱子一只都没开成。'
  } else {
    comment = '一路找到挑战房，铺子里的箱子没翻着，锤也没挡住，下回得好好逛。'
  }

  return { status: 'rated', stars, events, eventKinds, comment, missing }
}


// ===== 正篇第二图：潮汐蓄水厅 =====
// 徽章 3 星；实际走到水尺 4 星；再实际跨桥或拾盾挡锤 5 星。
function buildTideReview(log) {
  const kinds = new Set(log.map((e) => e.kind))
  const hasBadge = kinds.has('badge')
  const hasGauge = kinds.has('gauge')
  const hasBridge = kinds.has('bridge')
  const hasBlock = kinds.has('block')
  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 4) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasBadge) push('badge', '拿到了勇者徽章')
  if (hasGauge) push('gauge', '走到水尺看了水位')
  if (hasBridge) push('bridge', '从架好的桥板跨过水道')
  if (hasBlock) push('block', '挡住了守卫的大锤')
  else if (kinds.has('hit')) push('hit', '挨了守卫一锤')
  if (events.length < 4 && kinds.has('shield')) push('shield', '在路边捡到了盾牌')

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

  let stars = 3
  if (hasGauge) stars += 1
  if (hasGauge && (hasBridge || hasBlock)) stars += 1

  const missing = []
  if (!hasGauge) {
    missing.push('第四颗星：没走到水尺')
    missing.push('第五颗星：先到水尺，再实际跨桥或挡锤')
  } else if (!hasBridge && !hasBlock) {
    missing.push('第五颗星：搭桥后实际跨过去，或提前拾盾挡锤')
  }

  let comment
  if (stars === 5) {
    comment = hasBridge
      ? '水尺看过了，桥也真踩过去了，这一趟潮汐厅没白来。'
      : '水尺看过了，守卫那锤也挡住了，桥钱省得正好。'
  } else if (stars === 4) {
    comment = hasBlock
      ? '水尺和锤子都顾上了，可惜没真从桥上走一趟。'
      : '水尺看过了，桥没架，锤也没挡住，下回得补一样。'
  } else {
    comment = hasBlock
      ? '锤是挡住了，可水尺没走到，连这厅的水位都没看着。'
      : '一路摸到挑战房，水尺没看，桥也没走，锤更没挡住。'
  }

  return { status: 'rated', stars, events, eventKinds, comment, missing }
}

// ===== 正篇第三图：双锁档案库 =====
// 徽章 3 星；实际取到一份档案 4 星；拿齐两份，或一份并实际穿过开启的近门 5 星。
function buildArchiveReview(log) {
  const kinds = new Set(log.map((e) => e.kind))
  const hasBadge = kinds.has('badge')
  const archiveEntries = log.filter((e) => e.kind === 'archive')
  const sites = new Set(archiveEntries.map((e) => e.site).filter(Boolean))
  const doors = []
  if (kinds.has('redDoor')) doors.push('红门')
  if (kinds.has('yellowDoor')) doors.push('黄门')
  const hasArchive = archiveEntries.length > 0
  const hasTwo = sites.size >= 2
  const hasDoor = doors.length > 0
  const hasBlock = kinds.has('block')

  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 4) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasBadge) push('badge', '拿到了勇者徽章')
  const shownSites = new Set()
  for (const e of archiveEntries) {
    const site = e.site || e.x + ',' + e.y
    if (shownSites.has(site)) continue
    shownSites.add(site)
    const name = e.name || (e.site === 'west' ? '西档案间' : e.site === 'east' ? '东档案间' : '档案间')
    push('archive', `取到${name}的档案`)
    if (shownSites.size >= 2) break
  }
  if (doors.length) push('door', `穿过${doors.join('、')}`)
  if (hasBlock) push('block', '挡住了守卫的大锤')
  else if (kinds.has('hit')) push('hit', '挨了守卫一锤')
  if (events.length < 4 && kinds.has('shield')) push('shield', '在路边捡到了盾牌')

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

  let stars = 3
  if (hasArchive) stars += 1
  if (hasTwo || (hasArchive && hasDoor)) stars += 1

  const missing = []
  if (!hasArchive) {
    missing.push('第四颗星：去西档案间或东档案间取一份档案')
    missing.push('第五颗星：拿齐两份，或拿一份并实际穿过开启的近门')
  } else if (!hasTwo && !hasDoor) {
    missing.push('第五颗星：再拿另一间档案，或打开一扇门并实际穿过去')
  }

  let comment
  if (stars === 5) {
    if (hasTwo) {
      comment = '东西两间档案都翻到了，门开不开都拦不住我。'
    } else if (doors.includes('红门')) {
      comment = '借着红门抄近路，一份档案也够我交差。'
    } else {
      comment = '黄门一开，我直接穿过去把档案取了。'
    }
  } else if (stars === 4) {
    comment = '只翻到一间档案，两扇门也没走过，下次得把另一间也找出来。'
  } else if (hasBlock) {
    comment = '锤是挡住了，可档案一份没取，两扇门也没摸到。'
  } else {
    comment = '一路走到挑战房，档案没取着，门也没开，锤还没挡住。'
  }

  return { status: 'rated', stars, events, eventKinds, comment, missing }
}

export function buildReview(log, order = 1) {
  if (order === 4) return buildTideReview(log)
  if (order === 5) return buildArchiveReview(log)
  if (order === 3) return buildMarketReview(log)
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