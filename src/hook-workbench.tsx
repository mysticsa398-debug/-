import {useEffect,useState} from 'react'
import {Badge,Field,Panel} from './ui'
import {timeShots,type Shot} from './domain'
import {formatShootingScript} from './shooting-script'
import {deepAnalysis,mideaSource,mideaText,migrateRows,migrationPreview,routeNames,splitMaterial,reportSections,structureFormula,structureVideo,type Segment} from './material-structure'
import type {Material} from './video-analysis'

export type ApplyMaterialDraft=(shots:Shot[],title:string,problem:string,proof:string,material?:string)=>void

export function HookWorkbench({onApplyDraft,notify,material,seek}:{onApplyDraft:ApplyMaterialDraft;notify:(s:string)=>void;material?:Material;seek?:(time:number)=>void}){
 const [source,setSource]=useState(mideaSource),[original,setOriginal]=useState(mideaText)
 const [rows,setRows]=useState<Segment[]>(()=>splitMaterial(mideaText)),[route,setRoute]=useState(0)
 const [draft,setDraft]=useState<Shot[]>([]),[notes,setNotes]=useState(''),[stale,setStale]=useState(false)
 useEffect(()=>{setDraft([])},[material])
 const timedRows=material?structureVideo(material):[]
 const reportRows=material?timedRows:rows
 const isMidea=!material&&source===mideaSource&&original===mideaText
 const deep=deepAnalysis(reportRows,isMidea)
 const title=`S8mini · ${routeNames[route]} · 素材结构迁移`
 async function copy(text:string){try{await navigator.clipboard.writeText(text);notify('已复制。')}catch{notify('复制不可用，请选中文本手动复制。')}}
 function edit(index:number,key:keyof Segment,value:string){setRows(rs=>rs.map((r,i)=>i===index?{...r,[key]:value}:r));setDraft([])}
 return <section className="hook-workbench material-method">
 {material?<Panel title={reportSections[0]}>
 <p>来源 · {material.source||material.name}</p><p className="muted">{material.transcriptNote}</p>
 {!!material.cues.length&&<details><summary>带时间码的口播 / 导入字幕</summary>{material.cues.map((cue,i)=><p key={i}><button className="text-button" onClick={()=>seek?.(cue.start)}>{cue.start}–{cue.end} 秒</button> {cue.text}</p>)}</details>}
 {material.screenNote&&<p className="muted">{material.screenNote}</p>}
 {!!material.screenCues?.length&&<details><summary>画面字幕候选 · {material.screenCues.length} 段</summary>{material.screenCues.map((cue,i)=><p key={i}><button className="text-button" onClick={()=>seek?.(cue.start)}>{cue.start.toFixed(1)}–{cue.end.toFixed(1)} 秒</button> {cue.text}</p>)}</details>}
  <p className="muted">拆解依据 · {material.cues.length?'带时间码的口播 / 导入字幕':material.screenCues?.length?'画面字幕候选（当前无口播）':'镜头采样和人工记录'}</p>
<p className="structure-formula">{structureFormula(reportRows)||'结构待确认'}</p>
 </Panel>:<>
 <Panel title={reportSections[0]} action="载入美的案例" onAction={()=>{setSource(mideaSource);setOriginal(mideaText);setRows(splitMaterial(mideaText));setDraft([]);setStale(false)}}>
 <p className="muted">依据你提供的美的拆解文档。时间段沿用文档公式，原文按相应段落对齐；精确逐字时间需回看原片。原文中的参数与效果是竞品素材表述，不是 S8mini 事实。</p>
 <Field label="来源链接或标题" value={source} change={v=>{setSource(v);setDraft([])}}/>
 <Field label="素材原文（每行一段，可用 0–3.3秒｜口播）" long value={original} change={v=>{setOriginal(v);setStale(true);setDraft([])}}/>
 <div className="inline-buttons"><button className="button primary" disabled={!original.trim()} onClick={()=>{setRows(splitMaterial(original));setStale(false);setDraft([])}}>拆解素材结构</button><a className="text-button" href={mideaSource} target="_blank" rel="noreferrer">查看美的原文 ↗</a><Badge>{stale?'原文已改，请重新拆解':'规则辅助 · 可逐段校正'}</Badge></div>
 <p className="structure-formula">{structureFormula(reportRows)}</p>
 </Panel></>}
 {material&&!reportRows.length&&<p className="muted">尚无可拆解的镜头或口播。导入字幕，或在人工复核中添加时间段。</p>}
 {!stale&&(reportRows.length>0||material)&&<>
 <Panel title={`${reportSections[1]} · ${reportRows.length} 个段落`}><p className="muted">逐段回答：说了什么、承担什么任务、为什么这样写、用什么证明、移植时保留什么。{material?'点击时间码回看，校正在人工复核中保存。':'点击展开可校正时间、作用及画面。'}</p>
 <div className="segment-list">{reportRows.map((r,i)=><details className="segment-card" key={i} open={i===0}><summary><span className="segment-number">{String(i+1).padStart(2,'0')}</span><b>{r.time}</b><Badge tone={i===0?'green':'neutral'}>{r.stage}</Badge><span>{r.line||'暂无口播'}</span></summary><div className="segment-body"><blockquote>{r.line||'暂无口播'}</blockquote>{material&&<div className="inline-buttons"><button className="text-button" onClick={()=>seek?.(timedRows[i].start)}>回看 {r.time}</button>{timedRows[i].path&&<Badge>{timedRows[i].path}</Badge>}</div>}<div className="method-columns"><div><h4>这一步为什么存在</h4><p>{r.why}</p><h4>证据与判断边界</h4><p>{r.proof}</p></div><div><h4>移植到 S8mini</h4><p>{r.move}</p><h4>画面依据</h4><p>{isMidea&&i===0?'文档描述为粉色吹风机展示；其余画面须回看原片。':r.visual}</p></div></div>{!material&&<div className="form-grid"><Field label={`第 ${i+1} 段时间`} value={r.time} change={v=>edit(i,'time',v)}/><Field label={`第 ${i+1} 段结构作用`} value={r.stage} change={v=>edit(i,'stage',v)}/><Field label={`第 ${i+1} 段画面与屏幕文字`} long value={r.visual} change={v=>edit(i,'visual',v)}/><Field label={`第 ${i+1} 段机制判断`} long value={r.why} change={v=>edit(i,'why',v)}/></div>}</div></details>)}</div>
 </Panel>
 <Panel title={reportSections[2]}><div className="deep-grid">{deep.map(([name,value])=><article key={name}><h3>{name}</h3><p>{value}</p></article>)}</div>{!material&&<><Field label="人工复核：最值得复用的重点与反证" long value={notes} change={setNotes}/><div className="notice">文档把部分段落称为「功效验证 / 数据验证」。本工作台区分口播诉求与已验证结果；是否有有效证据，需要对照原片和测试记录。</div></>}</Panel>
 <Panel title={reportSections[3]}><div className="inline-buttons">{routeNames.map((name,i)=><button key={name} className={'button '+(route===i?'primary':'')} onClick={()=>{setRoute(i);setDraft([])}}>{name}</button>)}</div><p className="muted">按上面的每一段结构生成原创草稿。开头改为该人群的具体需求，正文保留演示顺序，结尾用真实产品信息建立信任。当前为本地规则模板；未核验参数和价格不自动写入。</p><div className="table-wrap"><table><thead><tr><th>参考结构</th><th>保留的机制 / 替换内容</th><th>S8mini 文案候选</th></tr></thead><tbody>{migrationPreview(reportRows,route).map(({segment,shot},i)=><tr key={i}><td>{i+1}. {segment.stage}</td><td>{segment.move}</td><td>{shot.line}</td></tr>)}</tbody></table></div><div className="inline-buttons"><button className="button primary" disabled={!reportRows.length} onClick={()=>{setDraft(migrateRows(reportRows,route));notify('已生成完整迁移草稿，可编辑后送入脚本工作台。')}}>生成 S8mini 完整文案</button><button className="button" onClick={()=>void copy(`来源：${material?(material.source||material.name):source}\n\n${deep.map(x=>x.join('\n')).join('\n\n')}\n\n逐段拆解\n${reportRows.map(r=>`${r.time} ${r.stage}\n原文：${r.line}\n作用：${r.why}\n证据：${r.proof}\n迁移：${r.move}`).join('\n\n')}\n人工复核：${notes}`)}>复制深度拆解</button></div>
 {draft.length>0&&<div className="migration-draft"><h3>{title}</h3><p className="muted">预计时长按口播估算，不沿用竞品秒数；试读后调整。每段保留原结构对应关系。</p>{draft.map((s,i)=><div className="draft-row" key={i}><b>{s.time} · {s.part}</b><Field label={`迁移第 ${i+1} 段口播`} long value={s.line} change={v=>setDraft(ds=>timeShots(ds.map((x,n)=>n===i?{...x,line:v,subtitle:v}:x),3))}/><Field label={`迁移第 ${i+1} 段拍摄画面`} long value={s.visual} change={v=>setDraft(ds=>ds.map((x,n)=>n===i?{...x,visual:v}:x))}/></div>)}<div className="inline-buttons"><button className="button primary" disabled={draft.some(s=>!s.line.trim()||!s.visual.trim())} onClick={()=>onApplyDraft(draft,title,routeNames[route],draft.map(s=>s.visual).join('\n'),material?.id)}>整稿送入脚本生成，继续编辑与保存</button><button className="button" onClick={()=>void copy(formatShootingScript(title,draft))}>复制完整分镜文案</button></div></div>}
 </Panel></>}
 </section>
}
