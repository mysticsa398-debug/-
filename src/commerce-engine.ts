import {audit, verified, type DB, type Fact, type Insight} from './domain.ts'
import type {StudioShot} from './studio-engine.ts'

export const narratives = [
  {id:'pain', label:'痛点共鸣', tasks:['具体痛点','解决方案','真实演示','建立信任','商品卡']},
  {id:'scene', label:'场景冲突', tasks:['场景冲突','产品登场','价值证明','消除顾虑','商品卡']},
  {id:'test', label:'视觉实验', tasks:['视觉实验','引发好奇','展示现场观察','解释产品','商品卡']},
  {id:'audience', label:'人群喊话', tasks:['人群喊话','精准需求','关键卖点','可复核证据','商品卡']},
  {id:'concern', label:'购买顾虑', tasks:['购买顾虑','对应解释','细节证明','判断价值','商品卡']}
]
export const hookStrategies = ['痛点共鸣','场景冲突','价值悬念','反常识','人群精准喊话','真实测评','用户顾虑','特点视觉化','已核验权益']
export const dimensions = [['前三秒吸引',20],['人群痛点匹配',15],['产品与购买理由',15],['证据可信度',15],['信任与顾虑处理',10],['行动引导',10],['叙事与口语化',10],['拍摄可执行',5]] as const
export type Duration = 15|30|45
export type Hook = Record<'strategy'|'audience'|'psychology'|'retention'|'visual'|'bridge'|'copy',string>
export type Motive = Record<'buyer'|'trigger'|'alternative'|'dissatisfaction'|'benefit'|'concern'|'proof'|'reason'|'basis',string> & {hooks:Hook[]}
export type CommerceShot = {task:string; visual:string; copy:string}
export type Pitch = {factId:string; benefit:string; proof:string; clickReason:string}
export type Draft = {title:string; reason:string; shots:CommerceShot[]; factIds:string[]; pitch?:Pitch}
export type Review = {scores:{score:number;reason:string}[]; risks:string[]; changes:string}
export type CommerceMeta = {hook:Hook; motive:Motive; duration:Duration; review?:Review; changes:string; risks:string[]; pitch?:Pitch}
export type Edition = {draft:Draft; meta:CommerceMeta}

const text = (v:unknown):v is string => typeof v==='string'&&v.trim().length>0&&v.length<=600
const object = (v:unknown):v is Record<string,unknown> => !!v&&typeof v==='object'&&!Array.isArray(v)
const hasText = (v:Record<string,unknown>,keys:string[]) => keys.every(k=>text(v[k]))
export const spokenLength = (copy:string) => Array.from(copy.replace(/[\p{P}\s]/gu,'')).reduce((n,c)=>n+(/[0-9a-z]/i.test(c)?1.5:1),0)
export function shotSeconds(duration:Duration,count=5){
  if(count===6)return duration===15?[3,2,2,3,3,2]:duration===30?[3,5,6,7,5,4]:[3,7,9,11,9,6]
  return duration===15?[3,3,3,3,3]:duration===30?[3,6,8,7,6]:[3,9,13,11,9]
}
export const budgets = (duration:Duration,count=5) => shotSeconds(duration,count).map(s=>Math.floor((s-.5)*4))

export function motiveFrom(value:unknown):Motive{
  if(!object(value)||!hasText(value,['buyer','trigger','alternative','dissatisfaction','benefit','concern','proof','reason','basis'])||
    !Array.isArray(value.hooks)||value.hooks.length!==3||
    !value.hooks.every(h=>object(h)&&hasText(h,['strategy','audience','psychology','retention','visual','bridge','copy'])&&hookStrategies.includes(h.strategy as string)&&spokenLength(h.copy as string)<=10)||
    new Set(value.hooks.map(h=>h.strategy)).size!==3||new Set(value.hooks.map(h=>h.copy)).size!==3)throw Error('模型未返回三个不同策略、符合前三秒时长的钩子，请重试。')
  return value as Motive
}

export function commerceFacts(db:DB,insight:Insight){
  return db.facts.filter(f=>verified(f)&&f.wording.trim()).map(f=>{
    const match=db.matches.find(m=>m.fact===f.id&&m.insight===insight.id)
    return {id:f.id,category:f.category,fact:f.claim,wording:f.wording,source:f.source,date:f.date,benefit:match?.angle||'',pain:match?.pain||'',scene:match?.scene||'',proof:match?.evidence||''}
  }).sort((a,b)=>Number(Boolean(b.pain))-Number(Boolean(a.pain))).slice(0,6)
}

export function draftFrom(value:unknown,facts:Fact[]):Draft{
  if(!object(value)||!hasText(value,['title','reason'])||!Array.isArray(value.shots)||![5,6].includes(value.shots.length)||
    !value.shots.every(s=>object(s)&&hasText(s,['task','visual','copy']))||!Array.isArray(value.factIds)||
    !value.factIds.every(id=>facts.some(f=>f.id===id&&verified(f)&&f.wording.trim())))throw Error('模型分镜或事实引用格式不符，请重试。')
  if(value.pitch!==undefined&&(!object(value.pitch)||typeof value.pitch.factId!=='string'||!hasText(value.pitch,['benefit','proof','clickReason'])||(value.pitch.factId&&!value.factIds.includes(value.pitch.factId))))throw Error('卖点举证结构无效。')
  return value as Draft
}

export function validateBatch(value:unknown,facts:Fact[],motive:Motive){
  if(!object(value)||!Array.isArray(value.drafts)||value.drafts.length!==3)throw Error('模型未返回完整的三个方案。')
  const drafts=value.drafts.map((draft,i)=>{
    const parsed=draftFrom(draft,facts)
    const hook=motive.hooks[i]
    return {...parsed,shots:[{...parsed.shots[0],visual:hook.visual,copy:hook.copy},...parsed.shots.slice(1)]}
  })
  for(let i=0;i<drafts.length;i++)for(let j=0;j<i;j++){
    const normalize=(s:string)=>s.replace(/[\p{P}\s]/gu,'')
    const left=drafts[i].shots.slice(1).map(s=>normalize(s.copy))
    const right=new Set(drafts[j].shots.slice(1).map(s=>normalize(s.copy)))
    if(left.filter(s=>right.has(s)).length>=2)throw Error('模型返回的方案正文过于相似，请重新生成。')
  }
  return drafts
}

export function reviewFrom(value:unknown):Review{
  if(!object(value)||!text(value.changes)||!Array.isArray(value.risks)||!value.risks.every(text)||
    !Array.isArray(value.scores)||value.scores.length!==dimensions.length||
    !value.scores.every((s,i)=>object(s)&&typeof s.score==='number'&&Number.isInteger(s.score)&&s.score>=0&&s.score<=dimensions[i][1]&&text(s.reason)))throw Error('模型评分不完整，请重试评审。')
  return value as Review
}
export const total = (review:Review) => review.scores.reduce((n,s)=>n+s.score,0)

export function commerceRisks(draft:Draft,facts:Fact[],duration:Duration){
  const allowed=facts.filter(f=>draft.factIds.includes(f.id)&&verified(f)&&f.wording.trim())
  const text=[draft.title,...draft.shots.flatMap(s=>[s.visual,s.copy])].join('\n')
  return [...new Set([
    ...audit(text,facts.map(f=>allowed.includes(f)?f:{...f,status:'待核验'})).map(f=>f.term+' · '+f.reason),
    ...Array.from(text.matchAll(/(?:[¥￥]\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*元|限时优惠|免费试用|到手价|下单送|全网销量|(?:实测|测试结果)[^，。\n]{0,12}\d)/g),m=>m[0])
      .filter(term=>!allowed.some(f=>f.wording.includes(term))).map(term=>term+' · 需人工核对'),
    ...draft.shots.flatMap((s,i)=>spokenLength(s.copy)>budgets(duration,draft.shots.length)[i]?['第 '+(i+1)+' 镜口播超时']:[])
  ])]
}

export function commerceShots(draft:Draft,duration:Duration):StudioShot[]{
  let start=0
  return draft.shots.map((s,i)=>{
    const end=start+shotSeconds(duration,draft.shots.length)[i]
    const shot={time:`${start}–${end} 秒`,part:s.task,content:s.visual,subtitle:s.copy}
    start=end
    return shot
  })
}

export function validCommerceMeta(value:unknown):value is CommerceMeta{
  if(!object(value)||![15,30,45].includes(value.duration as number)||!text(value.changes)||
    !Array.isArray(value.risks)||!value.risks.every(text)||!object(value.hook)||
    !hasText(value.hook,['strategy','audience','psychology','retention','visual','bridge','copy']))return false
  try{motiveFrom(value.motive);if(value.review!==undefined)reviewFrom(value.review);return true}
  catch{return false}
}

export function rewritePositions(focus:string,count:number){
  if(focus==='只优化前三秒')return [0]
  if(focus==='优化成交引导')return [count-1]
  if(focus==='增加有证据的卖点'||focus==='强化购买理由')return [1,2,3]
  if(focus==='强化痛点')return [0,1]
  return Array.from({length:count},(_,i)=>i)
}

export function copyDiagnostics(draft:Draft){
  const last=draft.shots.at(-1)?.copy||''
  return [
    ...(/(?:点|打开|戳|进入|看看).{0,8}(?:商品卡|商品链接|左下角)/.test(last)?[]:['结尾缺少明确的商品卡动作']),
    ...(draft.factIds.length>2?['事实引用较多，检查是否围绕同一个购买理由']:[]),
    ...(draft.shots.slice(1,-1).filter(s=>/^(?:先|再|把|拿出|放进|插上|吹完)/.test(s.copy)).length>=3?['正文多段以动作开头，检查购买理由是否清楚']:[])
  ]
}

export const genericOpening = (copy:string) => /^(?:又来不及了|又起晚了|怎么办|你知道吗|猜猜看)[？?！!。…]*$/.test(copy.trim())

export function salesCopyIssues(draft:Draft, product:string, category:string){
  const opening=draft.shots[0].copy.trim()
  const introduction=draft.shots.slice(1,3).map(shot=>shot.copy).join(' ')
  const model=product.match(/\b[A-Z]+\d+[A-Z\d]*\b/i)?.[0]
  const categoryName=category.endsWith('吹风机')?'吹风机':category
  const hasProduct=model?introduction.toLowerCase().includes(model.toLowerCase()):introduction.includes(product)
  return [
    ...(genericOpening(opening)?['开头没有说出具体场景或痛点']:[]),
    ...(!hasProduct||categoryName&&!introduction.includes(categoryName)?['第 2–3 镜口播需要介绍当前产品和品类']:[]),
    ...draft.shots.flatMap((shot,i)=>/(?:同一?|固定|相同)(?:机位|光线|发束|测试条件)|全程同框|计时器|按下计时|记录(?:实际)?用时|结果以.{0,5}为准/.test(shot.copy)?['第 '+(i+1)+' 镜口播念出了拍摄或测试流程']:[])
  ]
}
