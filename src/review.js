// 评价单：星级与文案完全由本局日志推导，只依据真实发生的事。
// 首单阶梯：徽章 = 3 星；走进侧室开那间房的宝箱 = 4 星；前两件 + 格挡 = 5 星。
// 新战斗规则下徽章必须挡锤反击才拿得到（badge ⇒ block），4 星档实际不可达，保留兼容。
// 空手挨锤到血量吃不住下一锤会撤退回南厅：无徽章 = 预约未完成，
// 评价仍列这局开过的箱，并写明撤退原因；未完成不解锁第二单。
// 主路箱照常能开，但不算「进侧室寻宝」；站在侧室门外开盖也不算。
// 二单阶梯：徽章 = 3 星；平安过弩 = 4 星；前两件 + 格挡 = 5 星。

import { ARCHIVE } from './map.js'

const EVENT_TEXT = {
  shield: '在路边捡到了盾牌',
  chest: '打开了侧室的宝箱',
  chestPath: '打开了主路的宝箱（不算进侧室寻宝）',
  block: '挡住了守卫的大锤',
  hit: '挨了守卫一锤',
  retreat: '血量吃不住下一锤，撤退回南厅',
  badge: '拿到了勇者徽章',
  safe: '平安过了机械弩',
  shot: '被弩箭射中',
  supply: '从补给廊绕到了训练房',
}

const EVENT_PRIORITY = {
  1: ['badge', 'chest', 'block', 'hit', 'retreat', 'shield'],
  2: ['badge', 'safe', 'supply', 'shot', 'block', 'hit', 'shield'],
}

const COMMENT_5 = '侧室那只箱子当然是我发现的，那一锤也是我算好才挡的。'
const COMMENT_4 = '箱子找得漂亮，就是最后那锤结结实实砸在我身上了，下次想试试盾。'
const COMMENT_3_BLOCK = '盾是好盾，可惜这趟没寻到箱子可翻。'
const COMMENT_3_PLAIN = '一路走到挑战房，箱子没见着，锤子也没挡住……下次多留点惊喜吧。'
const COMMENT_3_PATH_BLOCK = '路边的箱是开了，锤也挡了，可侧室没进去——那不算寻宝。'
const COMMENT_3_PATH_PLAIN = '路边的箱开了，侧室没进去，锤也没挡住……下回想进屋看看。'

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
// 淘货客不打锤、不拿徽章：西铺草料纪念品 + 东铺陶器各一件带回南厅才算完成（五星）。
// 缺一件就是预约未完成，评价写明欠哪一件；同铺两箱不凑两件。
// 两件齐但没有真实回南厅的 return 记录，同样不算完成，缺项单列「没回到南厅」。
function buildMarketReview(log) {
  const chests = log.filter((e) => e.kind === 'chest' && e.shop)
  const shops = new Set(chests.map((e) => e.shop))
  const hasWest = shops.has('west')
  const hasEast = shops.has('east')
  const returned = log.some((e) => e.kind === 'return')

  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 4) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasWest) push('chest', '西铺取到草料纪念品')
  if (hasEast) push('chest', '东铺取到陶器')
  if (returned) push('return', '走回南厅入口')

  if (!hasWest || !hasEast || !returned) {
    const missing = []
    if (!hasWest) missing.push('预约未完成：欠西铺的草料纪念品')
    if (!hasEast) missing.push('预约未完成：欠东铺的陶器')
    if (!returned) missing.push('预约未完成：还没走回南厅入口，两件货要带回南厅才算数')
    return {
      status: 'incomplete',
      stars: 0,
      events,
      eventKinds,
      comment: '',
      missing,
    }
  }

  return {
    status: 'rated',
    stars: 5,
    events,
    eventKinds,
    comment: '西铺的草料纪念品、东铺的陶器，两件都带回南厅了，这趟集市逛得值。',
    missing: [],
  }
}


// ===== 正篇第四单：潮汐蓄水厅（两岸经营图） =====
// 潮汐工不打锤、不拿徽章：西岸、东岸两把水尺的读数都登记，并真走回干堤入口，
// 才算完成（五星）——架桥跨水或走南干堤绕行都认。缺一岸读数或没回入口，
// 都是预约未完成，评价写明缺哪一岸；跨桥只是风味事件，不加星也不扣星。
function buildTideReview(log) {
  const banks = new Set(
    log.filter((e) => e.kind === 'gauge' && e.bank).map((e) => e.bank),
  )
  const hasWest = banks.has('west')
  const hasEast = banks.has('east')
  const returned = log.some((e) => e.kind === 'return')
  const hasBridge = log.some((e) => e.kind === 'bridge')

  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 4) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasWest) push('gauge', '走到西岸水尺记了读数')
  if (hasEast) push('gauge', '走到东岸水尺记了读数')
  if (hasBridge) push('bridge', '从架好的桥板跨过水道')
  if (returned) push('return', '走回干堤入口')

  if (!hasWest || !hasEast || !returned) {
    const missing = []
    if (!hasWest) missing.push('预约未完成：缺西岸水尺的读数')
    if (!hasEast) missing.push('预约未完成：缺东岸水尺的读数')
    if (!returned) missing.push('预约未完成：还没走回干堤入口，两岸读数要带回入口才算数')
    return {
      status: 'incomplete',
      stars: 0,
      events,
      eventKinds,
      comment: '',
      missing,
    }
  }

  return {
    status: 'rated',
    stars: 5,
    events,
    eventKinds,
    comment: hasBridge
      ? '西岸、东岸的水尺都走到了，桥也真踩过去了，两笔读数带回干堤入口，这趟潮汐厅没白来。'
      : '这趟没从桥板上跨过去：绕南干堤走两岸，西岸、东岸两笔读数一笔不少带回入口，这趟走得值。',
    missing: [],
  }
}

// ===== 正篇第五单：双锁档案库（双档经营图） =====
// 抄书人不打锤、不拿徽章：西档、东档两份都登记，并真走到选定的交档出口，
// 才算完成（五星）——开近门抄近路或走外侧后路绕行都认。缺任一档案或没到选定出口，
// 都是预约未完成，评价写明缺哪份；穿门只是风味事件，不加星也不扣星。
// 交档方向只读结算记录里的真实字段（return.site / returnMiss.selected、atSide），
// 不从文案推断：站错出口或没到出口记 returnMiss，档案保留但不算交档完成。
function buildArchiveReview(log) {
  const sites = new Set(
    log.filter((e) => e.kind === 'archive' && e.site).map((e) => e.site),
  )
  const hasWest = sites.has('west')
  const hasEast = sites.has('east')
  const ret = log.find((e) => e.kind === 'return')
  const miss = log.find((e) => e.kind === 'returnMiss')
  const returned = !!ret
  const doors = []
  if (log.some((e) => e.kind === 'redDoor')) doors.push('红门')
  if (log.some((e) => e.kind === 'yellowDoor')) doors.push('黄门')

  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 4) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasWest) push('archive', '取到西档案间的档案')
  if (hasEast) push('archive', '取到东档案间的档案')
  if (doors.length) push('redDoor', `穿过${doors.join('、')}`)
  if (returned) push('return', (ret && ret.label) || '走到选定出口交档')
  else if (miss) push('returnMiss', miss.label || '没走到选定的交档出口')

  if (!hasWest || !hasEast || !returned) {
    const missing = []
    if (!hasWest) missing.push('预约未完成：缺西档案间的档案')
    if (!hasEast) missing.push('预约未完成：缺东档案间的档案')
    if (!returned) {
      if (miss) {
        const chosen = ARCHIVE.exits[miss.selected] || ARCHIVE.exits.east
        const at = miss.atSide ? ARCHIVE.exits[miss.atSide] : null
        const atDesc = at
          ? `${at.name} (${at.x},${at.y})`
          : `非出口格 (${miss.x},${miss.y})`
        missing.push(
          `预约未完成：本局选的是${chosen.name} (${chosen.x},${chosen.y})，` +
            `客人最后停在${atDesc}，已取的档案还在手上，没交成`,
        )
      } else {
        missing.push('预约未完成：还没走到选定的交档出口，两份档案要送到出口才算数')
      }
    }
    return {
      status: 'incomplete',
      stars: 0,
      events,
      eventKinds,
      comment: '',
      missing,
    }
  }

  const exitName =
    (ret.site && ARCHIVE.exits[ret.site] && ARCHIVE.exits[ret.site].name) ||
    '选定出口'
  return {
    status: 'rated',
    stars: 5,
    events,
    eventKinds,
    comment: doors.length
      ? `西档、东档都抄齐了，${doors.join('、')}也真穿过去了，两份档案送到${exitName}，这趟档案库没白来。`
      : `近门一扇没开：绕外侧后路把西档、东档都抄齐，两份档案送到${exitName}，这趟走得值。`,
    missing: [],
  }
}


// ===== 正篇第六单：钟摆工坊（上下两工作区取件图） =====
// 工匠不打锤、不拿徽章：上零件、下零件两件都真踩点取到，并真走回入口兼交件点，
// 才算完成（五星）——铺检修板走安全线或硬穿中廊/南廊都认。缺任一件或没回入口，
// 都是预约未完成，评价写明缺哪件；止摆/被扫到只是风味事件，不加星也不扣星。
function buildPendulumReview(log) {
  const sites = new Set(
    log.filter((e) => e.kind === 'part' && e.site).map((e) => e.site),
  )
  const hasTop = sites.has('top')
  const hasBottom = sites.has('bottom')
  const returned = log.some((e) => e.kind === 'return')
  const hitByPendulum = log.some((e) => e.kind === 'pendulumHit')
  const stopped = log.some((e) => e.kind === 'pendulumStop')

  const events = []
  const eventKinds = []
  const push = (kind, text) => {
    if (events.length >= 4) return
    events.push(text)
    eventKinds.push(kind)
  }
  if (hasTop) push('part', '取到了上层零件')
  if (hasBottom) push('part', '取到了下层零件')
  if (stopped) push('pendulumStop', '拉闸短暂停住全部钟摆')
  if (hitByPendulum) push('pendulumHit', '被钟摆扫到了')
  if (returned && events.length < 4) push('return', '走回工坊入口')

  if (!hasTop || !hasBottom || !returned) {
    const missing = []
    if (!hasTop) missing.push('预约未完成：缺上层零件 (26,5)')
    if (!hasBottom) missing.push('预约未完成：缺下层零件 (26,17)')
    if (!returned) missing.push('预约未完成：还没走回工坊入口，两件零件要带回入口才算数')
    return {
      status: 'incomplete',
      stars: 0,
      events,
      eventKinds,
      comment: '',
      missing,
    }
  }

  let comment = '上层、下层两件零件都带回入口了，这趟工坊没白来。'
  if (stopped && !hitByPendulum) {
    comment = '两件零件都带回入口了，这趟拉过一次闸，也没碰到摆砣，走得稳。'
  } else if (hitByPendulum) {
    comment = '两件零件是带回入口了，可钟摆那一下结结实实——下回铺好检修板走安全线，或留准止摆的时机。'
  }
  return {
    status: 'rated',
    stars: 5,
    events,
    eventKinds,
    comment,
    missing: [],
  }
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
  // 首单「进侧室寻宝」：箱在那间侧室里，且开盖那一刻人也站进了同一间房
  const roomChest = log.some((e) => e.kind === 'chest' && e.room && e.standIn)
  let eventKinds = pickEventKinds(kinds, order)
  if (order === 1 && !roomChest) {
    eventKinds = eventKinds.map((k) => (k === 'chest' ? 'chestPath' : k))
  }
  const events = eventKinds.map((k) => EVENT_TEXT[k])
  // 首单受击按实数写：空手撤退局挨了两锤就不能写「挨了守卫一锤」（其他单文案不动）
  if (order === 1) {
    const hitCount = log.filter((e) => e.kind === 'hit').length
    const hi = eventKinds.indexOf('hit')
    if (hi >= 0 && hitCount > 1) events[hi] = `挨了守卫 ${hitCount} 锤`
  }

  // 先检查预约是否完成：没有徽章就没有星级，只列实际发生的事。
  // 首单撤退局：这局开过的箱照列（events 含 chest），缺项写明撤退原因。
  if (!hasBadge) {
    const missing = ['预约未完成：没拿到勇者徽章']
    const retreat = log.find((e) => e.kind === 'retreat')
    if (retreat) missing.push(`撤退原因：${retreat.reason || retreat.label}`)
    return {
      status: 'incomplete',
      stars: 0,
      events,
      eventKinds,
      comment: '',
      missing,
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

  const hasChest = roomChest
  const hasBlock = kinds.has('block')
  const openedPathChest = kinds.has('chest') && !roomChest

  let stars = 3 // 拿到徽章保底
  if (hasChest) stars += 1
  if (hasChest && hasBlock) stars += 1

  const missing = []
  if (!hasChest) {
    missing.push(
      openedPathChest
        ? '第四颗星：主路箱不算寻宝，把宝箱摆进侧室让他进去开'
        : '第四颗星：没去开侧室的宝箱',
    )
  }
  if (hasChest && !hasBlock) {
    missing.push('第五颗星：没挡住守卫那一锤')
  } else if (!hasChest && hasBlock) {
    missing.push('第五颗星：还差一只侧室宝箱（格挡已做到）')
  } else if (!hasChest && !hasBlock) {
    missing.push('第五颗星：还差进侧室开箱和挡住守卫那一锤')
  }

  let comment
  if (stars === 5) comment = COMMENT_5
  else if (stars === 4) comment = COMMENT_4
  else if (hasBlock) comment = openedPathChest ? COMMENT_3_PATH_BLOCK : COMMENT_3_BLOCK
  else comment = openedPathChest ? COMMENT_3_PATH_PLAIN : COMMENT_3_PLAIN

  return { status: 'rated', stars, events, eventKinds, comment, missing }
}