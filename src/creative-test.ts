import {metrics,type Experiment,type Version} from './domain.ts'
import {studioShot} from './studio-engine.ts'

export const testMetrics={hold:'5 秒完播率',ctr:'点击率',cvr:'点击转化率',roi:'净 ROI'} as const
export type TestMetric=keyof typeof testMetrics
export type CreativeTest={
  id:string; title:string; script:string; control:string; treatment:string; hypothesis:string;
  conditions:string; primary:TestMetric; guardrail:TestMetric; guardrailMin:number;
  sample:number; controlReport:string; treatmentReport:string; aligned:boolean
}
export function sameCreativeBody(a:Version,b:Version){
  const left=a.shots.map(studioShot),right=b.shots.map(studioShot)
  const hasOpening=(time:string)=>/^0+\s*[–-]\s*0?3\s*秒?$/.test(time)
  if(!left[0]||!right[0]||!hasOpening(left[0].time)||!hasOpening(right[0].time))return false
  if(left[0].content===right[0].content&&left[0].subtitle===right[0].subtitle&&left[0].narration===right[0].narration)return false
  return JSON.stringify(left.slice(1))===JSON.stringify(right.slice(1))
}
export function reportsFor(plan:CreativeTest,experiments:Experiment[],arm:'control'|'treatment'){
  return experiments.filter(e=>e.script===plan.script&&e.version===plan[arm])
}
export function compareCreativeTest(plan:CreativeTest,a?:Experiment,b?:Experiment){
  const keys=Object.keys(testMetrics) as TestMetric[]
  const resultsA=a&&metrics(a), resultsB=b&&metrics(b)
  const rows=keys.map(key=>{
    const control=resultsA?.[key]??null,treatment=resultsB?.[key]??null
    return {key,control,treatment,delta:control===null||treatment===null?null:treatment-control,
      controlSource:control===null?'缺失':a?.reported?.[key]!==undefined?'报表录入':'按明细计算',
      treatmentSource:treatment===null?'缺失':b?.reported?.[key]!==undefined?'报表录入':'按明细计算'}
  })
  const issues:string[]=[]
  if(!a||!b)issues.push('需要为 A 和 B 各选一条对应脚本版本的报表。')
  if(!plan.aligned)issues.push('待确认两组使用一致的观察窗口、归因和指标口径。')
  if(a&&b){
    if(a.impressions<plan.sample||b.impressions<plan.sample)issues.push('至少一组未达到预设展现量。')
    if(rows.find(r=>r.key===plan.primary)?.delta===null)issues.push('主指标缺失。')
    const guardrail=rows.find(r=>r.key===plan.guardrail)!
    if(guardrail.control===null||guardrail.treatment===null)issues.push('护栏指标缺失。')
    else if(guardrail.treatment<plan.guardrailMin)issues.push('B 组低于预设护栏。')
  }
  return {rows,issues}
}
