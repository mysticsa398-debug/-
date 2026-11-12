import {validCommerceMeta,type CommerceMeta} from './commerce-engine.ts'
import {validMemory,type GenerationSource} from './creative-memory.ts'
import {hooks,reportUrl,type HookId} from './creative-engine.ts'
import {compareCreativeTest,reportsFor,sameCreativeBody,testMetrics} from './creative-test.ts'
import {audit,experimentError,metrics,verified,type DB,type Experiment,type Insight,type Version} from './domain.ts'
import {studioShot,type StudioShot} from './studio-engine.ts'

export type ScriptStructure={
  id:string; hook?:HookId; title:string; stages:string[]; basis:string
  status:'报告参考'|'关联投放支持'|'开场对照支持'; sources:string[]
}
type PlanBrief={title:string;problem:string;angle:string;demo:string}
export type ScriptSegment={name:string;purpose:string;copy?:string}
export type ScriptPlan=PlanBrief&{segments:ScriptSegment[]}
type LegacyScriptPlan=PlanBrief&{cta:string;beats:string[]}
export type ScriptPlanning={structure:ScriptStructure;plan:ScriptPlan|LegacyScriptPlan;generation?:GenerationSource;commerce?:CommerceMeta}
export const maxScriptSegments=10

const word=(s:string)=>s.trim().slice(0,360)
function usableVersion(version:Version){
  const shots=version.shots.map(studioShot)
  const parts=shots.map(s=>s.part.trim())
  return shots.length>=1&&shots.length<=maxScriptSegments&&parts.every(Boolean)?parts:undefined
}
function sourcedReport(e:Experiment|undefined,insight:string){
  return Boolean(e&&e.insight===insight&&e.date.trim()&&e.source.trim()&&e.impressions>0&&!experimentError(e))
}
const reportDescription=(e:Experiment)=>e.title+' · '+e.date+' · '+e.impressions+' 展现'
export function scriptStructures(db:DB,insight:string):ScriptStructure[]{
  const observed:ScriptStructure[]=[]
  for(const test of db.creativeTests||[]){
    const script=db.scripts.find(s=>s.id===test.script&&s.insight===insight)
    const a=script?.versions.find(v=>v.id===test.control),b=script?.versions.find(v=>v.id===test.treatment)
    if(!a||!b||!sameCreativeBody(a,b))continue
    const control=reportsFor(test,db.experiments,'control').find(e=>e.id===test.controlReport)
    const treatment=reportsFor(test,db.experiments,'treatment').find(e=>e.id===test.treatmentReport)
    if(!control||!treatment||!sourcedReport(control,insight)||!sourcedReport(treatment,insight))continue
    const result=compareCreativeTest(test,control,treatment)
    const change=result.rows.find(r=>r.key===test.primary)?.delta
    const stages=usableVersion(b)
    if(!stages||result.issues.length||change==null||change<=0)continue
    observed.push({id:'ab:'+test.id,...(b.planning?.structure.hook?{hook:b.planning.structure.hook}:{}),title:test.title,stages,status:'开场对照支持',
      basis:testMetrics[test.primary]+' B − A '+change.toFixed(2)+(test.primary==='roi'?'':' 个百分点')+'。投放对照支持原开场。新结构的改编效果仍需实测，统计显著性未评估。',
      sources:[reportDescription(control)+' · '+control.source,reportDescription(treatment)+' · '+treatment.source]})
  }
  for(const report of db.experiments){
    if(report.outcome!=='已验证假设'||!report.notes.trim()||!sourcedReport(report,insight)||report.impressions<db.thresholds.sample)continue
    const script=db.scripts.find(s=>s.id===report.script&&s.insight===insight)
    const version=script?.versions.find(v=>v.id===report.version)
    const stages=version&&usableVersion(version)
    if(!version||!stages)continue
    const data=metrics(report)
    const available=(['hold','ctr','cvr','roi'] as const).filter(k=>data[k]!==null)
    if(!available.length)continue
    const design=db.designs?.find(d=>d.id===version.design)
    const rule=db.rules?.find(r=>r.id===design?.rule&&r.status==='已审核')
    observed.push({id:'report:'+report.id,...(version.planning?.structure.hook?{hook:version.planning.structure.hook}:{}),title:report.title,stages,
      status:'关联投放支持',basis:available.map(k=>testMetrics[k]+' '+data[k]!.toFixed(2)+(k==='roi'?'':'%')).join(' · ')+'。同人群对应脚本有投放记录及复盘结论，暂无对照因果证据。',
      sources:[reportDescription(report)+' · '+report.source,...(rule?.evidence.slice(0,3).map(e=>e.name+' '+e.segment.start+'–'+e.segment.end+' 秒 · '+e.source)||[])]})
  }
  return [...observed,...hooks.map(h=>({id:'hook:'+h.id,hook:h.id,title:h.name,stages:[],status:'报告参考' as const,
    basis:'徕芬素材报告中约 '+h.share+'% 的开场使用此机制。占比反映目录分布。'+h.fit+'。'+h.risk,sources:[reportUrl]}))]
}

export function planningFacts(db:DB,insight:Insight){
  const matched=new Set(db.matches.filter(m=>m.insight===insight.id&&m.evidence.trim()).map(m=>m.fact))
  const approved=db.facts.filter(f=>verified(f)&&f.wording.trim()&&f.category!=='权益')
  return [...approved.filter(f=>matched.has(f.id)),...approved.filter(f=>!matched.has(f.id))].slice(0,6)
}

export function insightContext(insight:Insight){
  return {audience:word(insight.title),scene:word(insight.scene),buyer:word(insight.buyer),user:word(insight.user),
    problem:word(insight.pain),barrier:word(insight.barrier),motive:word(insight.motive),
    needs:insight.needs?.slice(0,5).map(word)||[],source:word(insight.source),status:insight.status,id:insight.id,age:word(insight.age),job:word(insight.job),relations:word(insight.relations),trigger:word(insight.trigger),alternatives:word(insight.alternatives),decision:word(insight.decision),confidence:insight.confidence}
}

export function strategyContext(structure:ScriptStructure){
  const hook=hooks.find(h=>h.id===structure.hook)
  return {title:structure.title,status:structure.status,stages:structure.stages,basis:structure.basis,
    sources:structure.sources,mechanism:hook?.lever||'',boundary:hook?.risk||''}
}

export function validScriptPlan(value:unknown):value is ScriptPlan{
  if(!value||typeof value!=='object')return false
  const p=value as ScriptPlan
  return [p.title,p.problem,p.angle,p.demo].every(validText)
    &&Array.isArray(p.segments)&&p.segments.length>0&&p.segments.length<=maxScriptSegments
    &&p.segments.every(s=>s&&validText(s.name)&&validText(s.purpose)&&(s.copy===undefined||typeof s.copy==='string'&&s.copy.length<=1800))
}

export function restoreScriptPlan({structure,plan}:ScriptPlanning):ScriptPlan{
  if('segments' in plan)return plan
  const {cta,beats,...brief}=plan
  return {...brief,segments:beats.map((purpose,index)=>({
    name:structure.stages[index],
    purpose:index===beats.length-1&&cta&&cta!==purpose?purpose+'\n'+cta:purpose
  }))}
}

export function validPlanning(value:unknown):value is ScriptPlanning{
  if(!value||typeof value!=='object')return false
  const {structure:s,plan,generation,commerce}=value as ScriptPlanning
  if(commerce!==undefined&&!validCommerceMeta(commerce))return false
  if(generation!==undefined&&(!generation||!validText(generation.provider)||typeof generation.model!=='string'||generation.model.length>120||!validMemory(generation.memory)))return false
  if(!s||![s.id,s.title,s.basis].every(validText)||!['报告参考','关联投放支持','开场对照支持'].includes(s.status)
    ||!Array.isArray(s.sources)||!s.sources.every(validText)||!Array.isArray(s.stages)
    ||s.stages.length>maxScriptSegments||!s.stages.every(validText)||!s.stages.length&&s.status!=='报告参考')return false
  if(validScriptPlan(plan))return true
  return !!plan&&typeof plan==='object'&&'beats' in plan&&[plan.title,plan.problem,plan.angle,plan.demo,plan.cta].every(validText)
    &&Array.isArray(plan.beats)&&plan.beats.length===s.stages.length&&plan.beats.every(validText)
}

function validText(v:unknown):v is string{return typeof v==='string'&&Boolean(v.trim())&&v.length<=1800}

export function plannedTiming(segments:ScriptSegment[]){
  let elapsed=0
  return segments.map((segment,i)=>{
    const spoken=Array.from((segment.copy||'').replace(/[\p{P}\s]/gu,'')).length
    const start=elapsed
    elapsed+=Math.max(i===0?3:4,Math.ceil(spoken/4))
    return `${start}–${elapsed} 秒`
  })
}

export function scriptFromModel(value:unknown,plan:ScriptPlan,facts:DB['facts']){
  if(!value||typeof value!=='object')throw Error('GPT 未返回可用脚本。')
  const data=value as {title:string;shots:{visual:string;copy?:string;line?:string}[]}
  if(!validText(data.title)||!Array.isArray(data.shots)||data.shots.length!==plan.segments.length||
    data.shots.some(s=>!s||!validText(s.visual)||!validText(s.copy??s.line)))throw Error('模型返回的分镜与策划结构不一致，请重试。')
  const written=data.shots.map(shot=>({visual:shot.visual,copy:(shot.copy??shot.line)!}))
  const text=[data.title,...written.flatMap(s=>[s.visual,s.copy])].join('\n')
  if(/(?:¥|￥)\s*\d|\d+(?:\.\d+)?\s*元/.test(text))throw Error('稿件含未经核验的价格，请调整策划后重试。')
  const warnings=audit(text,facts)
  if(warnings.length)throw Error('本次回复含需核验的表述：'+warnings.map(f=>f.term).join('、')+'。请调整策划后重试。')
  const timing=plannedTiming(written.map((shot,i)=>({...plan.segments[i],copy:shot.copy})))
  const shots=written.map((shot,i):StudioShot=>{
    const time=timing[i]
    return {time,part:plan.segments[i].name,content:shot.visual,subtitle:shot.copy}
  })
  return {title:data.title,shots}
}
