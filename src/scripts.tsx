import {commerceShots,dimensions,total} from './commerce-engine'
import type {SaveCommerce} from './commerce-panel'
import {defaultProduct,productFacts,productOf,productsFor} from './products'
import {StoryboardEditor} from './storyboard-editor'
import {appendStudioVersions,studioShot,videoCopy,type ReviewRound,type StudioShot} from './studio-engine'
import {DesignLibrary,RuleLibrary} from './research-library'
import {ruleDraft,type Design,type Rule,type SourceEvidence} from './research'
import {useEffect,useRef,useState} from 'react'
import VideoWorkbench from './video-workbench'
import {BookOpen, Check, Clapperboard, FolderOpen, History, Layers3, ShieldCheck, Upload} from 'lucide-react'
import {audit, deleteScript, now, uid, variants, verified, type DB, type Fact, type ScriptBrief, type Version} from './domain'
import {deliveryFindings,formatNarration,formatShootingScript,scriptAuditText} from './shooting-script'
import {type Update} from './library'
import {ScriptPlanningPanel} from './script-planning-panel'
import {restoreScriptPlan,type ScriptPlanning} from './script-planning'
import {Badge,Empty,Field,PageHead,Panel} from './ui'

export function ScriptStudio({db,update,initialInsight,initialScript,initialProduct,initialSource,requestedTab,notify,goAudit,goExperiment}:{db:DB;update:Update;initialInsight:string;initialScript?:string;initialProduct?:string;initialSource?:string;requestedTab?:{view:'script'|'video'|'agent'};notify:(m:string)=>void;goExperiment:(s:string,v:string)=>void;goAudit:(s:string,v:string,input:string,productId:string)=>void}){
  const [tab,setTab]=useState<'script'|'video'|'rules'|'design'>(requestedTab?.view==='video'?'video':'script')
  useEffect(()=>{if(requestedTab)setTab(requestedTab.view==='video'?'video':'script')},[requestedTab])
  const [libraryOpen,setLibraryOpen]=useState(false)
  const [rule,setRule]=useState<Rule>()
  const [ruleId,setRuleId]=useState('')
  const [designFocus,setDesignFocus]=useState('')
  const [sourceFocus,setSourceFocus]=useState<SourceEvidence>()
  const videoPicker=useRef<HTMLInputElement>(null)
  const [insightId,setInsightId]=useState(initialInsight||'')
  const [scriptId,setScriptId]=useState(initialScript||'')
  const selected=db.scripts.find(s=>s.id===scriptId)
  const [productId,setProductId]=useState(initialProduct||productOf(selected?.versions[0]))
  const products=productsFor(db)
  const product=products.find(item=>item.id===productId)??defaultProduct
  const scopedFacts=productFacts(db,product.id)
  const [versionId,setVersionId]=useState(selected?.versions[0]?.id||'')
  const [design,setDesign]=useState(selected?.versions[0]?.design||'')
  const [fixedTiming,setFixedTiming]=useState(selected?.versions[0]?.fixedTiming||false)
  const [variant,setVariant]=useState(selected?.versions[0]?.variant||variants[0])
  const [title,setTitle]=useState(selected?.versions[0]?.title||selected?.title||db.insights.find(i=>i.id===insightId)?.title||'')
  const [evidence,setEvidence]=useState<Fact[]>(selected?.versions[0]?.evidence||[])
  const [shots,setShots]=useState<StudioShot[]>(()=>selected?.versions[0]?.shots.map(studioShot)||[])
  const [generatedBrief,setGeneratedBrief]=useState<ScriptBrief|undefined>(selected?.versions[0]?.brief)
  const [material,setMaterial]=useState(selected?.versions[0]?.material||'')
  const [materialReference,setMaterialReference]=useState<{id:string;stages:string[]}>()
  const [batch,setBatch]=useState(selected?.versions[0]?.batch||'')
  const [reviews,setReviews]=useState<ReviewRound[]>(selected?.versions[0]?.review||[])
  const [planning,setPlanning]=useState<ScriptPlanning|undefined>(selected?.versions[0]?.planning)
  const editor=useRef<HTMLDivElement>(null)
  const [dirty,setDirty]=useState(false)
  const insight=db.insights.find(i=>i.id===(selected?.insight||insightId))
  const fullScript=formatShootingScript(title,shots,generatedBrief)
  const findings=deliveryFindings(title,shots,scopedFacts,generatedBrief)
  function selectVersion(id:string,v:Version){
    const s=db.scripts.find(s=>s.id===id)
    if(!s)return
    setProductId(productOf(v));setScriptId(id);setInsightId(s.insight);setTitle(v.title||s.title);setEvidence(v.evidence);setVariant(v.variant)
    setMaterialReference(undefined);setShots(v.shots.map(studioShot));setVersionId(v.id);setPlanning(v.planning);setGeneratedBrief(v.brief)
    setDesign(v.design||'');setFixedTiming(Boolean(v.fixedTiming));setMaterial(v.material||'');setBatch(v.batch||'');setReviews(v.review||[]);setDirty(false)
  }
  function chooseScript(id:string){
    const s=db.scripts.find(s=>s.id===id)
    if(s)selectVersion(id,s.versions[0])
  }
  function acceptPlannedDraft(draft:{title:string;shots:StudioShot[]},next:ScriptPlanning,facts:Fact[]){
    if(dirty&&!window.confirm('载入 AI 稿件会替换当前未保存的分镜。继续？'))return
    setPlanning(next);setGeneratedBrief({problem:next.plan.problem,proof:''})
    setShots(draft.shots);setTitle(draft.title);setEvidence(facts);setMaterial('')
    setVariant(next.structure.status==='报告参考'?'AI 试拍稿 · 待验证':'AI 策划稿');setVersionId('');setDesign('');setBatch('');setReviews([]);setFixedTiming(false);setDirty(true)
    requestAnimationFrame(()=>editor.current?.scrollIntoView({block:'start'}))
  }
  const saveCommerce:SaveCommerce=(editions,generation,existingId)=>{
    if(!insight||!editions.length)return
    const id=existingId||uid()
    const versions=editions.map(({draft,meta}):Version=>{
      const shots=commerceShots(draft,meta.duration)
      return {id:uid(),title:draft.title,productId:product.id,date:now(),variant:meta.hook.strategy+' · '+meta.changes,shots,
        evidence:scopedFacts.filter(f=>draft.factIds.includes(f.id)&&verified(f)),fixedTiming:true,...(materialReference?.id?{material:materialReference.id}:{}),
        brief:{problem:meta.motive.concern,proof:meta.motive.proof},
        planning:{structure:{id:'commerce:'+meta.hook.strategy,title:meta.hook.strategy,stages:[],status:'报告参考',basis:'带货创作策略，需投放验证。',sources:[]},
          plan:{title:draft.title,problem:meta.motive.concern,angle:meta.motive.reason,demo:meta.motive.proof,segments:draft.shots.map(s=>({name:s.task,purpose:s.visual,copy:s.copy}))},generation,commerce:meta}}
    })
    if(update(d=>appendStudioVersions(d,id,versions.at(-1)!.title!,insight.id,[...versions].reverse())))return id
    notify('无法保存生成版本，请检查浏览器存储。')
  }
  function changePlanningInsight(id:string){
    if(!insight&&dirty&&id){setInsightId(id);return}
    if(dirty&&!window.confirm('切换人群会清空当前未保存的分镜。继续？'))return
    resetDraft(id)
  }
  function resetDraft(id:string){
    setMaterialReference(undefined)
    setShots([]);setInsightId(id);setScriptId('');setVersionId('');setPlanning(undefined);setEvidence([]);setDesign('');setMaterial('');setBatch('');setReviews([]);setGeneratedBrief(undefined);setDirty(false);setFixedTiming(false)
    setTitle(db.insights.find(i=>i.id===id)?.title||'')
  }
  function changeProduct(id:string){
    if(dirty&&!window.confirm('切换产品会清空当前未保存的分镜。继续？'))return
    resetDraft(insight?.id||'')
    setProductId(id)
  }
  function currentVersion():Version{
    return {id:uid(),productId:product.id,title:title.trim(),date:now(),variant,shots,evidence,...(generatedBrief?{brief:generatedBrief}:{}),...(planning?{planning}:{}),...(design?{design}:{}),
      ...(material?{material}:{}),...(batch?{batch}:{}),...(reviews.length?{review:reviews}:{}),fixedTiming}
  }
  async function copyText(content:string,label:string){
    try{await navigator.clipboard.writeText(content);notify(label+'已复制。')}
    catch{notify('复制权限不可用，可选中文本手动复制。')}
  }
  function copyDelivery(narrationOnly=false){
    if(planning?.commerce?.risks.length){notify('此版本有待人工复核的风险，暂不可复制交付。');return}
    if(planning?.commerce&&!evidence.length&&!findings.length){
      void copyText('【内部试拍稿 · 产品事实待核验】\n'+(narrationOnly?formatNarration(shots):fullScript),'内部试拍稿');return
    }
    if(findings.length){notify('交付稿仍有规则提示，请先复核并修改。');return}
    void copyText(narrationOnly?formatNarration(shots):fullScript,narrationOnly?'视频文案':'整套视频脚本')
  }
  function removeSelected(){
    if(!selected)return
    const experiments=db.experiments.filter(e=>e.script===selected.id).length
    const audits=db.audits.filter(a=>a.script===selected.id).length
    if(!window.confirm(`删除「${selected.title}」及其 ${selected.versions.length} 个版本？此操作无法撤销。关联的 ${experiments} 条实验与 ${audits} 条审核记录会保留，脚本链接将解除。`))return
    if(update(d=>deleteScript(d,selected.id))){
      setDesign('');setMaterial('');setBatch('');setReviews([]);setFixedTiming(false);setScriptId('');setInsightId(insight?.id||'');setVersionId('');setShots([]);setTitle(insight?.title||'');setEvidence([])
      setGeneratedBrief(undefined);setDirty(false);setPlanning(undefined)
      notify('已删除脚本及其版本。')
    }
  }
  function storeVersion(){
    if(!insight||!title.trim()||!shots.length||shots.some(s=>!s.content.trim()||!videoCopy(s).trim())){notify('请补齐标题、拍摄说明和视频文案。');return}
    const id=selected?.id||uid(),v=currentVersion()
    if(update(d=>appendStudioVersions(d,id,title.trim(),insight.id,[v]))){
      setScriptId(id);setVersionId(v.id);setDirty(false);notify('脚本版本已保存。')
    }
  }
  function sendDesign(d:Design){
    if(dirty&&!window.confirm('替换当前未保存的脚本草稿？'))return
    const fact=db.facts.find(f=>f.id===d.fact&&verified(f))
    if(!db.insights.some(i=>i.id===d.insight)||d.fact&&!fact){notify('来源洞察或已核验卖点已变更，请复核后重新生成设计。');return}
    setProductId(productOf(fact));setDesign(d.id);setMaterial(db.rules?.find(r=>r.id===d.rule)?.evidence[0]?.material||'');setBatch('');setReviews([]);setFixedTiming(true);setScriptId('');setVersionId('');setInsightId(d.insight)
    setTitle(d.title);setVariant('报告迁移 · 设计库');setEvidence(fact?[fact]:[]);setShots(d.shots.map(studioShot))
    const plan={problem:db.insights.find(i=>i.id===d.insight)?.pain||d.scene,proof:d.conditions}
    setGeneratedBrief(plan);setDirty(true);setPlanning(undefined);setTab('script');notify('已载入设计。编辑后保存为脚本版本，即可关联实验复盘。')
  }
  return <section className="studio-workspace">
    <PageHead label="内容制作" title="脚本工作台" description="结合产品、人群洞察和素材结构，完成策划、分镜和视频文案。" action="上传本地视频" actionIcon={Upload} onAction={()=>{setTab('video');videoPicker.current?.click()}}/>
    <nav aria-label="脚本工作台视图" className="workspace-tabs">
      <button className={tab==='script'?'active':''} aria-pressed={tab==='script'} onClick={()=>setTab('script')}><Clapperboard size={16}/> 文案库</button>
      <button className={tab==='video'?'active':''} aria-pressed={tab==='video'} onClick={()=>setTab('video')}><FolderOpen size={16}/> 视频素材与拆解</button>
      <button className={tab==='rules'?'active':''} aria-pressed={tab==='rules'} onClick={()=>setTab('rules')}><BookOpen size={16}/> 规律库</button>
      <button className={tab==='design'?'active':''} aria-pressed={tab==='design'} onClick={()=>setTab('design')}><Layers3 size={16}/> 设计库</button>
    </nav>
    <div hidden={tab!=='video'}><VideoWorkbench notify={notify} pickerRef={videoPicker} focus={sourceFocus} onApplyDraft={(next,newTitle,problem,proof,sourceMaterial)=>{
      if(dirty&&!window.confirm('当前有未保存的脚本草稿，使用迁移整稿替换它？'))return
      setProductId(defaultProduct.id);setDesign('');setMaterial(sourceMaterial||'');setBatch('');setReviews([]);setFixedTiming(false);setScriptId('');setVersionId('');setTitle(newTitle);setEvidence([]);setPlanning(undefined)
      setMaterialReference({id:sourceMaterial||'',stages:next.slice(0,10).map(shot=>shot.part.slice(0,80))});setVariant('报告迁移 · 素材拆解');setShots(next.map(studioShot));setGeneratedBrief({problem,proof});setDirty(true)
      setTab('script');notify('已载入整套迁移脚本，请选择对应来源洞察，复核后保存为新版本。')
    }} extract={source=>{setRule(ruleDraft(source));setTab('rules')}}/></div>
    <div hidden={tab!=='rules'}><RuleLibrary db={db} update={update} draft={rule} setDraft={setRule} notify={notify} openSource={s=>{setSourceFocus({...s});setTab('video')}} openDesign={id=>{setDesignFocus('');setRuleId(id);setTab('design')}}/></div>
    <div hidden={tab!=='design'}><DesignLibrary key={designFocus} initialDesign={designFocus} db={{...db,facts:productFacts(db,defaultProduct.id)}} update={update} ruleId={ruleId} chooseRule={setRuleId} notify={notify} send={sendDesign} openRule={r=>{setRule(r);setTab('rules')}} openScript={id=>{chooseScript(id);setTab('script')}}/></div>
    {tab==='script'&&<div className="studio-grid" data-library-open={libraryOpen}>
      <div className="studio-library-toggle">
        <button className="button" aria-expanded={libraryOpen} aria-controls="studio-library" onClick={()=>setLibraryOpen(open=>!open)}><History size={16}/> 脚本库与版本</button>
      </div>
      <aside className="stack studio-library" id="studio-library" hidden={!libraryOpen} aria-label="脚本与历史版本">
        <Panel title="脚本库" action="新脚本" onAction={()=>{if(dirty&&!window.confirm('开始新脚本会替换当前未保存的分镜。继续？'))return;setPlanning(undefined);setScriptId('');setVersionId('');setShots([]);setTitle(insight?.title||'');setEvidence([]);setDesign('');setMaterial('');setBatch('');setReviews([]);setGeneratedBrief(undefined);setDirty(false)}}>
          {db.scripts.filter(s=>s.versions.some(v=>v.date)).map(s=><button key={s.id} className={'list-button '+(scriptId===s.id?'active':'')} onClick={()=>{if(dirty&&!window.confirm('切换脚本会替换当前未保存的分镜。继续？'))return;setPlanning(undefined);chooseScript(s.id)}}>{s.title}<small>{products.find(p=>p.id===productOf(s.versions[0]))?.name} · {s.versions.length} 个版本</small></button>)}
        </Panel>
        <Panel title="版本历史" action={selected?'删除脚本':undefined} onAction={removeSelected}>
          {selected?.versions.map((v,i)=><button key={v.id} className={'list-button '+(versionId===v.id?'active':'')} onClick={()=>{if(dirty&&!window.confirm('切换版本会替换当前未保存的分镜。继续？'))return;setPlanning(undefined);selectVersion(selected.id,v)}}><History size={16}/><span>版本 {selected.versions.length-i} · {v.variant}<small>{v.date?new Date(v.date).toLocaleString('zh-CN'):'内置初稿'}</small></span></button>)}
          {!selected&&<Empty>生成或保存后可从这里恢复任一版本。</Empty>}
        </Panel>
      </aside>
      <div className="stack studio-document">
        <ScriptPlanningPanel key={product.id+'|'+(insight?.id||'none')+'|'+versionId} db={db} product={product} selectProduct={changeProduct} insight={insight} initialSource={planning?.structure.id||initialSource} savedPlanning={planning} savedShots={shots}
          commerceScript={selected} materialReference={materialReference} selectInsight={changePlanningInsight} accept={acceptPlannedDraft} saveCommerce={saveCommerce} openCommerce={id=>{if(!dirty||window.confirm('切换脚本会替换未保存的分镜。继续？')){chooseScript(id);requestAnimationFrame(()=>editor.current?.scrollIntoView({block:'start'}))}}}/>
        {!!shots.length&&<>
          <div ref={editor} className="agent-editor"><Panel title="编辑分镜">
            <Field label="脚本标题" value={title} change={v=>{setTitle(v);setDirty(true)}}/>{dirty&&<Badge tone="orange">未保存草稿</Badge>}
            <p className="muted">当前产品 · {product.name} · {variant}{evidence.length?' · 核验依据 '+evidence.map(f=>f.id+' '+f.source).join('、'):''}</p>
            {planning?.commerce&&<details className="source-note"><summary>{planning.commerce.review?total(planning.commerce.review)+' / 100 · ':''}{planning.commerce.hook.strategy} · {planning.commerce.changes}</summary>
              <p>{planning.commerce.motive.reason}</p>
              {planning.commerce.review&&<ul>{planning.commerce.review.scores.map((s,i)=><li key={i}>{dimensions[i][0]} {s.score}/{dimensions[i][1]} · {s.reason}</li>)}</ul>}
              {planning.commerce.risks.length>0&&<p role="alert">需人工复核 · {planning.commerce.risks.join('；')}</p>}
              {!evidence.length&&<p className="notice">内部试拍稿 · 产品事实待核验</p>}
            </details>}
            {planning?.generation&&<details className="source-note"><summary>{planning.generation.provider} · {planning.generation.model||'生成模型'} · 引用 {planning.generation.memory.length} 条创作记忆</summary>
              {planning.generation.memory.map(m=><p key={m.kind+m.id}>{m.kind} · {m.title} · {m.id}<br/>{m.summary}</p>)}
            </details>}
            {planning&&<details className="source-note"><summary>策划与投放来源 · {planning.structure.status}</summary>
              <p><strong>{planning.structure.title}</strong> · {planning.structure.basis}</p>
              <p>{planning.plan.problem} · {planning.plan.angle}</p>
              <ol>{restoreScriptPlan(planning).segments.map((segment,i)=><li key={i}><strong>{segment.name}</strong> · {segment.purpose}</li>)}</ol>
              <ul>{planning.structure.sources.map((item,i)=><li key={i}>{item}</li>)}</ul>
            </details>}
            {design&&<button className="text-button" onClick={()=>{setRuleId(db.designs?.find(d=>d.id===design)?.rule||'');setDesignFocus(design);setTab('design')}}>查看关联设计与来源</button>}
            {material&&<p className="muted">关联视频素材 ID · {material}</p>}
            <div className="inline-buttons"><button className="button" disabled={!!findings.length||!!planning?.commerce?.risks.length} onClick={()=>copyDelivery()}>复制拍摄稿</button><button className="button" disabled={!!findings.length||!!planning?.commerce?.risks.length} onClick={()=>copyDelivery(true)}>复制视频文案</button></div>
            <StoryboardEditor key={versionId||scriptId||'draft'} shots={shots} material={material} audience={insight?.title||''} problem={generatedBrief?.problem||insight?.pain||''} disabled={false} onChange={next=>{setShots(next);setDirty(true)}} notify={notify}/>

            <div className="inline-buttons studio-save-bar"><button className="button primary" onClick={storeVersion}>保存为新版本</button><button className="button" onClick={()=>goAudit(dirty?'':scriptId,dirty?'':versionId,findings.length?fullScript:scriptAuditText(shots),product.id)}><ShieldCheck size={16}/> 送合规审核</button>{scriptId&&versionId&&!dirty&&<button className="button" onClick={()=>goExperiment(scriptId,versionId)}>记录投放实验</button>}<Badge tone={findings.length?'orange':'green'}>{findings.length?`${findings.length} 项规则提示`:'暂未命中规则'}</Badge></div>
            {!!findings.length&&<p className="notice">交付待复核：{findings.map(f=>f.term).join('、')}</p>}
          </Panel></div>
          {!!reviews.length&&<Panel title="历史改写记录">
            {reviews.map((r,i)=><details key={i} className="review-panel"><summary>第 {i+1} 轮 · {r.mode}改写 · {r.accepted?'采纳':'保留前版'}</summary><p>{r.reason}</p>
              <button className="button" onClick={()=>{setShots(r.before);setDirty(true);notify('已恢复本轮修改前的草稿，可另存版本。')}}>恢复本轮前稿</button>
            </details>)}
          </Panel>}
          <Panel title="完整视频脚本">
            <textarea className="narration" aria-label="完整视频脚本" rows={10} value={fullScript} readOnly/>
          </Panel>
        </>}
      </div>
    </div>}
  </section>
}
export function Compliance({db,update,notify,prefill}:{db:DB;update:Update;notify:(m:string)=>void;prefill:{script:string;version:string;input:string;productId:string}}){
  const [text,setText]=useState(prefill.input)
  const [result,setResult]=useState<string|null>(null)
  const [link,setLink]=useState(prefill)
  const findings=result===null?[]:audit(result,productFacts(db,link.productId))
  function review(){
    if(!text.trim()){notify('请输入需要审核的内容。');return}
    const entry={id:uid(),date:now(),productId:link.productId,script:link.input===text?link.script:'',version:link.input===text?link.version:'',input:text}
    if(update(d=>({...d,audits:[entry,...d.audits]})))setResult(text)
  }
  return <><PageHead label="内容治理" title="合规审核" description="按风险词库和已核验事实检查画面说明和视频文案，结果仅供内部复核。"/><div className="studio-grid audit-grid"><Panel title="待审核内容"><Field label="从已保存版本载入" value={link.version?`${link.script}|${link.version}`:''} change={value=>{if(!value){setLink({...link,script:'',version:'',input:''});setResult(null);return}const [id,version]=value.split('|');const s=db.scripts.find(s=>s.id===id);const v=s?.versions.find(v=>v.id===version);if(v){const input=scriptAuditText(v.shots);setText(input);setLink({script:id,version,input,productId:productOf(v)});setResult(null)}}} options={[{value:'',label:'手动输入 / 粘贴'},...db.scripts.flatMap(s=>s.versions.map((v,i)=>({value:`${s.id}|${v.id}`,label:`${s.title} · 版本 ${s.versions.length-i}`})))]}/><Field label="审核产品" value={link.productId} options={productsFor(db).map(p=>({value:p.id,label:p.name}))} change={productId=>{setLink({productId,script:'',version:'',input:''});setResult(null)}}/><Field label="审核文本" long value={text} change={v=>{setText(v);setResult(null)}}/><button className="button primary" onClick={review}><ShieldCheck size={17}/> 运行规则审核</button><p className="muted">发布前请人工核对原始证据、测试条件与适用平台规则。</p></Panel><Panel title="规则命中与替代措辞">{result===null?<Empty>运行审核后查看结果。</Empty>:findings.length?<div className="risk-list">{findings.map((f,i)=><div key={i}><Badge tone="orange">{f.term}</Badge><b>{f.reason}</b><p>{f.fix}</p></div>)}</div>:<div className="notice"><Check size={18}/> 当前规则未发现风险。</div>}</Panel></div><Panel title="审核记录"><div className="audit-history">{db.audits.map(a=><button key={a.id} className="list-button" onClick={()=>{setText(a.input);setLink({...a,productId:a.productId||productOf(db.scripts.find(s=>s.id===a.script)?.versions.find(v=>v.id===a.version))});setResult(a.input)}}><ShieldCheck size={16}/><span>{a.input.slice(0,52)}<small>{new Date(a.date).toLocaleString('zh-CN')} · 按当前规则重算 {audit(a.input,productFacts(db,a.productId||productOf(db.scripts.find(s=>s.id===a.script)?.versions.find(v=>v.id===a.version)))).length} 项提示 {a.version?' · 已关联脚本版本':''}</small></span></button>)}{!db.audits.length&&<Empty>暂无审核记录。</Empty>}</div></Panel></>
}
