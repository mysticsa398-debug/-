import {studioShot,videoCopy} from './studio-engine.ts'
import {metrics,type DB,type Insight} from './domain.ts'

export type MemoryEntry={kind:'规律'|'脚本'|'投放',id:string,title:string,summary:string}
export type GenerationSource={provider:string;model:string;memory:MemoryEntry[]}

export function creativeMemory(db:DB,insight:Insight):MemoryEntry[]{
  const trim=(value:string)=>value.trim().slice(0,280)
  const scripts=db.scripts.filter(s=>s.insight===insight.id)
  const relevantRules=(db.rules||[]).filter(rule=>rule.status==='已审核'&&(
    insight.audiences.some(a=>a&&rule.audience.includes(a))||
    db.designs?.some(d=>d.rule===rule.id&&d.insight===insight.id)
  ))
  const rules:MemoryEntry[]=relevantRules.slice(0,4).map(r=>({
    kind:'规律',id:r.id,title:r.title,summary:trim([r.transfer,r.limits,'置信度 '+r.confidence].filter(Boolean).join(' · '))
  }))
  const history:MemoryEntry[]=scripts.flatMap(s=>s.versions.filter(v=>v.date).slice(0,1).map(v=>({
    kind:'脚本' as const,id:v.id,title:v.title||s.title,summary:trim(v.variant+' · '+(v.shots[0]?videoCopy(studioShot(v.shots[0])):''))
  }))).slice(0,3)
  const experiments:MemoryEntry[]=db.experiments.filter(e=>e.insight===insight.id&&e.impressions>0&&e.source.trim()&&e.version&&
    scripts.some(s=>s.id===e.script&&s.versions.some(v=>v.id===e.version)))
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(e=>{
      const values=metrics(e)
      const stats=[values.hold===null?'':'5 秒完播率 '+values.hold.toFixed(1)+'%',values.ctr===null?'':'CTR '+values.ctr.toFixed(1)+'%']
      return {kind:'投放',id:e.id,title:e.title,summary:trim([e.date,e.impressions+' 次展现',...stats,e.notes,'观察结果，需对照复测'].filter(Boolean).join(' · '))}
    })
  return [...rules,...history,...experiments].map(entry=>({...entry,title:trim(entry.title)}))
}

export function validMemory(value:unknown):value is MemoryEntry[]{
  return Array.isArray(value)&&value.length<=10&&value.every(entry=>entry&&['规律','脚本','投放'].includes(entry.kind)&&
    ['id','title','summary'].every(key=>typeof entry[key]==='string'&&entry[key].length<=320)&&Boolean(entry.id.trim()))
}
