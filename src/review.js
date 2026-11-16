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


// ===== 正篇第四图：钟摆工坊 =====
// 徽章 3 星；取到任一零件 4 星；本局没被钟摆打到 5 星。
function buildPendulumReview(log) {
  const kinds = new Set(log.map((e) => e.kind))
  const parts = log.filter((e) => e.kind === 'part')
  const hasBadge = kinds.has('badge')
  const hasPart = parts.length > 0
  const hitByPendulum = kinds.has('pendulumHit')
  const stopped = kinds.has('pendulumStop')
  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 4) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasBadge) push('badge', '拿到了勇者徽章')
  const shown = new Set()
  for (const e of parts) {
    const site = e.site || e.name || '零件'
    if (shown.has(site)) continue
    shown.add(site)
    push('part', `取到了${e.name || '零件'}`)
    if (shown.size >= 2) break
  }
  if (stopped) push('pendulumStop', '及时止住了一次钟摆')
  if (hitByPendulum) push('pendulumHit', '被钟摆扫到了')
  if (kinds.has('block')) push('block', '挡住了守卫的大锤')
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
  if (hasPart) stars += 1
  if (!hitByPendulum) stars += 1

  const missing = []
  if (!hasPart) missing.push('第四颗星：去上层或下层零件点取一件零件')
  if (hitByPendulum) {
    missing.push('第五颗星：被钟摆打到了；需及时止摆，或改走没有钟摆的南道')
  }

  let comment
  if (stars === 5) {
    comment = stopped
      ? '零件到手，钟摆也被我及时停住，这一趟没白跑。'
      : '零件到手，钟摆没碰到我；干净南道绕得值。'
  } else if (hasPart) {
    comment = '零件是捡到了，可钟摆那一下结结实实，止摆或绕路还差一步。'
  } else if (!hitByPendulum) {
    comment = '钟摆是躲过去了，可两处零件都没捡，工坊白逛。'
  } else {
    comment = '零件没捡着，钟摆也没躲过，这工坊得重新走。'
  }

  return { status: 'rated', stars, events, eventKinds, comment, missing }
}

// ===== 正篇第五图：苔火巡廊 =====
// 徽章 3 星；取到苔火样本 4 星；本局没被巡卫撞见 5 星。
function buildMossReview(log) {
  const kinds = new Set(log.map((e) => e.kind))
  const hasBadge = kinds.has('badge')
  const hasMoss = kinds.has('moss')
  const patrol = kinds.has('patrol')
  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 4) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasBadge) push('badge', '拿到了勇者徽章')
  if (hasMoss) push('moss', '取到了苔火样本')
  if (patrol) push('patrol', '被内院巡卫撞见')
  if (kinds.has('block')) push('block', '挡住了守卫的大锤')
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
  if (hasMoss) stars += 1
  if (!patrol) stars += 1

  const missing = []
  if (!hasMoss) missing.push('第四颗星：去内院取一份苔火样本')
  if (patrol) {
    missing.push('第五颗星：被巡卫撞见；用古铃把巡卫引到另一侧，或走外廊绕开')
  }

  let comment
  if (stars === 5) {
    comment = hasMoss
      ? '样本到手，巡卫被铃声引去了另一边，这趟内院走得安稳。'
      : '外廊绕得干净，巡卫始终没撞上，可惜没进内院取样本。'
  } else if (hasMoss) {
    comment = '苔火样本是取到了，可内院巡卫也撞了个正着。'
  } else {
    comment = '样本没取着，还被巡卫撞见，内院这回进得不值。'
  }

  return { status: 'rated', stars, events, eventKinds, comment, missing }
}

// ===== 正篇第六图：夜场总店 =====
// 两位客人都拿到徽章 = 3 星；西门寻宝客开到箱 +1；东门护卫客拾盾挡锤 +1。
// 评价单只在整晚结束后出，要能说清前客拿走了什么、后客为什么没拿到。
function buildNightReview(log) {
  const badgeGuests = new Set(
    log.filter((e) => e.kind === 'badge' && e.guest).map((e) => e.guest),
  )
  const chests = log.filter((e) => e.kind === 'chest' && e.guest === 1)
  const shields = log.filter((e) => e.kind === 'shield')
  const frontShields = shields.filter((e) => e.guest === 1)
  const backShields = shields.filter((e) => e.guest === 2)
  const backBlocks = log.filter((e) => e.kind === 'block' && e.guest === 2)
  const backHits = log.filter((e) => e.kind === 'hit' && e.guest === 2)
  const frontHits = log.filter((e) => e.kind === 'hit' && e.guest === 1)

  const hasFrontBadge = badgeGuests.has(1)
  const hasBackBadge = badgeGuests.has(2)
  const hasChest = chests.length > 0
  const backHasShield = backShields.length > 0
  const backBlocked = backBlocks.length > 0
  const backStar = backHasShield && backBlocked

  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 5) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasFrontBadge) push('badge', '西门寻宝客拿到了勇者徽章')
  if (hasChest) {
    push('chest', `西门寻宝客打开了${chests.length > 1 ? ` ${chests.length} 只` : ''}宝箱`)
  }
  if (frontShields.length) {
    push(
      'shield',
      `西门寻宝客沿途拿走了${frontShields.length > 1 ? ` ${frontShields.length} 面` : '一面'}盾`,
    )
  }
  if (hasBackBadge) push('badge', '东门护卫客拿到了勇者徽章')
  if (backHasShield && backBlocked) {
    push('block', '东门护卫客拾盾挡住了守卫')
  } else if (backHasShield) {
    push('shield', '东门护卫客捡到了盾')
    if (backHits.length) push('hit', '东门护卫客还是挨了一锤')
  } else if (backHits.length) {
    push('hit', '东门护卫客没捡到盾，空手挨了一锤')
  } else if (hasBackBadge) {
    push('shield', '东门护卫客没捡到盾')
  }

  if (!hasFrontBadge || !hasBackBadge) {
    const missing = []
    if (!hasFrontBadge) missing.push('整晚评价：西门寻宝客没拿到勇者徽章')
    if (!hasBackBadge) missing.push('整晚评价：东门护卫客没拿到勇者徽章')
    return {
      status: 'incomplete',
      stars: 0,
      events,
      eventKinds,
      comment: '',
      missing,
    }
  }

  let stars = 3
  if (hasChest) stars += 1
  if (backStar) stars += 1

  const missing = []
  if (!hasChest) {
    missing.push('第四颗星：把宝箱摆到西门寻宝客会贴近的路旁，让他开箱')
  }
  if (!backStar) {
    if (!backHasShield) {
      if (frontShields.length) {
        missing.push(
          '第五颗星：东门护卫客没捡到盾——前一位已经把沿途的盾拿走了；把留给东门的盾摆到东侧独走路线',
        )
      } else {
        missing.push('第五颗星：东门护卫客路上没有盾；把盾摆到他必走的东侧路线')
      }
    } else {
      missing.push('第五颗星：东门护卫客捡了盾，却没挡住守卫')
    }
  }

  let comment
  if (stars === 5) {
    comment = '前客开箱，后客拾盾挡锤，一晚上两枚徽章，总店这账挑不出毛病。'
  } else if (hasChest && backHasShield === false) {
    comment = frontShields.length
      ? `前客开箱时顺手把沿途的${frontShields.length > 1 ? ` ${frontShields.length} 面` : '那面'}盾也拿走了，后客只能空手挨锤；箱子再漂亮，也补不回这面盾。`
      : '前客箱子开得漂亮；后客路上没摆到盾，守卫那一锤只能硬挨。'
  } else if (hasChest) {
    comment = '前客箱子开了，后客盾也捡了，可那一锤还是没挡住，这晚差一口气。'
  } else if (backStar) {
    comment = '后客拾盾挡住了锤；前客一路没贴近箱子，寻宝客空手而归。'
  } else if (frontHits.length && backHits.length) {
    comment = '两枚徽章都拿到了，可箱子没开、盾也没挡，两位客人都挨了锤，这晚只能算勉强开张。'
  } else {
    comment = '两枚徽章都拿到了，可箱子没开、盾也没挡，这一晚只能算勉强开张。'
  }

  return { status: 'rated', stars, events, eventKinds, comment, missing }
}

export function buildReview(log, order = 1) {
  if (order === 8) return buildNightReview(log)
  if (order === 4) return buildTideReview(log)
  if (order === 5) return buildArchiveReview(log)
  if (order === 6) return buildPendulumReview(log)
  if (order === 7) return buildMossReview(log)
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