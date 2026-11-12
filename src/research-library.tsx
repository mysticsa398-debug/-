import {useState} from 'react'
import {audiences,audit,metrics,now,verified,type DB} from './domain'
import {replace,type Update} from './library'
import {categories,confidenceLevels,generateDesigns,type Design,type Rule,type SourceEvidence} from './research'
import {Empty,Field,opts,Panel} from './ui'
import {span} from './video-analysis'
import {mediaLink} from './video-review'

export function RuleLibrary({db,update,draft,setDraft,openSource,openDesign,notify}:{db:DB;update:Update;draft?:Rule;setDraft:(r?:Rule)=>void;openSource:(s:SourceEvidence)=>void;openDesign:(id:string)=>void;notify:(s:string)=>void}){
  const [category,setCategory]=useState('')
  const [query,setQuery]=useState('')
  const [merge,setMerge]=useState('')
  const rules=db.rules||[]
  const matching=rules.filter(r=>(!category||r.category===category)&&[r.title,r.audience,r.scene,r.status,r.confidence,...r.evidence.map(s=>s.name+' '+s.brand+' '+s.source)].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  function save(review:boolean){
    if(!draft)return
    if(!draft.title.trim()||!draft.mechanism.trim()||!draft.evidence.length||review&&(!draft.basis.trim()||!draft.transfer.trim())){notify('请填写标题、机制和来源。审核还需填写判断依据及迁移方式。');return}
    const samples=new Set(draft.evidence.map(e=>e.material)).size
    const versions=new Set(db.scripts.flatMap(s=>s.versions.filter(v=>db.designs?.some(d=>d.id===v.design&&d.rule===draft.id)).map(v=>v.id)))
    if(draft.confidence==='交叉支持'&&samples<2||draft.confidence==='实测验证'&&!db.experiments.some(e=>versions.has(e.version)&&e.impressions>0&&e.source.trim())){
      notify('交叉支持需两个独立素材，实测验证需已关联的真实实验和报告来源。');return
    }
    const prior=rules.find(r=>r.id===draft.id)
    const revisions=prior?.revisions||[]
    const {revisions:discarded,...snapshot}=prior||draft
    const next={...draft,revisions:prior?[...revisions,snapshot]:revisions,status:review?'已审核':'待审核',date:now(),history:[...draft.history,`${now()} · ${review?'人工审核':'保存待审核'} · ${draft.confidence}`]}
    if(update(d=>({...d,rules:replace(d.rules||[],next)}))){setDraft(next);notify('规律已保存。')}
  }
  return <div className="stack">
    <Panel title="规律库">
      <p className="muted">{rules.length} 条规律 · {rules.filter(r=>r.status==='待审核').length} 条待审核。素材内可将带时间码的证据提炼为候选规律。</p>
      <div className="video-form"><Field label="搜索标题、人群、场景、状态或来源" value={query} change={setQuery}/><Field label="规律分类" options={opts(['',...categories])} value={category} change={setCategory}/></div>
      {matching.map(r=><button key={r.id} className={'list-button '+(draft?.id===r.id?'active':'')} onClick={()=>setDraft(r)}>{r.title} · {r.category} · {r.status} · {r.confidence}</button>)}
      {!matching.length&&<Empty>当前没有匹配的规律。</Empty>}
    </Panel>
    {draft&&<Panel title="规律卡片与证据">
      <div className="video-form">
        <Field label="规律名称" value={draft.title} change={title=>setDraft({...draft,title})}/>
        <Field label="规律分类" value={draft.category} options={opts([...categories])} change={category=>setDraft({...draft,category})}/>
        <Field label="置信度" value={draft.confidence} options={opts([...confidenceLevels])} change={confidence=>setDraft({...draft,confidence})}/>
        {Object.entries({mechanism:'核心机制 / 用户心理',audience:'适配人群与标签',scene:'场景',conditions:'成立条件',limits:'局限与反证',transfer:'S8mini 迁移建议',hypothesis:'可测试假设',basis:'证据与置信度判断依据'}).map(([key,label])=>{
          const k=key as 'mechanism'|'audience'|'scene'|'conditions'|'limits'|'transfer'|'hypothesis'|'basis'
          return <Field long key={k} label={label} value={draft[k]} change={value=>setDraft({...draft,[k]:value})}/>
        })}
      </div>
      {draft.evidence.map(s=><details key={s.material+s.segment.id}>
        <summary>{s.brand} {s.name} · {span(s.segment.start,s.segment.end)}</summary>
        <p>{s.segment.evidence}</p><p>{s.segment.visual} {s.segment.speech}</p><p>{s.segment.limits}</p>
        <div className="inline-buttons"><button className="button" onClick={()=>openSource(s)}>在素材库回看</button>{mediaLink(s.source)&&<a href={mediaLink(s.source)} target="_blank" rel="noreferrer">原始来源</a>}</div>
      </details>)}
      <div className="inline-buttons">
        <Field label="归纳同类证据" value={merge} options={[{value:'',label:'选择同类规律'},...rules.filter(r=>r.id!==draft.id&&r.category===draft.category).map(r=>({value:r.id,label:r.title}))]} change={setMerge}/>
        <button className="button" disabled={!rules.some(r=>r.id===merge&&r.id!==draft.id&&r.category===draft.category)} onClick={()=>{
          const other=rules.find(r=>r.id===merge&&r.id!==draft.id&&r.category===draft.category)
          if(other)setDraft({...draft,evidence:[...new Map([...draft.evidence,...other.evidence].map(s=>[s.material+s.segment.id,s])).values()]})
          setMerge('')
        }}>并入来源证据</button>
      </div>
      <div className="inline-buttons">
        <button className="button" onClick={()=>save(false)}>保存待审核</button><button className="button primary" onClick={()=>save(true)}>审核并保存</button>
        {rules.some(r=>r.id===draft.id&&r.status==='已审核')&&<button className="button" onClick={()=>openDesign(draft.id)}>应用到 S8mini</button>}
        {rules.some(r=>r.id===draft.id)&&<button className="button" onClick={()=>{
          if(db.designs?.some(d=>d.rule===draft.id)){notify('该规律有关联设计，请先处理关联设计。');return}
          if(window.confirm('删除这条规律？')&&update(d=>({...d,rules:d.rules?.filter(r=>r.id!==draft.id)})))setDraft(undefined)
        }}>删除规律</button>}
      </div>
      <details><summary>审核记录与复盘</summary>
        {draft.history.map((h,i)=><p key={i}>{h}</p>)}
        {rules.find(r=>r.id===draft.id)?.revisions?.map((snapshot,i)=><div key={i} className="inline-buttons"><span>{snapshot.date.slice(0,10)} · {snapshot.title} · {snapshot.status}</span><button className="button" onClick={()=>{
          const prior=rules.find(r=>r.id===draft.id)
          if(!prior)return
          const {revisions,...current}=prior
          const next={...snapshot,date:now(),history:[...prior.history,now()+' · 人工回滚'],revisions:[...(revisions||[]),current]}
          if(update(d=>({...d,rules:replace(d.rules||[],next)}))){setDraft(next);notify('已恢复选定规律版本。')}
        }}>恢复这版规律</button></div>)}
        {draft.experiment&&db.experiments.filter(e=>e.id===draft.experiment).map(e=><p key={e.id}>建议依据 · {e.title} · {e.source}</p>)}
        {db.designs?.filter(d=>d.rule===draft.id).map(d=><div key={d.id}><p>{d.title}</p>
          {db.experiments.filter(e=>db.scripts.some(s=>s.id===e.script&&s.versions.some(v=>v.id===e.version&&v.design===d.id))).map(e=>{
            const m=metrics(e)
            return <p key={e.id}>{e.date} · {e.source} · {e.outcome} · 5 秒完播率 {m.hold?.toFixed(1)??'缺失'} · CTR {m.ctr?.toFixed(1)??'缺失'} · 净 ROI {m.roi?.toFixed(2)??'缺失'} · {e.notes}</p>
          })}
        </div>)}
      </details>
    </Panel>}
  </div>
}

export function DesignLibrary({db,update,ruleId,initialDesign,chooseRule,send,openRule,openScript,notify}:{db:DB;update:Update;ruleId:string;initialDesign:string;chooseRule:(id:string)=>void;send:(d:Design)=>void;openRule:(r:Rule)=>void;openScript:(id:string)=>void;notify:(s:string)=>void}){
  const [audience,setAudience]=useState('')
  const [insightId,setInsightId]=useState('')
  const [scene,setScene]=useState('')
  const [duration,setDuration]=useState('15')
  const [fact,setFact]=useState('')
  const [draft,setDraft]=useState<Design|undefined>(()=>db.designs?.find(d=>d.id===initialDesign))
  const [query,setQuery]=useState('')
  const rule=db.rules?.find(r=>r.id===ruleId&&r.status==='已审核')
  const insights=db.insights.filter(i=>i.audiences.includes(audience))
  const insight=insights.find(i=>i.id===insightId)
  const facts=db.facts.filter(f=>verified(f)&&f.wording.trim())
  const designs=db.designs||[]
  const options=designs.filter(d=>(!ruleId||d.rule===ruleId)&&[d.title,d.scene,d.direction,d.audience].join(' ').includes(query.trim()))
  function saveDesign(){
    if(!draft)return
    if(!draft.title.trim()||draft.shots.some(s=>!s.line.trim()||!s.visual.trim()||!s.subtitle?.trim())){notify('请填写设计标题、画面、口播及字幕。');return}
    const next={...draft,history:[...draft.history,now()],date:now()}
    if(update(d=>({...d,designs:replace(d.designs||[],next)}))){setDraft(next);notify('设计已保存。')}
  }
  return <div className="stack"><Panel title="设计库">
    <p className="muted">用审核后的规律创建可编辑模板草稿。可比较三个开头，3 秒后沿用相同脚本以便测试。</p>
    <div className="video-form">
      <Field label="已审核规律 / 筛选" value={ruleId} options={[{value:'',label:'全部设计'},...(db.rules||[]).filter(r=>r.status==='已审核'||r.id===ruleId).map(r=>({value:r.id,label:r.title}))]} change={chooseRule}/>
      <Field label="目标人群" options={opts(['',...audiences])} value={audience} change={a=>{setAudience(a);setInsightId('');setScene('')}}/>
      <Field label="来源洞察" options={[{value:'',label:'选择对应洞察'},...insights.map(i=>({value:i.id,label:i.title}))]} value={insightId} change={id=>{setInsightId(id);setScene(insights.find(i=>i.id===id)?.scene||'')}}/>
      <Field label="拍摄场景" value={scene} change={setScene}/>
      <Field label="已核验卖点" value={fact} options={[{value:'',label:'仅展示实物与操作'},...facts.map(f=>({value:f.id,label:f.claim}))]} change={setFact}/>
      <Field label="视频时长" value={duration} options={opts(['15','30','45'])} change={setDuration}/>
    </div>
    {audience&&!insights.length&&<p className="muted">该人群暂无洞察，请到<a href="#insights">人群洞察库</a>添加并绑定人群。</p>}
    {rule&&<p>迁移依据 · {rule.transfer}</p>}
    <button className="button primary" disabled={!rule||!insight||!scene.trim()} onClick={()=>{
      if(!rule||!insight)return
      const next=generateDesigns(rule,insight,audience,scene.trim(),Number(duration),facts.find(f=>f.id===fact))
      if(update(d=>({...d,designs:[...next,...(d.designs||[])]})))setDraft(next[0])
    }}>生成 3 套设计并保存</button>
    <Field label="搜索设计、人群或场景" value={query} change={setQuery}/>
    {!options.length&&<Empty>暂无匹配的设计。</Empty>}
    <div className="research-options">{options.map(d=><button className={'list-button '+(draft?.id===d.id?'active':'')} key={d.id} onClick={()=>setDraft(d)}><span>{d.title}<small>{d.shots[0]?.line} · {d.shots[0]?.visual}</small></span></button>)}</div>
  </Panel>
  {draft&&<Panel title="脚本、分镜与测试方案">
    <div className="inline-buttons"><button className="button" onClick={()=>{const r=db.rules?.find(r=>r.id===draft.rule);if(r)openRule(r)}}>查看原规律与证据</button>
      {db.scripts.filter(s=>s.versions.some(v=>v.design===draft.id)).map(s=><button key={s.id} className="button" onClick={()=>openScript(s.id)}>打开脚本 · {s.title}</button>)}
      <a href="#experiments">进入实验复盘</a>
    </div>
    <div className="video-form">{(['title','hypothesis','variable','metric','conditions','prompt'] as const).map((k,i)=><Field key={k} label={['设计标题','测试假设','主要变量','评价指标','测试条件','9:16 分镜提示词'][i]} long value={draft[k]} change={v=>setDraft({...draft,[k]:v})}/>)}</div>
    {draft.shots.map((s,i)=><details key={i}><summary>{s.time} · {s.part}</summary><div className="video-form">{(['visual','line','subtitle'] as const).map((k,j)=><Field key={k} label={['画面 / 景别 / 运镜','口播','字幕'][j]} long value={s[k]||''} change={v=>setDraft({...draft,shots:draft.shots.map((item,n)=>n===i?{...item,[k]:v}:item)})}/>)}</div></details>)}
    <p className="muted">版本记录 · {draft.history.length} 次编辑 · 最近保存 {new Date(draft.date).toLocaleString('zh-CN')}</p>
    <p className="muted">合规检查 · {audit(draft.shots.flatMap(s=>[s.visual,s.line,s.subtitle||'']).join('\n'),db.facts).map(f=>f.term+'：'+f.fix).join('；')||'规则未命中，请复核画面、证据与适用范围。'}</p>
    <div className="inline-buttons"><button className="button" onClick={saveDesign}>保存设计修改</button><button className="button primary" onClick={()=>{const saved=designs.find(d=>d.id===draft.id);if(saved&&JSON.stringify(saved)===JSON.stringify(draft))send(saved);else notify('请先保存设计修改。')}}>发送到脚本工作台</button>
      <button className="button" onClick={()=>{if(db.scripts.some(s=>s.versions.some(v=>v.design===draft.id))){notify('已有脚本版本引用此设计。');return}if(window.confirm('删除这条设计？')&&update(d=>({...d,designs:d.designs?.filter(i=>i.id!==draft.id)})))setDraft(undefined)}}>删除设计</button></div>
  </Panel>}</div>
}
