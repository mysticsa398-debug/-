import {useState} from 'react'
import {audiences} from './domain'
import {reviewFields, segment, stages, type SourceEvidence, type Segment} from './research'
import {span, type Material} from './video-analysis'
import {Field, opts} from './ui'

export function mediaLink(input:string){
  try{
    const url=new URL(input)
    return url.protocol==='https:'&&!url.username&&!url.password?url.href:''
  }catch{return ''}
}

export function VideoReview({report,save,seek,extract}:{report:Material;save:(next:Material)=>Promise<boolean>;seek:(time:number)=>void;extract:(source:SourceEvidence)=>void}){
  const [draft,setDraft]=useState(report)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const rows=draft.segments??[]
  const edit=(id:string,patch:Partial<Segment>)=>setDraft({...draft,segments:rows.map(r=>r.id===id?{...r,...patch}:r)})
  async function persist(evidence?:Segment){
    setError('')
    if(draft.mediaUrl&&!mediaLink(draft.mediaUrl)){setError('请输入有效的 HTTPS 视频直链。');return}
    if(!draft.name.trim()||!Number.isFinite(draft.duration)||draft.duration<=0||rows.some(r=>!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.start<0||r.end<=r.start||r.end>draft.duration)){
      setError('请填写标题和有效视频时长。每段起止秒数必须在视频时长内。');return
    }
    setBusy(true)
    try{
      if(await save({...draft,segments:[...rows].sort((a,b)=>a.start-b.start)})&&evidence){
        extract({material:draft.id,name:draft.name,source:draft.source,brand:draft.brand||'',segment:evidence})
      }
    }finally{setBusy(false)}
  }
  return <details open className="review-panel"><summary>人工复核与逐段记录</summary>
    <p className="muted">记录原片观察、心理假设和局限。可添加任意时间段，也可用每秒定位复核快切。平台分享页需在原平台回看，或取得可用文件后导入。</p>
    <fieldset disabled={busy}>
      <div className="video-form">
        <Field label="素材标题" value={draft.name} change={name=>setDraft({...draft,name})}/>
        <Field label="品牌" value={draft.brand||''} change={brand=>setDraft({...draft,brand})}/>
        <Field label="来源名称 / 链接" value={draft.source} change={source=>setDraft({...draft,source})}/>
        <Field label="HTTPS 视频文件直链" value={draft.mediaUrl||''} change={mediaUrl=>setDraft({...draft,mediaUrl})}/>
        <Field label="场景" value={draft.context||''} change={context=>setDraft({...draft,context})}/>
        <Field label="参考卖点" value={draft.selling||''} change={selling=>setDraft({...draft,selling})}/>
      </div>
      <div className="tags">{audiences.map(a=><label key={a}><input type="checkbox" checked={draft.audiences?.includes(a)||false} onChange={e=>setDraft({...draft,audiences:e.target.checked?[...(draft.audiences||[]),a]:(draft.audiences||[]).filter(item=>item!==a)})}/>{a}</label>)}</div>
      <div className="inline-buttons">
        <button className="button" onClick={()=>{
          const ranges=[[0,3],[3,5],[5,10]]
          const added=ranges.filter(([a,b])=>a<draft.duration&&!rows.some(r=>r.start===a&&r.end===Math.min(b,draft.duration))).map(([a,b],i)=>segment(a,Math.min(b,draft.duration),i===0&&a===0?'注意':'兴趣'))
          setDraft({...draft,segments:[...rows,...added]})
        }}>添加 0–3 / 3–5 / 5–10 秒</button>
        <button className="button" onClick={()=>setDraft({...draft,segments:[...rows,segment(0,Math.min(1,draft.duration),'注意')]})}>新增时间段</button>
        <label>逐秒定位 <input type="number" min="0" max={Math.floor(draft.duration)} step="1" defaultValue="0" onChange={e=>{if(e.target.value&&e.target.validity.valid)seek(Number(e.target.value))}}/></label>
      </div>
      {rows.map(row=><details key={row.id} className="review-panel"><summary>{span(row.start,row.end)} · {row.stage} {row.start===0?'· 开场':''}</summary>
        <div className="inline-buttons">
          <label>开始秒 <input type="number" step=".001" value={row.start} onChange={e=>edit(row.id,{start:Number(e.target.value)})}/></label>
          <label>结束秒 <input type="number" step=".001" value={row.end} onChange={e=>edit(row.id,{end:Number(e.target.value)})}/></label>
          <button className="button" onClick={()=>seek(row.start)}>回看起点</button>
          <button className="button" onClick={()=>setDraft({...draft,segments:rows.filter(r=>r.id!==row.id)})}>移除本段</button>
        </div>
        <Field label="路径阶段" options={opts([...stages])} value={row.stage} change={stage=>edit(row.id,{stage})}/>
        <div className="video-form">{(Object.keys(reviewFields) as (keyof typeof reviewFields)[]).map(k=><Field key={k} label={reviewFields[k]} long value={row[k]} change={v=>edit(row.id,{[k]:v})}/>)}</div>
        <button className="button" disabled={!row.evidence.trim()||!row.mechanism.trim()} onClick={()=>void persist(row)}>保存本段并提炼规律</button>
      </details>)}
      {error&&<p role="alert" className="video-error">{error}</p>}
      <button className="button primary" onClick={()=>void persist()}>保存素材与拆解</button>
    </fieldset>
    {!!report.segments?.length&&<div className="table-wrap"><table><thead><tr>{['时间','路径','画面 / 口播','卖点与信任','可能机制','证据与局限','承接'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{report.segments.map(r=><tr key={r.id}><td><button className="text-button" onClick={()=>seek(r.start)}>{span(r.start,r.end)}</button></td><td>{r.stage}</td><td>{[r.visual,r.camera,r.speech,r.subtitle,r.emotion].filter(Boolean).join(' · ')||'待复核'}</td><td>{r.selling||'待复核'}</td><td>{r.mechanism||'待复核'}</td><td>{r.evidence||'缺少证据'} / {r.limits||'局限待补充'}</td><td>{r.bridge||'待复核'}</td></tr>)}</tbody></table></div>}
  </details>
}
