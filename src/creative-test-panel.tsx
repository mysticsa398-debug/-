import {useState} from 'react'
import {uid,type DB} from './domain'
import {compareCreativeTest,reportsFor,sameCreativeBody,testMetrics,type CreativeTest,type TestMetric} from './creative-test'
import {replace,type Update} from './library'
import {Badge,Empty,Field,Panel} from './ui'

const metricOptions=Object.entries(testMetrics).map(([value,label])=>({value,label}))
const blank={control:'',treatment:'',hypothesis:'',conditions:'',primary:'hold',guardrail:'roi',guardrailMin:0,
  controlReport:'',treatmentReport:'',aligned:false} as const
const asNumber=(value:number|null,suffix='')=>value===null?'—':value.toFixed(2)+suffix

export default function CreativeTestPanel({db,update,notify,initial}:{db:DB;update:Update;notify:(message:string)=>void;initial?:{script:string;version:string;control:string}}){
  const plans=db.creativeTests||[]
  const [draft,setDraft]=useState<CreativeTest|undefined>(()=>{
    if(!initial)return
    const script=db.scripts.find(s=>s.id===initial.script)
    const treatment=script?.versions.find(v=>v.id===initial.version)
    const control=script?.versions.find(v=>v.id===initial.control&&treatment&&sameCreativeBody(v,treatment))
    return {...blank,id:uid(),title:(script?.title||'S8mini')+' · 开场对照',script:initial.script,control:control?.id||'',treatment:initial.version,sample:db.thresholds.sample}
  })
  const script=db.scripts.find(s=>s.id===draft?.script)
  const versions=script?.versions||[]
  const control=versions.find(v=>v.id===draft?.control),treatment=versions.find(v=>v.id===draft?.treatment)
  const matched=Boolean(control&&treatment&&sameCreativeBody(control,treatment))
  const select=(id:string)=>plans.find(p=>p.id===id)
  const patch=(next:Partial<CreativeTest>)=>setDraft(d=>d?{...d,...next}:d)
  const versionOptions=[{value:'',label:'选择版本'},...versions.map((v,i)=>({value:v.id,label:`版本 ${versions.length-i} · ${v.variant}`}))]

  function save(){
    if(!draft)return
    if(!draft.title.trim()||!draft.hypothesis.trim()||!draft.conditions.trim()||!matched){notify('请填写标题、假设和固定条件，并选择两个仅前三秒不同的脚本版本。');return}
    if(draft.primary===draft.guardrail||!Number.isSafeInteger(draft.sample)||draft.sample<1||!Number.isFinite(draft.guardrailMin)||
      draft.guardrail!=='roi'&&(draft.guardrailMin<0||draft.guardrailMin>100)){
      notify('主指标与护栏应不同。请检查展现量和护栏阈值。');return
    }
    if(update(d=>({...d,creativeTests:replace(d.creativeTests||[],draft)})))notify('素材 A/B 计划已保存。')
  }

  const reportA=draft?reportsFor(draft,db.experiments,'control'):[]
  const reportB=draft?reportsFor(draft,db.experiments,'treatment'):[]
  const a=reportA.find(e=>e.id===draft?.controlReport), b=reportB.find(e=>e.id===draft?.treatmentReport)
  const comparison=draft?compareCreativeTest(draft,a,b):null
  return <Panel title="素材 A/B 对照" action="新建测试计划" onAction={()=>setDraft({...blank,id:uid(),title:'',script:'',sample:db.thresholds.sample})}>
    <p className="muted">先确定要验证的开场、指标和固定投放条件。投放后关联两组实验报表。</p>
    <Field label="已保存的测试计划" value={plans.some(p=>p.id===draft?.id)?draft!.id:''} options={[{value:'',label:'选择计划'},...plans.map(p=>({value:p.id,label:p.title}))]} change={id=>setDraft(select(id))}/>
    {!draft&&<Empty>还没有打开的计划。也可从脚本工作台直接发起。</Empty>}
    {draft&&<>
      <div className="form-grid">
        <Field label="计划标题" value={draft.title} change={title=>patch({title})}/>
        <Field label="对照脚本" value={draft.script} options={[{value:'',label:'选择脚本'},...db.scripts.map(s=>({value:s.id,label:s.title}))]} change={script=>patch({script,control:'',treatment:'',controlReport:'',treatmentReport:'',aligned:false})}/>
        <Field label="A · 对照版本" value={draft.control} options={versionOptions} change={control=>patch({control,controlReport:'',aligned:false})}/>
        <Field label="B · 改版版本" value={draft.treatment} options={versionOptions} change={treatment=>patch({treatment,treatmentReport:'',aligned:false})}/>
        <Field label="测试假设" value={draft.hypothesis} long change={hypothesis=>patch({hypothesis})}/>
        <Field label="固定投放条件（SKU、价格权益、受众、版位、时间）" value={draft.conditions} long change={conditions=>patch({conditions,aligned:false})}/>
        <Field label="主指标" value={draft.primary} options={metricOptions} change={v=>patch({primary:v as TestMetric})}/>
        <Field label="护栏指标" value={draft.guardrail} options={metricOptions} change={v=>patch({guardrail:v as TestMetric})}/>
        <Field label="护栏最低值（比率填百分数）" type="number" value={Number.isFinite(draft.guardrailMin)?String(draft.guardrailMin):''} change={v=>patch({guardrailMin:v===''?NaN:Number(v)})}/>
        <Field label="每组最低展现量（计划值）" type="number" value={Number.isFinite(draft.sample)?String(draft.sample):''} change={v=>patch({sample:v===''?NaN:Number(v)})}/>
      </div>
      {control&&treatment&&<p><Badge tone={matched?'green':'orange'}>{matched?'前三秒不同，后续分镜一致':'所选版本未形成仅前三秒不同的对照'}</Badge></p>}
      <div className="form-grid">
        <Field label="A · 投放报表" value={draft.controlReport} options={[{value:'',label:'待录入'},...reportA.map(e=>({value:e.id,label:e.title}))]} change={controlReport=>patch({controlReport,aligned:false})}/>
        <Field label="B · 投放报表" value={draft.treatmentReport} options={[{value:'',label:'待录入'},...reportB.map(e=>({value:e.id,label:e.title}))]} change={treatmentReport=>patch({treatmentReport,aligned:false})}/>
      </div>
      {a&&b&&<><p className="muted">A · {a.date} · {a.impressions} 展现 · {a.source}<br/>B · {b.date} · {b.impressions} 展现 · {b.source}</p>
        <label className="row"><input type="checkbox" checked={draft.aligned} onChange={e=>patch({aligned:e.target.checked})}/>已核对两组观察窗口、归因和指标口径一致</label></>}
      {comparison&&<div className="table-wrap"><table><thead><tr><th>指标</th><th>A</th><th>B</th><th>B − A</th></tr></thead><tbody>{comparison.rows.map(r=><tr key={r.key}>
        <td>{testMetrics[r.key]}{draft.primary===r.key?' · 主指标':draft.guardrail===r.key?' · 护栏':''}</td>
        <td>{asNumber(r.control,r.key==='roi'?'':'%')} <small>{r.controlSource}</small></td>
        <td>{asNumber(r.treatment,r.key==='roi'?'':'%')} <small>{r.treatmentSource}</small></td>
        <td>{asNumber(r.delta,r.key==='roi'?'':' 个百分点')}</td>
      </tr>)}</tbody></table></div>}
      {comparison?.issues.length?<ul>{comparison.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>:<p className="muted">已满足所填观察条件。差值为描述性结果，显著性仍待验证。</p>}
      <button className="button primary" onClick={save}>保存 A/B 计划</button>
    </>}
  </Panel>
}
