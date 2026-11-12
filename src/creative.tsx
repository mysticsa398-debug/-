import {useState} from 'react'
import {ArrowRight,BookOpen} from 'lucide-react'
import {hooks,reportUrl,type HookId} from './creative-engine'
import {scriptStructures} from './script-planning'
import {type DB} from './domain'
import {Badge,Field,PageHead,Panel} from './ui'

export default function CreativeLab({db,openPlanning}:{db:DB;openPlanning:(insight:string,structure:string)=>void}){
  const [hookId,setHook]=useState<HookId>('C')
  const [insightId,setInsight]=useState('')
  const hook=hooks.find(h=>h.id===hookId)!
  const sources=insightId?scriptStructures(db,insightId).filter(s=>s.status!=='报告参考'):[]
  return <>
    <PageHead label="创意研究" title="爆款策略实验室" description="给 S8mini 吹发脚本选择开场机制，核对真实投放能支持的结论。"/>
    <details className="source-note"><summary><BookOpen size={16}/> 徕芬素材报告与使用边界</summary>
      <p><a href={reportUrl} target="_blank" rel="noreferrer">《徕芬吹风机 近30天新投放爆款素材分析报告》 ↗</a></p>
      <p>目录占比反映报告样本里开场机制的分布。原始样本及投放数据待核验，S8mini 的效果以本站关联的实际投放为依据。</p>
    </details>
    <div className="creative-columns">
      <Panel title="选择人群洞察">
        <Field label="本次创作的人群洞察" value={insightId} change={setInsight}
          options={[{value:'',label:'选择一个人群'},...db.insights.map(i=>({value:i.id,label:i.title}))]}/>
        {sources.map(s=><div className="creative-title" key={s.id}><Badge tone="green">{s.status}</Badge><b>{s.title}</b><p>{s.basis}</p>
          <button className="button" onClick={()=>openPlanning(insightId,s.id)}>用此投放结构做策划 <ArrowRight size={16}/></button></div>)}
        {insightId&&!sources.length&&<p className="muted">此人群可参考报告结构生成待验证试拍稿。可在<a href="#experiments">实验复盘</a>关联实测报表。</p>}
      </Panel>
      <Panel title="参考机制">
        <Badge tone="orange">报告参考</Badge><h3>{hook.name}</h3><p>{hook.lever}。{hook.risk}</p>
        <button className="button primary" disabled={!insightId} onClick={()=>openPlanning(insightId,'hook:'+hook.id)}>带入脚本策划 <ArrowRight size={16}/></button>
      </Panel>
    </div>
    <div className="section-title"><h2>报告中的开场机制</h2></div>
    <div className="hook-grid">{hooks.map(h=><button key={h.id} aria-pressed={h.id===hookId}
      className={'hook-card '+(h.id===hookId?'selected':'')} onClick={()=>setHook(h.id)}>
      <div className="row between"><strong>{h.name}</strong><small>报告约 {h.share}%</small></div><p>{h.lever}</p><span className="hook-fit">{h.fit}</span>
    </button>)}</div>
  </>
}
