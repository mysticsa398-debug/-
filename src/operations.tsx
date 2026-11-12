import CreativeTestPanel from './creative-test-panel'
import {listMaterials} from './video-storage'
import {ruleDraft, type SourceEvidence} from './research'
import {useEffect,useState} from 'react'
import {ArrowDownToLine, FileUp, FlaskConical, Info} from 'lucide-react'
import {blankExperiment,defaults,experimentError,metricFields,metrics,type DB,type Experiment} from './domain'
import {replace,type Update} from './library'
import {decode,download} from './storage'
import {Badge,Empty,Field,Modal,PageHead,Panel,opts} from './ui'
const outcomes=['待判断','已验证假设','已否定假设']
const keys=Object.keys(metricFields) as (keyof typeof metricFields)[]
const currency=(n:number)=>n.toLocaleString('zh-CN',{style:'currency',currency:'CNY'})
const number=(n:number|null,suffix='')=>n===null?'—':n.toFixed(2)+suffix
const thresholdLabels={hold:'5 秒完播率（%）',ctr:'CTR（%）',cvr:'点击转化率（%）',roi:'净 ROI',sample:'最少展现量'}
export function Experiments({db,update,notify,initialTest}:{db:DB;update:Update;notify:(s:string)=>void;initialTest?:{script:string;version:string;control:string}}){
  const [draft,setDraft]=useState<Experiment|null>(null)
  const [limits,setLimits]=useState<DB['thresholds']|null>(null)
  const [suggesting,setSuggesting]=useState(false)
  const [localModel,setLocalModel]=useState(false)
  useEffect(()=>{
    const controller=new AbortController()
    fetch('/api/script-generation',{signal:controller.signal}).then(r=>r.json()).then(r=>setLocalModel(r.mode==='llm')).catch(()=>{})
    return ()=>controller.abort()
  },[])
  const [active,setActive]=useState('')
  const e=db.experiments.find(e=>e.id===active)||db.experiments[0]
  const linked=db.scripts.find(s=>s.id===draft?.script)
  function submit(){
    if(!draft)return
    const error=experimentError(draft)
    if(error){notify(error);return}
    if(update(d=>({...d,experiments:replace(d.experiments,draft)}))){
      setActive(draft.id);setDraft(null);notify(draft.outcome==='待判断'?'实验已保存。':'实验已保存，假设结论已回流关联洞察。')
    }
  }
  function submitLimits(){
    if(!limits)return
    if(Object.values(limits).some(v=>!Number.isFinite(v)||v<0)||[limits.hold,limits.ctr,limits.cvr].some(v=>v>100)||!Number.isSafeInteger(limits.sample)||limits.sample<1){notify('请检查阈值，最少展现量须为正整数。');return}
    if(update(d=>({...d,thresholds:limits})))setLimits(null)
  }
  const m=e?metrics(e):null
  const funnel=m?[
    {name:'5 秒完播率',value:m.hold,target:db.thresholds.hold,suffix:'%',reason:'低于阈值，检查开场画面、节奏和受众对场景的辨识。'},
    {name:'CTR',value:m.ctr,target:db.thresholds.ctr,suffix:'%',reason:'低于阈值，检查卖点是否具体、商品入口是否清晰。'},
    {name:'点击转化率',value:m.cvr,target:db.thresholds.cvr,suffix:'%',reason:'低于阈值，检查内容承诺与商品页、价格及权益是否一致。'},
    {name:'净 ROI',value:m.roi,target:db.thresholds.roi,suffix:'',reason:'低于阈值，检查流量成本、客单价、转化和退款。'}
  ]:[]
  async function suggest(useModel:boolean){
    if(!e||!m||suggesting||e.impressions<=0||funnel.every(f=>f.value===null)){notify('请先保存有来源、展现和至少一项有效指标的实验。');return}
    const version=db.scripts.find(s=>s.id===e.script)?.versions.find(v=>v.id===e.version)
    if(!version){notify('请先关联脚本版本。');return}
    const design=db.designs?.find(d=>d.id===version.design)
    const rule=db.rules?.find(r=>r.id===design?.rule)
    if(useModel&&!window.confirm('将投放指标和关联素材的文字证据发送到已配置的模型接口？'))return
    setSuggesting(true)
    try{
      let evidence:SourceEvidence[]=rule?.evidence||[]
      if(!evidence.length&&version.material){
        const report=(await listMaterials()).find(x=>x.report.id===version.material)?.report
        if(report)evidence=(report.segments||[]).filter(s=>s.evidence.trim()).map(segment=>({material:report.id,name:report.name,brand:report.brand||'',source:report.source,segment}))
      }
      if(!evidence.length){notify('请先为关联视频保存有时间码和观察证据的复核段，或关联来源规律。');return}
      const checked=funnel.filter(f=>f.value!==null)
      const weak=checked.find(f=>f.value!<f.target)
      let reason=weak?.reason||'已有指标达到当前内部参考值，可在同条件下复测并增加对照素材。'
      const details=checked.map(f=>f.name+' '+number(f.value,f.suffix)).join('、')
      if(useModel){
        const response=await fetch(db.endpoint||'/api/script-generation',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),
          body:JSON.stringify({operation:'suggest-rule',observation:`${e.impressions} 次展现 · ${details}。内部参考：${checked.map(f=>f.name+' '+f.target+f.suffix).join('、')}`,
            evidence:evidence.slice(0,8).map(({segment:s})=>`${s.start}–${s.end} 秒 ${s.evidence}`).join('\n')})})
        const result=await response.json().catch(()=>null)
        if(!response.ok||typeof result?.reason!=='string'||!result.reason.trim())throw Error('模型接口未返回有效建议，可使用本地指标规则。')
        reason=result.reason
      }
      const candidate={...ruleDraft(evidence[0]),evidence,experiment:e.id,title:e.title+' · 创意假设',mechanism:reason,
        category:weak?.name==='5 秒完播率'?'前三秒吸引':'转化路径',basis:`${useModel?'模型建议':'本地指标规则'} · ${e.source} · ${e.date} · ${e.impressions} 次展现 · ${details}`,
        limits:'单次观察受投放、受众、价格和统计口径影响。需要对照复测才能判断机制。'+(e.impressions<db.thresholds.sample?' 样本低于内部参考。':''),
        hypothesis:'固定商品、价格、受众和投放条件，每次只替换一个素材变量。',transfer:reason}
      if(update(d=>({...d,rules:[candidate,...(d.rules||[])]})))notify('已创建待审核规律建议，可在脚本工作台的规律库审核。')
    }catch(error){notify(error instanceof Error?error.message:'生成建议失败。')}
    finally{setSuggesting(false)}
  }
  return <><PageHead label="投放与验证" title="实验复盘" description="用可追溯的投放结果评估内容，并将结论关联到洞察与脚本版本。" action="录入实验" onAction={()=>setDraft(blankExperiment())}/><div className="notice threshold"><Info size={18}/><span>内部待校准阈值 · {db.thresholds.hold}% 完播 / {db.thresholds.ctr}% CTR / {db.thresholds.cvr}% 转化 / {db.thresholds.roi} 净 ROI</span><button className="text-button" onClick={()=>setLimits({...db.thresholds})}>编辑阈值</button></div>
  <CreativeTestPanel db={db} update={update} notify={notify} initial={initialTest}/>
  <div className="studio-grid"><Panel title="实验列表">{db.experiments.map(item=><button key={item.id} className={'list-button '+(e?.id===item.id?'active':'')} onClick={()=>setActive(item.id)}><FlaskConical size={17}/><span>{item.title}<small>{item.date||'日期未填'} · {item.outcome}</small></span></button>)}{!e&&<Empty>录入首个真实实验后查看复盘。</Empty>}</Panel><div className="stack"><Panel title={e?.title||'实验结果'} action={e?'编辑实验':undefined} onAction={()=>e&&setDraft({...e})}>{e&&m?<><div className="record-meta">{e.source} · {e.date||'日期未填'}</div><p><Badge tone={e.outcome==='待判断'?'orange':'green'}>{e.outcome}</Badge> {db.insights.find(i=>i.id===e.insight)?.title||'未关联洞察'}</p>{e.script&&<p className="muted">脚本 · {db.scripts.find(s=>s.id===e.script)?.title} · 版本 {e.version}</p>}<div className="metric-strip">{funnel.map(f=><div key={f.name}><span>{f.name}</span><strong>{number(f.value,f.suffix)}</strong></div>)}</div>{!e.reportOnly&&<><div className="metric-strip money"><div><span>净成交金额</span><strong>{currency(m.net)}</strong></div><div><span>退款调整后毛利（估算）</span><strong>{currency(m.gross)}</strong></div><div><span>扣除投放费后的贡献（估算）</span><strong>{currency(m.contribution)}</strong></div></div><div className="raw-grid">{keys.map(k=><span key={k}>{metricFields[k]} <b>{e[k].toLocaleString('zh-CN')}</b></span>)}</div></>}{e.notes&&<p className="notes">{e.notes}</p>}</>:<Empty>暂无实验结果。录入数据后计算漏斗和毛利。</Empty>}</Panel>
  {e&&<Panel title="漏斗诊断"><button className="button" disabled={suggesting} onClick={()=>void suggest(false)}>生成待审核规律建议</button>{(db.endpoint||localModel)&&<button className="button" disabled={suggesting} onClick={()=>void suggest(true)}>用模型生成规律建议</button>}{e.reported&&Object.keys(e.reported).length>0&&<p className="muted">已录入的报表比率优先显示。</p>}{e.impressions<db.thresholds.sample&&<div className="notice">样本量提醒 · 当前 {e.impressions} 次展现，低于内部参考 {db.thresholds.sample} 次。阈值比较仅供参考。</div>}<ul className="diagnosis">{funnel.map(f=><li key={f.name}><b>{f.name}</b><span>{f.value===null?'分母为 0，暂无法计算。':f.value<f.target?f.reason:'达到当前内部参考阈值。'}</span></li>)}</ul><p className="muted">净 ROI =（成交金额 − 退款金额）÷ 花费。退款调整后毛利估算 = 录入毛利 − 退款金额，未计退货回收及其他费用。</p></Panel>}</div></div>
  {draft&&<Modal title="实验记录" onClose={()=>setDraft(null)} onSave={submit}><div className="form-grid"><Field label="实验名称" required value={draft.title} change={v=>setDraft({...draft,title:v})}/><Field label="记录日期" type="date" required value={draft.date} change={v=>setDraft({...draft,date:v})}/><Field label="数据来源（报表链接、编号及统计区间）" required long value={draft.source} change={v=>setDraft({...draft,source:v})}/><Field label="关联洞察" value={draft.insight} change={v=>setDraft({...draft,insight:v,script:'',version:'',outcome:v?draft.outcome:'待判断'})} options={[{value:'',label:'暂不关联'},...db.insights.map(i=>({value:i.id,label:i.title}))]}/><Field label="关联脚本" value={draft.script} change={v=>setDraft({...draft,script:v,version:''})} options={[{value:'',label:'暂不关联'},...db.scripts.filter(s=>s.insight===draft.insight).map(s=>({value:s.id,label:s.title}))]}/>{linked&&<Field label="使用版本" required value={draft.version} change={v=>setDraft({...draft,version:v})} options={[...opts(['']),...linked.versions.map((v,i)=>({value:v.id,label:`版本 ${linked.versions.length-i} · ${v.variant}`}))]}/>}
  <label className="row"><input type="checkbox" checked={draft.reportOnly||false} onChange={e=>setDraft({...draft,reportOnly:e.target.checked})}/>仅有报表比率，未录入项显示缺失</label>
  {keys.filter(k=>!draft.reportOnly||k==='impressions').map(k=><Field key={k} label={metricFields[k]} type="number" value={Number.isNaN(draft[k])?'':String(draft[k])} required change={v=>setDraft({...draft,[k]:v===''?NaN:Number(v)})}/>)}{(['hold','ctr','cvr','roi'] as const).map(k=><Field key={k} label={'报表 '+thresholdLabels[k]+'（选填）'} type="number" value={draft.reported?.[k]===undefined?'':String(draft.reported[k])} change={v=>{
    const reported={...draft.reported};if(v==='')delete reported[k];else reported[k]=Number(v);setDraft({...draft,reported})
  }}/>)}
  <Field label="假设结论" value={draft.outcome} change={v=>setDraft({...draft,outcome:v})} options={opts(outcomes)}/><Field label="判断依据 / 反证 / 后续验证" value={draft.notes} change={v=>setDraft({...draft,notes:v})} long required={draft.outcome!=='待判断'}/></div></Modal>}
  {limits&&<Modal title="内部待校准阈值" onClose={()=>setLimits(null)} onSave={submitLimits}><div className="form-grid">{(Object.keys(defaults) as (keyof typeof defaults)[]).map(k=><Field key={k} label={thresholdLabels[k]} type="number" required value={Number.isNaN(limits[k])?'':String(limits[k])} change={v=>setLimits({...limits,[k]:v===''?NaN:Number(v)})}/>)}</div></Modal>}</>
}
export function DataSettings({db,update,notify}:{db:DB;update:Update;notify:(s:string)=>void}){
  const [endpoint,setEndpoint]=useState(db.endpoint)
  const [backup,setBackup]=useState<{db:DB;name:string}|null>(null)
  async function read(file:File){
    try{setBackup({db:decode(await file.text(),file.name.toLowerCase().endsWith('.csv')),name:file.name})}
    catch(error){notify(error instanceof Error?error.message:'无法读取备份。')}
  }
  function configure(){
    const input=endpoint.trim()
    if(input){
      try{const u=new URL(input);if(u.username||u.password||!(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error()}
      catch{notify('请输入 HTTPS 或本机 HTTP 地址，地址中不要包含账号密码。');return}
    }
    if(update(d=>({...d,endpoint:input})))notify('接口设置已保存。')
  }
  return <><PageHead label="工作区管理" title="数据与设置" description="在浏览器保存工作记录，导出备份或从已验证格式的备份恢复。"/><div className="library-grid"><Panel title="导入与导出"><p className="muted">JSON 与 CSV 都保存完整关系和脚本版本。CSV 使用 collection、id、data 三列。</p><div className="inline-buttons"><button className="button" onClick={()=>download(db,false)}><ArrowDownToLine size={16}/> 导出 JSON</button><button className="button" onClick={()=>download(db,true)}><ArrowDownToLine size={16}/> 导出 CSV</button><label className="button upload"><FileUp size={16}/> 导入备份<input type="file" accept=".json,.csv" onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void read(f)}}/></label></div></Panel><Panel title="模型连接"><p className="muted">文案库的模型由站点服务端配置。下方自定义代理仅用于实验复盘的规律建议。</p><Field label="自定义代理 URL（选填）" value={endpoint} change={setEndpoint}/><button className="button primary" onClick={configure}>保存接口设置</button></Panel></div>
  {backup&&<Modal title="从备份恢复" onClose={()=>setBackup(null)} saveLabel="替换本地数据" onSave={()=>{if(update(()=>backup.db)){setEndpoint(backup.db.endpoint);setBackup(null);notify('备份已恢复。')}}}><p>{backup.name}</p><p>备份包含 {backup.db.insights.length} 张洞察、{backup.db.scripts.length} 个脚本和 {backup.db.experiments.length} 个实验。导入会替换本地数据和设置。</p><button type="button" className="button" onClick={()=>download(db,false)}>先导出当前备份</button></Modal>}</>
}
