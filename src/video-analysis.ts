import type {Segment} from './research.ts'
export type MaterialKind = 'reference'|'creator'
export type TranscriptCue = {start:number;end:number;text:string}
export type Scene = {start:number;end:number;frame:string;observations:string}
export type Material = {
  id:string; kind:MaterialKind; name:string; source:string; creator:string; notes:string; date:string;
  brand?:string; audiences?:string[]; context?:string; selling?:string; mediaUrl?:string; segments?:Segment[];
  duration:number; width:number; height:number; scenes:Scene[]; cues:TranscriptCue[]; screenCues?:TranscriptCue[]; screenNote?:string; transcriptNote:string
}
export const dimensions=['产品卖点','目标人群','利益点与价格锚','信任背书','行动引导 CTA','可复制内容结构','达人适配度','合规风险']
export const creatorChecks=['开头是否明确人群和需求','为什么继续看','卖点是否具体且有场景','画面能否证明口播','体验是否可信','价格权益是否有购买理由','行动引导是否清晰自然','是否符合账号风格']
const signals=[
  {label:'需求与身份',pattern:/赶[早时]|出门|出差|旅行|通勤|宿舍|发根|长发|家里|你是不是|怕|担心|需要|健身|送礼/},
  {label:'产品与卖点',pattern:/吹风机|吹干|档位|风嘴|负离子|恒温|重量|发量|机身|收纳|轻巧|柔顺/},
  {label:'举证与信任',pattern:/实测|计时|对比|记录|演示|原片|测试|发束|用过|质保|售后/},
  {label:'价格与权益',pattern:/到手|优惠|折扣|满减|立减|券|赠|元|块钱|退换|福利/},
  {label:'行动引导',pattern:/商品卡|购物车|链接|下单|点击|点开|左下角|直播间|去看看/}
]
const risk=/不伤发|静音|全网第一|零损伤|绝对|保证|最低价|(?:\d+|[一二三四五六七八九十]+)\s*(?:秒|分钟)(?:就能|内)?吹干|立减\s*\d+/g
export function timestamp(seconds:number){
  const total=Math.floor(seconds*10+0.001)
  return `${String(Math.floor(total/600)).padStart(2,'0')}:${String(Math.floor(total/10)%60).padStart(2,'0')}.${total%10}`
}
export function span(start:number,end:number){return timestamp(start)+'–'+timestamp(end)}
export function parseCues(input:string,duration:number):TranscriptCue[]{
  const matches=[...input.replace(/\r/g,'').matchAll(/((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[,.]\d{1,3})[^\n]*\n([\s\S]*?)(?=\n[ \t]*\n|$)/g)]
  const seconds=(value:string)=>value.replace(',','.').split(':').reduce((a,b)=>a*60+Number(b),0)
  return matches.map(m=>({start:seconds(m[1]),end:Math.min(duration,seconds(m[2])),text:m[3].trim()}))
    .filter(c=>c.start>=0&&c.end>c.start&&c.text)
    .sort((a,b)=>a.start-b.start)
}

export function analyzeMaterial(material:Material){
  const rows=material.scenes.map((scene,index)=>{
    const spoken=material.cues.filter(c=>c.start<scene.end&&c.end>scene.start)
    const text=spoken.map(c=>c.text).join(' ')
    const found=signals.filter(s=>s.pattern.test(text)).map(s=>s.label)
    const mechanism=found.includes('行动引导')?'降低下一步行动的不确定性':
      found.includes('举证与信任')?'用可回查的演示减少对承诺的疑虑':
      found.includes('需求与身份')?'通过任务或顾虑让观众辨认自身需求':
      found.includes('价格与权益')?'用价格或权益信息帮助判断是否值得考虑':
      found.includes('产品与卖点')?'把产品信息连接到具体使用任务':'结合关键帧复核此段承担的作用'
    const position=index===0?'开场':index===material.scenes.length-1?'结尾':'正文'
    const audience=text.match(/[^，。！？]{0,8}(?:出差|旅行|通勤|赶早班|宿舍|长发|健身|送礼|家里)[^，。！？]{0,8}/)?.[0]
    return {...scene,text,found,position,mechanism,audience:audience||'需结合画面或口播核对',
      evidence:spoken.map(c=>span(c.start,c.end)+'「'+c.text+'」').join('；')}
  })
  const mentions=(label:string)=>rows.filter(r=>r.found.includes(label))
  const cite=(label:string)=>mentions(label).slice(0,3).map(r=>span(r.start,r.end)+'「'+r.text.slice(0,84)+'」').join('；') || '当前未识别相关口播，需结合原视频复核。'
  const risks=[...new Set(material.cues.flatMap(c=>c.text.match(risk)||[]))]
  const stageEvidence=[
    cite('产品与卖点'),cite('需求与身份'),cite('价格与权益'),cite('举证与信任'),cite('行动引导'),
    rows.map(r=>span(r.start,r.end)+' '+r.position+(r.found.length?' / '+r.found.join('、'):'')).join('；'),
    material.creator||'未提供合作达人账号风格，需结合历史素材复核。',
    risks.length?'待复核表述：'+risks.join('、'):'当前规则未命中，仍需复核视频画面、数字与权益。'
  ]
  const first=rows[0]
  const last=rows.at(-1)
  const firstSpeech=material.cues[0]
  const formatCue=(c:TranscriptCue)=>`${span(c.start,c.end)}「${c.text}」`
  const earlyNeed=material.cues.find(c=>signals[0].pattern.test(c.text))
  const ending=material.cues.filter(c=>signals[4].pattern.test(c.text)).at(-1)
  const phases=[
    ['注意',firstSpeech?formatCue(firstSpeech)+'；对照首段关键帧，判断吸引注意的理由。':'查看首段关键帧与动作变化，开场含义待复核。'],
    ['兴趣 / 需求',earlyNeed?formatCue(earlyNeed):cite('需求与身份')],
    ['卖点 / 价值',cite('产品与卖点')],
    ['购买信任',cite('举证与信任')],
    ['行动引导',ending?formatCue(ending)+(last&&ending.end<last.start?'；识别到的行动引导出现在最后一段之前。':''):'尾段未识别明确 CTA，复核字幕及画面。']
  ]
  const layers=[
    ['观察',`原视频 ${timestamp(material.duration)}，检测到 ${rows.length} 个候选段落。核对下方时间码、关键帧与口播记录。`],
    ['机制',rows.filter(r=>r.found.length).slice(0,4).map(r=>`${span(r.start,r.end)} ${r.mechanism}`).join('；')||'结合原片复核，当前证据不足以推断心理机制。'],
    ['成立条件',`${cite('需求与身份')} 产品、价格带与受众匹配需核实；${material.notes?'已填背景（待核对）：'+material.notes+'；':''}${cite('价格与权益')}`],
    ['反证','曝光分配、账号既有受众、投放预算、优惠、发布时间均可能影响表现。未提供播放与成交数据时，无法判断素材是否爆款或归因。'],
    ['迁移',`${material.creator?'结合已填达人背景复核：'+material.creator+'。':'先补充合作达人历史内容与账号风格。'} 优先迁移已观察到的结构和证据动作，重新实拍产品与权益。`],
    ['验证','同组固定商品、价格、受众和投放条件，单独替换一个开场或证据机制。记录实际 3 秒留存（如可得）、5 秒完播、点击、成交与净 ROI。']
  ]
  return {rows,phases,layers,stageEvidence,observed:[mentions('产品与卖点').length>0,mentions('需求与身份').length>0,mentions('价格与权益').length>0,mentions('举证与信任').length>0,mentions('行动引导').length>0,rows.length>0,Boolean(material.creator),risks.length>0],checks:[
    cite('需求与身份'),first?.mechanism||'待复核',cite('产品与卖点'),'逐镜对照关键帧与口播，确认有无实物或可复核结果。',
    cite('举证与信任'),cite('价格与权益'),cite('行动引导'),stageEvidence[6]
  ]}
}

export const compareActions=[
  '逐条核对事实、场景和演示是否对应，优先保留一个可实拍卖点。',
  '检查首镜是否让目标用户辨认自己的具体任务。',
  '补上已核验的实际利益与适用条件，再测点击和成交。',
  '用原片、测试条件和连续画面核对体验或背书。',
  '在尾段只给一个清晰动作，核对商品卡是否承接前文。',
  '抽取可独立验证的一个开场或举证动作，对照测试。',
  '用达人历史内容核对叙事语气、出镜习惯与受众。',
  '复核效果、参数、价格、权益、背书与来源，发布前人工审核。'
]

export function compareMaterials(reference:Material,creator:Material){
  const left=analyzeMaterial(reference)
  const right=analyzeMaterial(creator)
  return dimensions.map((dimension,i)=>({
    dimension,reference:left.stageEvidence[i],creator:right.stageEvidence[i],
    difference:i===7
      ? right.observed[i]?'达人素材命中规则，先复核对应表述。':'达人素材暂无规则命中，画面及上下文仍待核对。'
      : left.observed[i]===right.observed[i]
        ? left.observed[i]?'两条均有线索，核对表达、证据与适用条件。':'双方当前证据不足，先补充或回看原片。'
        : left.observed[i]?'仅参考素材有已识别线索，核对达人原片后再判断是否需要补充。':'仅达人素材有已识别线索，核对是否适合账号与商品。',
    action:compareActions[i]
  }))
}
